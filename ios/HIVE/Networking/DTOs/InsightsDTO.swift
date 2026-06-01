import Foundation

// MARK: - Anomalies

/// Mirrors `AnomalyOut` from `backend/app/api/anomalies.py`.
struct AnomalyDTO: Decodable, Identifiable, Hashable {
    let id: String
    let transactionId: String
    let anomalyScore: Double
    let reason: String
    let status: String
    let flaggedAt: String
    let transaction: AnomalyTransaction?

    static func == (l: AnomalyDTO, r: AnomalyDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

struct AnomalyTransaction: Decodable, Hashable {
    let id: String
    let date: String
    let amount: Decimal
    let merchant: String?
    let rawDescription: String
    let category: String?
    let subcategory: String?

    var displayName: String {
        if let m = merchant, !m.isEmpty { return m }
        return rawDescription
    }
}

/// Body for `POST /api/anomalies/{id}/review`.
struct AnomalyReview: Encodable {
    let status: String  // "ok" | "confirmed"
}

// MARK: - Net worth

/// Mirrors `SnapshotOut` from `backend/app/api/net_worth.py`.
struct NetWorthSnapshot: Decodable, Identifiable {
    let snapshotDate: String
    let totalAssets: Decimal
    let totalLiabilities: Decimal
    let netWorth: Decimal
    /// Per-account contributions, keyed `"<Account> (asset)"` / `"<Account> (liability)"`.
    /// Used to compute *organic* month-over-month change (ignores accounts that weren't
    /// present in both snapshots, so newly-linked accounts don't read as growth).
    let breakdown: [String: Decimal]?

    var id: String { snapshotDate }

    /// Parsed date for charting (snapshots are "YYYY-MM-DD").
    var date: Date? { DateOnly.parse(snapshotDate) }
}

// MARK: - Points leakage ("money left on the table")

/// Mirrors `LeakageResponse` from `backend/app/api/points.py`.
struct LeakageResponse: Decodable {
    let entries: [LeakageEntry]
    let totalLeakageDollars: Decimal
    let transactionCount: Int
    let days: Int
}

struct LeakageEntry: Decodable, Identifiable {
    let transactionId: String
    let merchant: String?
    let date: String
    let amount: Decimal
    let category: String?
    let subcategory: String?
    let actualCardSlug: String
    let actualEarnRate: Double
    let actualPoints: Double
    let actualValueDollars: Decimal
    let bestCardSlug: String
    let bestProgram: String
    let bestEarnRate: Double
    let bestPoints: Double
    let bestValueDollars: Decimal
    let leakageDollars: Decimal

    var id: String { transactionId }

    /// Points you'd have earned on the best card minus what you actually earned.
    var pointsLost: Double { max(0, bestPoints - actualPoints) }
}
