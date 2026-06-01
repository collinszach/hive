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

    /// Anomalies currently being reviewed (so their row can show a spinner / disable).
    private(set) var reviewingIds: Set<String> = []

    var trendDays = 90

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func loadAll() async {
        async let nw: Void = loadNetWorth()
        async let an: Void = loadAnomalies()
        async let lk: Void = loadLeakage()
        _ = await (nw, an, lk)
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
