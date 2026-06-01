import Foundation

/// Mirrors `DashboardSummary` from backend `app/api/dashboard.py`. Money fields are
/// `Decimal` (the JSON numeric literal decodes exactly into Decimal) — never Double.
struct DashboardSummary: Decodable {
    let month: String
    let totalSpend: Decimal
    let topCategories: [CategorySpend]
    let accounts: [AccountSummary]
    let unreviewedAnomalies: AnomalySummary
}

struct CategorySpend: Decodable, Identifiable {
    let category: String
    let total: Decimal
    var id: String { category }
}

struct AccountSummary: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let currentBalance: Decimal?
    let cardSlug: String?
}

struct AnomalySummary: Decodable {
    let count: Int
    let latestReason: String?
}
