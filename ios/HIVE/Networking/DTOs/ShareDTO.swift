import Foundation

/// A person you split charges with. Mirrors `ContactOut` from `backend/app/api/contacts.py`.
struct ContactDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
}

/// Body for `POST /api/contacts`.
struct ContactCreate: Encodable {
    let name: String
}

/// One "someone owes me for this charge" record. Mirrors `ShareOut` from
/// `backend/app/api/shares.py`. Distinct from category `SplitDTO`: a share assigns
/// part of a charge to another *person* and tracks reimbursement (pending → settled).
struct ExpenseShareDTO: Decodable, Identifiable, Hashable {
    let id: String
    let transactionId: String
    let contactId: String
    let contactName: String
    let amount: Decimal
    let note: String?
    let status: String              // "pending" | "settled"
    let settledAt: String?
    let settlementTransactionId: String?
    let createdAt: String
    // Present on the /shares/pending and /shares/settled feeds (joined transaction).
    let transactionDate: String?
    let transactionMerchant: String?
    let transactionAmount: Decimal?

    var isSettled: Bool { status == "settled" }

    static func == (l: ExpenseShareDTO, r: ExpenseShareDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Body for `POST /api/transactions/{id}/shares`. Amount must be > 0.
struct ShareCreate: Encodable {
    let contactId: String
    let amount: Decimal
    let note: String?
}

/// Body for `PATCH /api/shares/{id}/settle`. `settlementTransactionId` links the
/// repayment that cleared this share; nil means it was settled outside HIVE (cash, a
/// Venmo balance never cashed out) and there's no transaction to point at.
struct ShareSettle: Encodable {
    var settlementTransactionId: String? = nil
}

/// Body for `PATCH /api/shares/settle-batch` — one repayment clearing several shares,
/// which is how people actually settle up (a month's shares in a single transfer).
struct SettleBatch: Encodable {
    let shareIds: [String]
    var settlementTransactionId: String? = nil
}

/// A plausible repayment for a share. Mirrors `SettlementCandidate` from
/// `backend/app/api/shares.py`. `amount` is positive — money that came in.
struct SettlementCandidateDTO: Decodable, Identifiable, Hashable {
    let transactionId: String
    let date: String
    let description: String
    let amount: Decimal
    /// "exact" | "batch" | "name" | "recent" — why it's being offered, best first.
    let match: String

    var id: String { transactionId }

    /// Short label for the match tier, or nil for an unremarkable recent inflow.
    var matchLabel: String? {
        switch match {
        case "exact":  return "Exact amount"
        case "batch":  return "Clears their balance"
        case "name":   return "Name matches"
        default:       return nil
        }
    }

    static func == (l: SettlementCandidateDTO, r: SettlementCandidateDTO) -> Bool {
        l.transactionId == r.transactionId
    }
    func hash(into h: inout Hasher) { h.combine(transactionId) }
}
