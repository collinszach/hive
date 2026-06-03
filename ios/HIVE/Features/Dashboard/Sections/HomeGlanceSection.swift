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
                    if let pct = glance.budgetPct,
                       let spent = glance.budgetSpent,
                       let total = glance.budgetTotal {
                        BudgetTile(pct: pct, spent: spent, total: total)
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
            .frame(height: 140)
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

            // Budgets — do/catch on auth expiry, then try? for everything else
            var budgetPct: Double? = nil
            var budgetSpent: Decimal? = nil
            var budgetTotal: Decimal? = nil
            do {
                let budgets = try await api.send(
                    .get("/api/budgets", query: [URLQueryItem(name: "month", value: monthString)]),
                    as: [BudgetDTO].self
                )
                let total = budgets.map(\.effectiveBudget).reduce(0, +)
                let spent = budgets.map(\.actualSpend).reduce(0, +)
                budgetTotal = total
                budgetSpent = spent
                let totalDouble = (total as NSDecimalNumber).doubleValue
                budgetPct = totalDouble > 0
                    ? (spent as NSDecimalNumber).doubleValue / totalDouble
                    : nil
            } catch let error as APIError where error.isAuthExpiry {
                state = .failed(error)
                onAuthExpired()
                return
            } catch {
                // Non-auth failure — leave budget tiles nil, continue
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

            // Net cash flow: only meaningful when income > 0
            var netCashFlow: Decimal? = nil
            if let inc = income, let sum = summary, inc.totalIncome > 0 {
                netCashFlow = inc.totalIncome - sum.totalSpend
            }

            let glance = Glance(
                budgetPct: budgetPct,
                budgetSpent: budgetSpent,
                budgetTotal: budgetTotal,
                weekly: weekly,
                netCashFlow: netCashFlow
            )

            state = glance.isEmpty ? .empty : .loaded(glance)
        }
    }
}

// MARK: - Value type

private struct Glance {
    let budgetPct: Double?
    let budgetSpent: Decimal?
    let budgetTotal: Decimal?
    let weekly: WeeklyComparison?
    let netCashFlow: Decimal?

    var hasBudget: Bool { budgetPct != nil && budgetSpent != nil && budgetTotal != nil }
    var hasWeekly: Bool { weekly != nil }
    var hasNet: Bool { netCashFlow != nil }

    var isEmpty: Bool { !hasBudget && !hasWeekly && !hasNet }

    var activeTileCount: Int {
        [hasBudget, hasWeekly, hasNet].filter { $0 }.count
    }
}

// MARK: - Tile: Budget Used

private struct BudgetTile: View {
    let pct: Double
    let spent: Decimal
    let total: Decimal

    private var ringColor: Color { pct >= 0.9 ? Theme.warning : Theme.blue }
    private var clampedPct: Double { min(pct, 1.0) }

    var body: some View {
        Card(padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Budget used")
                    .hiveLabelStyle()

                // Ring
                ZStack {
                    Circle()
                        .stroke(Theme.borderDefault, lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: clampedPct)
                        .stroke(ringColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.6), value: clampedPct)
                    Text("\(Int(pct * 100))%")
                        .font(.hiveMono(15, weight: .semibold))
                        .foregroundStyle(ringColor)
                }
                .frame(width: 56, height: 56)
                .frame(maxWidth: .infinity, alignment: .center)
                .accessibilityElement()
                .accessibilityLabel("Budget used")
                .accessibilityValue("\(Int(pct * 100)) percent")

                Text("\(spent.formatted(.currency(code: "USD").precision(.fractionLength(0)))) / \(total.formatted(.currency(code: "USD").precision(.fractionLength(0))))")
                    .font(.hiveMono(10))
                    .foregroundStyle(Theme.inkTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }
}

// MARK: - Tile: This Week

private struct WeeklyTile: View {
    let weekly: WeeklyComparison

    private var deltaUp: Bool { weekly.delta > 0 }
    private var deltaColor: Color { deltaUp ? Theme.expense : Theme.income }
    private var deltaArrow: String { deltaUp ? "▲" : "▼" }
    private var deltaPctFormatted: String {
        let abs = Swift.abs(weekly.deltaPct)
        return "\(deltaArrow) \(Int(abs.rounded()))% vs last"
    }

    var body: some View {
        Card(padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("This week")
                    .hiveLabelStyle()

                if weekly.thisWeekDays.isEmpty {
                    // No day-level data — just show the total
                    MoneyText(amount: weekly.thisWeekTotal, size: 15, weight: .semibold)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, Theme.Spacing.xs)
                } else {
                    Chart(weekly.thisWeekDays) { day in
                        BarMark(
                            x: .value("Day", day.date),
                            y: .value("Spend", (day.total as NSDecimalNumber).doubleValue)
                        )
                        .foregroundStyle(Theme.blue)
                        .cornerRadius(3)
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 44)
                    .accessibilityElement()
                    .accessibilityLabel("Daily spend this week")
                    .accessibilityValue(weekly.thisWeekDays.map {
                        "\($0.date): \($0.total.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
                    }.joined(separator: ", "))
                }

                Text(deltaPctFormatted)
                    .font(.hiveBody(10))
                    .foregroundStyle(deltaColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
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
