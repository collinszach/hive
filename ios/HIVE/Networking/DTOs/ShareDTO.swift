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

/// Body for `PATCH /api/shares/{id}/settle`. We don't wire a settlement transaction
/// from mobile yet, so this is sent empty (the field is optional server-side).
struct ShareSettle: Encodable {
    var settlementTransactionId: String? = nil
}
