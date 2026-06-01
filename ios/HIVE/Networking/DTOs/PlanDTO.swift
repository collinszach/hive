import Foundation

// MARK: - Budgets

/// Mirrors `BudgetOut` from `backend/app/api/budgets.py`. `month` is a date string.
struct BudgetDTO: Decodable, Identifiable, Hashable {
    let id: String
    let category: String
    let month: String
    let budgetAmount: Decimal
    let rollover: Bool
    let rolloverAmount: Decimal
    let effectiveBudget: Decimal
    let actualSpend: Decimal
    let pctUsed: Double
    let remaining: Decimal
    let hasBudget: Bool

    /// Fraction 0…1+ for the progress bar (clamped at the bar, not here).
    var fraction: Double {
        let eff = (effectiveBudget as NSDecimalNumber).doubleValue
        guard eff > 0 else { return 0 }
        return (actualSpend as NSDecimalNumber).doubleValue / eff
    }
    var isOver: Bool { remaining < 0 }

    static func == (l: BudgetDTO, r: BudgetDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Body for `POST /api/budgets` (upsert). `month` is "YYYY-MM".
struct BudgetUpsert: Encodable {
    let category: String
    let month: String
    let budgetAmount: Decimal
    let rollover: Bool
}

// MARK: - Points

/// Mirrors `ProgramSummary` / `PointsSummaryResponse` from `backend/app/api/points.py`.
///
/// Decoding is deliberately tolerant: this is a self-hosted backend that can lag the
/// app, so optional/newer fields (thresholds, manual balance, total) default rather
/// than failing the whole Points screen when an older deployment omits them.
struct PointsSummary: Decodable {
    let programs: [ProgramSummary]
    let totalEstimatedValueDollars: Decimal

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        programs = try c.decodeIfPresent([ProgramSummary].self, forKey: .programs) ?? []
        totalEstimatedValueDollars = try c.decodeIfPresent(Decimal.self, forKey: .totalEstimatedValueDollars) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case programs, totalEstimatedValueDollars
    }
}

struct ProgramSummary: Decodable, Identifiable {
    let program: String
    let pointsEarned90d: Double
    let manualBalance: Int?
    let estimatedValueDollars: Decimal
    let redemptionThreshold: Int?
    let aboveThreshold: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        program = try c.decode(String.self, forKey: .program)
        pointsEarned90d = try c.decodeIfPresent(Double.self, forKey: .pointsEarned90d) ?? 0
        manualBalance = try c.decodeIfPresent(Int.self, forKey: .manualBalance)
        estimatedValueDollars = try c.decodeIfPresent(Decimal.self, forKey: .estimatedValueDollars) ?? 0
        redemptionThreshold = try c.decodeIfPresent(Int.self, forKey: .redemptionThreshold)
        aboveThreshold = try c.decodeIfPresent(Bool.self, forKey: .aboveThreshold) ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case program, pointsEarned90d, manualBalance, estimatedValueDollars, redemptionThreshold, aboveThreshold
    }

    var id: String { program }

    /// The points figure to surface: a manually-entered balance if present,
    /// otherwise points earned in the lookback window.
    var displayPoints: Int {
        if let manual = manualBalance { return manual }
        return Int(pointsEarned90d.rounded())
    }
    var hasManualBalance: Bool { manualBalance != nil }
}

/// `GET /api/points/thresholds`.
struct PointsThresholds: Decodable {
    let thresholds: [String: Int]
    let valuationsCpp: [String: Double]
}

/// One transaction-level points-earning row. Mirrors `LedgerEntryOut` from
/// `backend/app/api/points.py` (`GET /api/points/ledger`).
struct PointsLedgerEntry: Decodable, Identifiable {
    let transactionId: String
    let accountId: String
    let cardSlug: String
    let program: String
    let pointsEarned: Double
    let earnRate: Double
    let category: String?
    let subcategory: String?
    let merchant: String?
    let amount: Decimal
    let date: String

    // transactionId can repeat across programs in theory; pair with program for a stable id.
    var id: String { "\(transactionId)-\(program)" }
}
