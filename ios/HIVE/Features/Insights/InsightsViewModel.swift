import Foundation
import Observation

/// Backs the Insights tab: a net-worth trend, the ML anomaly review queue, and the
/// points "leakage" report (rewards left on the table). Each section loads and fails
/// independently so one empty/broken feed never blanks the others.
@MainActor
@Observable
final class InsightsViewModel {
    private(set) var netWorthState: LoadState<[NetWorthSnapshot]> = .loading
    private(set) var anomaliesState: LoadState<[AnomalyDTO]> = .loading
    private(set) var leakageState: LoadState<LeakageResponse> = .loading
    private(set) var forecastState: LoadState<ForecastResponse> = .loading

    /// Anomalies currently being reviewed (so their row can show a spinner / disable).
    private(set) var reviewingIds: Set<String> = []

    var trendDays = 90

    /// Category the forecast section is showing. Most users have steady dining spend, so
    /// it's the most likely to have enough history for a meaningful Prophet fit.
    var forecastCategory = "Food & Drink"
    /// Current-month budget for `forecastCategory`, if one exists — powers the pace nudge.
    private(set) var forecastBudget: BudgetDTO?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func loadAll() async {
        async let nw: Void = loadNetWorth()
        async let an: Void = loadAnomalies()
        async let lk: Void = loadLeakage()
        async let fc: Void = loadForecast()
        _ = await (nw, an, lk, fc)
    }

    func loadNetWorth() async {
        if netWorthState.value == nil { netWorthState = .loading }
        do {
            let snaps = try await api.send(
                .get("/api/net-worth/history", query: [.init(name: "days", value: "\(trendDays)")]),
                as: [NetWorthSnapshot].self
            )
            netWorthState = snaps.isEmpty ? .empty : .loaded(snaps)
        } catch let error as APIError {
            netWorthState = .failed(error)
        } catch {
            netWorthState = .failed(.network)
        }
    }

    func loadAnomalies() async {
        if anomaliesState.value == nil { anomaliesState = .loading }
        do {
            let items = try await api.send(.get("/api/anomalies"), as: [AnomalyDTO].self)
            anomaliesState = items.isEmpty ? .empty : .loaded(items)
        } catch let error as APIError {
            anomaliesState = .failed(error)
        } catch {
            anomaliesState = .failed(.network)
        }
    }

    func loadLeakage() async {
        if leakageState.value == nil { leakageState = .loading }
        do {
            let resp = try await api.send(.get("/api/points/leakage"), as: LeakageResponse.self)
            leakageState = resp.entries.isEmpty ? .empty : .loaded(resp)
        } catch let error as APIError {
            leakageState = .failed(error)
        } catch {
            leakageState = .failed(.network)
        }
    }

    func loadForecast() async {
        let category = forecastCategory
        if forecastState.value == nil { forecastState = .loading }
        // Pace nudge needs the current-month budget for this category; best-effort.
        await loadForecastBudget(for: category)
        do {
            let encoded = category.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? category
            let resp = try await api.send(
                .get("/api/forecast/\(encoded)", query: [.init(name: "periods", value: "30")]),
                as: ForecastResponse.self
            )
            // Only flip state if the user hasn't switched categories mid-flight.
            guard category == forecastCategory else { return }
            forecastState = resp.dailyForecast.isEmpty ? .empty : .loaded(resp)
        } catch let error as APIError {
            guard category == forecastCategory else { return }
            // 422 = not enough history for this category; surface as a calm empty, not an error.
            if case .server(let status) = error, status == 422 {
                forecastState = .empty
            } else {
                forecastState = .failed(error)
            }
        } catch {
            guard category == forecastCategory else { return }
            forecastState = .failed(.network)
        }
    }

    private func loadForecastBudget(for category: String) async {
        let budgets = try? await api.send(
            .get("/api/budgets", query: [.init(name: "month", value: MonthHelper.current)]),
            as: [BudgetDTO].self
        )
        guard category == forecastCategory else { return }
        forecastBudget = budgets?.first { $0.category == category && $0.hasBudget }
    }

    func selectForecastCategory(_ category: String) {
        guard category != forecastCategory else { return }
        forecastCategory = category
        forecastBudget = nil
        forecastState = .loading
        Task { await loadForecast() }
    }

    /// Projected total over the next 30 days for the headline.
    var forecastProjectedTotal: Decimal { forecastState.value?.projectedTotal ?? 0 }

    /// Plain-language pace nudge. When a budget exists, projects month-end spend
    /// (actual-so-far + predicted spend for the remaining days of *this* month) and
    /// compares to the effective budget. Otherwise states the 30-day projection.
    var forecastNudge: (text: String, over: Bool)? {
        guard let fc = forecastState.value else { return nil }
        let cat = fc.category
        guard let budget = forecastBudget else {
            let total = fc.projectedTotal.formatted(.currency(code: "USD").precision(.fractionLength(0)))
            return ("Projected to spend about \(total) on \(cat) over the next 30 days.", false)
        }
        // Sum predicted spend for forecast days that fall within the current calendar month.
        let cal = Calendar.current
        let now = Date()
        let restOfMonth = fc.dailyForecast.reduce(Decimal(0)) { acc, day in
            guard let d = day.day, cal.isDate(d, equalTo: now, toGranularity: .month) else { return acc }
            return acc + day.predicted
        }
        let projectedMonthEnd = budget.actualSpend + restOfMonth
        let eff = budget.effectiveBudget
        let delta = projectedMonthEnd - eff
        let cur = abs(delta).formatted(.currency(code: "USD").precision(.fractionLength(0)))
        if delta > 0 {
            return ("On pace to exceed your \(cat) budget by about \(cur) this month.", true)
        } else {
            return ("On pace to come in about \(cur) under your \(cat) budget this month.", false)
        }
    }

    /// Mark one anomaly "ok" (false positive) or "confirmed", then drop it from the
    /// queue locally so the list updates without a full reload.
    func review(_ anomaly: AnomalyDTO, status: String) async {
        reviewingIds.insert(anomaly.id)
        defer { reviewingIds.remove(anomaly.id) }
        do {
            try await api.send(
                .post("/api/anomalies/\(anomaly.id)/review"),
                body: AnomalyReview(status: status)
            )
            if case .loaded(var items) = anomaliesState {
                items.removeAll { $0.id == anomaly.id }
                anomaliesState = items.isEmpty ? .empty : .loaded(items)
            }
            Haptics.success()
        } catch {
            Haptics.error()
        }
    }

    // MARK: Net-worth derived values for the hero

    var currentNetWorth: Decimal { (netWorthState.value ?? []).last?.netWorth ?? 0 }

    /// Organic change over the window: diffs only accounts present in BOTH the first
    /// and last snapshot (via breakdown), so newly-linked accounts don't show up as
    /// growth. Falls back to the plain net-worth delta when breakdowns are missing.
    var netWorthChange: Decimal {
        let snaps = netWorthState.value ?? []
        guard let first = snaps.first, let last = snaps.last, first.id != last.id else { return 0 }
        if let fb = first.breakdown, let lb = last.breakdown {
            let common = Set(fb.keys).intersection(lb.keys)
            if !common.isEmpty {
                return common.reduce(Decimal(0)) { acc, k in
                    let delta = (lb[k] ?? 0) - (fb[k] ?? 0)
                    return acc + (k.hasSuffix("(liability)") ? -delta : delta)
                }
            }
        }
        return last.netWorth - first.netWorth
    }
}
