import SwiftUI
import Charts

/// Home · This month at a glance (Epic H3).
///
/// Three equal-width tiles: Budget used (ring), This week (bar chart), Net this month
/// (income − spend). Any tile whose backing data is absent is silently omitted.
/// If all three are absent the section renders nothing (`.empty`).
///
/// Follows the Home section contract established by `HomeCategoriesSection`:
/// self-contained view + private `@Observable` model, loads on `.task(id: token)`,
/// hides itself when empty, routes auth-expiry up.
struct HomeGlanceSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let glance):
                content(glance)
            case .loading:
                SkeletonBlock(height: 110, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    // MARK: - Rendered content

    @ViewBuilder
    private func content(_ glance: Glance) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HomeSectionHeader(title: "This month")
            GeometryReader { geo in
                let tileCount = glance.activeTileCount
                // Spacing between tiles
                let totalSpacing = Theme.Spacing.md * CGFloat(max(tileCount - 1, 0))
                let tileWidth = tileCount > 0
                    ? (geo.size.width - totalSpacing) / CGFloat(tileCount)
                    : geo.size.width

                HStack(alignment: .top, spacing: Theme.Spacing.md) {
                    if let spent = glance.spentThisMonth {
                        MonthTile(spent: spent, budgetPct: glance.budgetPct)
                            .frame(width: tileWidth)
                    }
                    if let weekly = glance.weekly {
                        WeeklyTile(weekly: weekly)
                            .frame(width: tileWidth)
                    }
                    if let net = glance.netCashFlow {
                        NetCashFlowTile(netCashFlow: net)
                            .frame(width: tileWidth)
                    }
                }
            }
            .frame(height: 124)
        }
    }

    // MARK: - Model

    @MainActor @Observable
    final class Model {
        fileprivate private(set) var state: LoadState<Glance> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }

            // Current month string "YYYY-MM"
            let monthString: String = {
                let fmt = DateFormatter()
                fmt.dateFormat = "yyyy-MM"
                fmt.locale = Locale(identifier: "en_US_POSIX")
                return fmt.string(from: Date())
            }()

            // Budgets — do/catch on auth expiry, then try? for everything else. Budgets are
            // optional context (a % overlay on the month tile), so nil when none are set.
            var budgetPct: Double? = nil
            do {
                let budgets = try await api.send(
                    .get("/api/budgets", query: [URLQueryItem(name: "month", value: monthString)]),
                    as: [BudgetDTO].self
                )
                let total = budgets.map(\.effectiveBudget).reduce(0, +)
                let spent = budgets.map(\.actualSpend).reduce(0, +)
                let totalDouble = (total as NSDecimalNumber).doubleValue
                budgetPct = totalDouble > 0
                    ? (spent as NSDecimalNumber).doubleValue / totalDouble
                    : nil
            } catch let error as APIError where error.isAuthExpiry {
                state = .failed(error)
                onAuthExpired()
                return
            } catch {
                // Non-auth failure — leave budget overlay nil, continue
            }

            // Weekly comparison — concurrent with income+spend
            async let weeklyResult: WeeklyComparison? = {
                try? await api.send(.get("/api/dashboard/weekly-comparison"), as: WeeklyComparison.self)
            }()

            async let incomeResult: IncomeSummary? = {
                try? await api.send(
                    .get("/api/income/summary", query: [URLQueryItem(name: "month", value: monthString)]),
                    as: IncomeSummary.self
                )
            }()

            async let summaryResult: DashboardSummary? = {
                try? await api.send(.get("/api/dashboard/summary"), as: DashboardSummary.self)
            }()

            let (weekly, income, summary) = await (weeklyResult, incomeResult, summaryResult)

            // Spent this month is always available from the summary — it anchors the section
            // so "This month" is never blank, even with no budgets or known income.
            let spentThisMonth: Decimal? = summary?.totalSpend

            // Net cash flow: only meaningful when income > 0
            var netCashFlow: Decimal? = nil
            if let inc = income, let sum = summary, inc.totalIncome > 0 {
                netCashFlow = inc.totalIncome - sum.totalSpend
            }

            let glance = Glance(
                spentThisMonth: spentThisMonth,
                budgetPct: budgetPct,
                weekly: weekly,
                netCashFlow: netCashFlow
            )

            state = glance.isEmpty ? .empty : .loaded(glance)
        }
    }
}

