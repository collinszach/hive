import Foundation

// MARK: - Home screen DTOs (Home build-out, docs/ios/HOME-SCREEN-SPEC.md)
//
// Shared decodables for the composed Home sections. The APIClient decoder uses
// `.convertFromSnakeCase`, so snake_case JSON maps onto these camelCase fields
// automatically — no CodingKeys needed. Money is `Decimal` end-to-end.

// MARK: H1 — Safe to spend (`GET /api/dashboard/safe-to-spend`)

struct SafeToSpend: Decodable {
    let safeToSpend: Decimal
    let color: String              // "green" | "amber" | "red"
    let breakdown: SafeToSpendBreakdown
    let daysRemaining: Int
}

struct SafeToSpendBreakdown: Decodable {
    let monthlyIncome: Decimal
    let spentThisMonth: Decimal
    let upcomingBills: Decimal
    let goalSavings: Decimal
}

// MARK: H2 — Attention feed sources

/// `GET /api/dashboard/pace-alerts` — a category projected to blow its budget.
struct PaceAlert: Decodable, Identifiable {
    let category: String
    let budgetAmount: Decimal
    let actualSpend: Decimal
    let projectedSpend: Decimal
    let daysElapsed: Int
    let daysInMonth: Int
    let overBy: Decimal            // projected − budget (positive = overspend)
    let pctProjected: Double       // projected / budget * 100
    let severity: String           // "warning" | "danger"
    var id: String { category }
}

/// `GET /api/subscriptions/upcoming?days=` — a bill due soon. Only the fields Home needs;
/// extra keys in the payload are ignored by the decoder.
struct UpcomingBill: Decodable, Identifiable {
    let id: String
    let merchantName: String?
    let normalizedName: String?
    let amount: Decimal
    let nextExpected: String?
    let daysAway: Int
    let status: String             // "today" | "soon" | "upcoming"

    var name: String { merchantName ?? normalizedName ?? "Subscription" }
}

// MARK: H3 — Month at a glance (`GET /api/dashboard/weekly-comparison`, `/api/income/summary`)

struct WeeklyComparison: Decodable {
    let thisWeekTotal: Decimal
    let lastWeekTotal: Decimal
    let delta: Decimal             // this − last (positive = more spent this week)
    let deltaPct: Double
    let daysElapsedThisWeek: Int
    let thisWeekDays: [DailySpend]
    let lastWeekDays: [DailySpend]
}

struct DailySpend: Decodable, Identifiable {
    let date: String               // YYYY-MM-DD
    let total: Decimal
    let count: Int
    var id: String { date }
}

struct IncomeSummary: Decodable {
    let month: String
    let totalIncome: Decimal
}

// MARK: H6 — Goals (`GET /api/goals`)
//
// NOTE: verify field names against the live `/api/goals` payload when implementing H6.
struct GoalDTO: Decodable, Identifiable {
    let id: Int
    let name: String
    let targetAmount: Decimal
    let currentAmount: Decimal

    /// Completion fraction clamped to 0…1.
    var fraction: Double {
        let target = (targetAmount as NSDecimalNumber).doubleValue
        guard target > 0 else { return 0 }
        let cur = (currentAmount as NSDecimalNumber).doubleValue
        return min(max(cur / target, 0), 1)
    }
}
