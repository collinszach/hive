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
    /// Award-fee candidates awaiting review. While non-zero, balances are overstated
    /// by whatever those redemptions cost.
    let unreviewedRedemptions: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        programs = try c.decodeIfPresent([ProgramSummary].self, forKey: .programs) ?? []
        totalEstimatedValueDollars = try c.decodeIfPresent(Decimal.self, forKey: .totalEstimatedValueDollars) ?? 0
        unreviewedRedemptions = try c.decodeIfPresent(Int.self, forKey: .unreviewedRedemptions) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case programs, totalEstimatedValueDollars, unreviewedRedemptions
    }
}

/// A redemption: points spent. Mirrors `RedemptionOut` from `backend/app/api/points.py`.
///
/// Candidates come from the award-fee detector — an award booking pays the fare in
/// points, so only taxes reach the card and that small charge is the only trace.
struct RedemptionDTO: Decodable, Identifiable, Hashable {
    let id: String
    let transactionId: String?
    let program: String?
    let pointsSpent: Double?
    let cashValueAvoided: Decimal?
    let feesPaid: Decimal
    let redeemedOn: String
    let merchant: String?
    let status: String
    let detectionReason: String?
    let note: String?
    /// Value actually extracted, cents per point. Nil unless both sides are known.
    let centsPerPoint: Double?
    /// Plain-language reason this was flagged, for the review queue.
    let explanation: String

    var isCandidate: Bool { status == "candidate" }

    static func == (l: RedemptionDTO, r: RedemptionDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Body for `POST /api/points/redemptions/{id}/confirm`.
struct RedemptionConfirm: Encodable {
    let program: String
    let pointsSpent: Double
    var cashValueAvoided: Double? = nil
    var note: String? = nil
}

struct ProgramSummary: Decodable, Identifiable {
    let program: String
    let pointsEarned90d: Double
    let manualBalance: Int?
    let estimatedValueDollars: Decimal
    let redemptionThreshold: Int?
    let aboveThreshold: Bool
    /// ISO date the manual snapshot was taken (nil when none has been entered).
    let balanceAsOf: String?
    /// Points earned since that snapshot.
    let pointsSinceBalance: Double
    /// Confirmed redemptions since that snapshot, already subtracted from `currentBalance`.
    let pointsRedeemedSince: Double
    /// Snapshot rolled forward by points earned since — the figure to display.
    let currentBalance: Int?
    /// `currentBalance` was carried forward, so it can't account for redemptions
    /// or transfers out since the snapshot. Present it as approximate.
    let isEstimated: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        program = try c.decode(String.self, forKey: .program)
        pointsEarned90d = try c.decodeIfPresent(Double.self, forKey: .pointsEarned90d) ?? 0
        manualBalance = try c.decodeIfPresent(Int.self, forKey: .manualBalance)
        estimatedValueDollars = try c.decodeIfPresent(Decimal.self, forKey: .estimatedValueDollars) ?? 0
        redemptionThreshold = try c.decodeIfPresent(Int.self, forKey: .redemptionThreshold)
        aboveThreshold = try c.decodeIfPresent(Bool.self, forKey: .aboveThreshold) ?? false
        balanceAsOf = try c.decodeIfPresent(String.self, forKey: .balanceAsOf)
        pointsSinceBalance = try c.decodeIfPresent(Double.self, forKey: .pointsSinceBalance) ?? 0
        pointsRedeemedSince = try c.decodeIfPresent(Double.self, forKey: .pointsRedeemedSince) ?? 0
        currentBalance = try c.decodeIfPresent(Int.self, forKey: .currentBalance)
        isEstimated = try c.decodeIfPresent(Bool.self, forKey: .isEstimated) ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case program, pointsEarned90d, manualBalance, estimatedValueDollars, redemptionThreshold, aboveThreshold
        case balanceAsOf, pointsSinceBalance, pointsRedeemedSince, currentBalance, isEstimated
    }

    var id: String { program }

    /// The points figure to surface: the snapshot rolled forward by everything
    /// earned since, else the raw snapshot, else points earned in the window.
    var displayPoints: Int {
        if let current = currentBalance { return current }
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

// MARK: - Card optimizer

/// `GET /api/points/optimize?category=&subcategory=&amount=`. Mirrors
/// `OptimizerResponse` from `backend/app/api/points.py` — "which card at checkout?".
struct OptimizerResponse: Decodable {
    let category: String?
    let subcategory: String?
    let amount: Decimal
    let cards: [CardOption]
}

/// One ranked card for a hypothetical purchase. Mirrors `CardOptionOut`.
/// Cards arrive pre-ranked by redemption value across programs; `isBest` flags
/// the top pick. The UI deliberately leads with points + earn rate, not dollars.
struct CardOption: Decodable, Identifiable {
    let cardSlug: String
    let accountName: String?
    let program: String
    let earnRate: Double
    let pointsEarned: Double
    let dollarValue: Decimal
    let isBest: Bool

    var id: String { cardSlug }
}