// MARK: - Value type

private struct Glance {
    let spentThisMonth: Decimal?
    let budgetPct: Double?          // optional overlay on the month tile
    let weekly: WeeklyComparison?
    let netCashFlow: Decimal?

    var hasMonth: Bool { spentThisMonth != nil }
    var hasWeekly: Bool { weekly != nil }
    var hasNet: Bool { netCashFlow != nil }

    var isEmpty: Bool { !hasMonth && !hasWeekly && !hasNet }

    var activeTileCount: Int {
        [hasMonth, hasWeekly, hasNet].filter { $0 }.count
    }
}

// MARK: - Tile: Spent this month

private struct MonthTile: View {
    let spent: Decimal
    let budgetPct: Double?   // nil when no budgets are set

    private var captionColor: Color {
        guard let p = budgetPct else { return Theme.inkTertiary }
        return p >= 0.9 ? Theme.warning : Theme.inkTertiary
    }

    var body: some View {
        Card(padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Spent").hiveLabelStyle()
                MoneyText(amount: spent, size: 18, weight: .semibold)
                Group {
                    if let pct = budgetPct {
                        Text("\(Int((pct * 100).rounded()))% of budget")
                    } else {
                        Text("so far this month")
                    }
                }
                .font(.hiveBody(11))
                .foregroundStyle(captionColor)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Spent this month")
        .accessibilityValue(spent.formatted(.currency(code: "USD").precision(.fractionLength(0))))
    }
}

// MARK: - Tile: This Week

private struct WeeklyTile: View {
    let weekly: WeeklyComparison

    /// The backend now sends a same-elapsed-days delta; `deltaPct == 0` means there's no
    /// comparable prior spend, so we hide the delta rather than show a misleading 0%/−100%.
    private var showDelta: Bool { weekly.deltaPct != 0 }
    private var hasSpark: Bool { weekly.thisWeekDays.contains { $0.total > 0 } }
    private var deltaUp: Bool { weekly.delta > 0 }
    private var deltaColor: Color { deltaUp ? Theme.expense : Theme.income }
    private var deltaText: String {
        "\(deltaUp ? "▲" : "▼") \(Int(Swift.abs(weekly.deltaPct).rounded()))% vs last week"
    }

    var body: some View {
        Card(padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("This week").hiveLabelStyle()
                MoneyText(amount: weekly.thisWeekTotal, size: 18, weight: .semibold)
                if hasSpark {
                    Chart(weekly.thisWeekDays) { day in
                        BarMark(
                            x: .value("Day", day.date),
                            y: .value("Spend", (day.total as NSDecimalNumber).doubleValue)
                        )
                        .foregroundStyle(Theme.blue)
                        .cornerRadius(2)
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 24)
                    .accessibilityHidden(true)
                }
                Text(showDelta ? deltaText : "so far this week")
                    .font(.hiveBody(11))
                    .foregroundStyle(showDelta ? deltaColor : Theme.inkTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Spent this week")
        .accessibilityValue(
            weekly.thisWeekTotal.formatted(.currency(code: "USD").precision(.fractionLength(0)))
            + (showDelta ? ", \(deltaText)" : "")
        )
    }
}

// MARK: - Tile: Net Cash Flow

private struct NetCashFlowTile: View {
    let netCashFlow: Decimal

    private var isPositive: Bool { netCashFlow >= 0 }

    var body: some View {
        Card(padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Net this month")
                    .hiveLabelStyle()

                MoneyText(amount: netCashFlow, size: 15, weight: .semibold, signed: true)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, Theme.Spacing.xs)
                    .accessibilityLabel("Net cash flow this month")
                    .accessibilityValue(netCashFlow.formatted(.currency(code: "USD").precision(.fractionLength(0))))

                Text("income − spend")
                    .font(.hiveBody(10))
                    .foregroundStyle(Theme.inkTertiary)
                    .lineLimit(1)
            }
        }
    }
}
