import Foundation
import Observation

@MainActor
@Observable
final class PlanViewModel {
    private(set) var budgetsState: LoadState<[BudgetDTO]> = .loading
    private(set) var pointsState: LoadState<PointsSummary> = .loading
    private(set) var thresholds: [String: Int] = [:]

    var month: String = MonthHelper.current

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    // MARK: Budgets

    func loadBudgets() async {
        if budgetsState.value == nil { budgetsState = .loading }
        do {
            let budgets = try await api.send(
                .get("/api/budgets", query: [.init(name: "month", value: month)]),
                as: [BudgetDTO].self
            )
            budgetsState = budgets.isEmpty ? .empty : .loaded(budgets)
        } catch let error as APIError {
            budgetsState = .failed(error)
        } catch {
            budgetsState = .failed(.network)
        }
    }

    /// Create or update a budget for `category` in the current `month`, then reload.
    /// Returns true on success so the editor can dismiss / show an error.
    @discardableResult
    func saveBudget(category: String, amount: Decimal, rollover: Bool) async -> Bool {
        do {
            try await api.send(
                .post("/api/budgets"),
                body: BudgetUpsert(category: category, month: month, budgetAmount: amount, rollover: rollover)
            )
            Haptics.success()
            await loadBudgets()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    /// Delete a budget row by id, then reload.
    @discardableResult
    func deleteBudget(id: String) async -> Bool {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/budgets/\(id)"))
            Haptics.success()
            await loadBudgets()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    /// Categories that don't yet have a budget this month — the pickable set when
    /// adding a new budget. (Rows with `hasBudget == false` are spend-only suggestions.)
    var unbudgetedCategories: [String] {
        let budgeted = Set((budgetsState.value ?? []).filter(\.hasBudget).map(\.category))
        return Taxonomy.categories.filter { $0 != "Uncategorized" && !budgeted.contains($0) }
    }

    // MARK: Points

    func loadPoints() async {
        if pointsState.value == nil { pointsState = .loading }

        // Thresholds drive only the "ready to redeem" nudge — a nicety. Load them
        // best-effort so a thresholds hiccup can NEVER blank the rewards screen.
        // (Previously summary + thresholds were awaited together, so either one
        // failing left Points showing nothing.)
        if let t = try? await api.send(.get("/api/points/thresholds"), as: PointsThresholds.self) {
            thresholds = t.thresholds
        }

        do {
            let s = try await api.send(.get("/api/points/summary"), as: PointsSummary.self)
            pointsState = s.programs.isEmpty ? .empty : .loaded(s)
        } catch let error as APIError {
            pointsState = .failed(error)
        } catch {
            pointsState = .failed(.network)
        }
    }

    /// True when a program's surfaced points cross its redemption threshold.
    func isAboveThreshold(_ program: ProgramSummary) -> Bool {
        guard let t = thresholds[program.program] else { return false }
        return program.displayPoints >= t
    }

    // Aggregate budget figures for the hero.
    var totalBudgeted: Decimal {
        (budgetsState.value ?? []).reduce(0) { $0 + $1.effectiveBudget }
    }
    var totalSpent: Decimal {
        (budgetsState.value ?? []).reduce(0) { $0 + $1.actualSpend }
    }
}
