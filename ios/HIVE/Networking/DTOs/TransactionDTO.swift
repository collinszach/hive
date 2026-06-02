import Foundation

/// Mirrors `TransactionOut` / `TransactionListResponse` from `backend/app/api/transactions.py`.
///
/// Money is `Decimal` (JSON number → Decimal decodes exactly). `date` stays a
/// `String` ("YYYY-MM-DD") because the client decoder is `.iso8601` (datetime) and
/// would reject a bare date — the view layer parses it for grouping/display.
///
/// Amount convention (backend): **positive = spend / outflow**, negative = credit /
/// refund / inflow. The UI colors credits green and leaves spend neutral.
struct TransactionDTO: Decodable, Identifiable, Hashable {
    let id: String
    let accountName: String?
    let cardSlug: String?
    let date: String
    let amount: Decimal
    let currency: String
    let merchant: String?
    let rawDescription: String
    let category: String?
    let subcategory: String?
    let categorySource: String
    let isTransfer: Bool
    let isExcluded: Bool
    let pending: Bool
    let paymentChannel: String?
    let locationCity: String?
    let locationState: String?
    let logoUrl: String?
    let notes: String?

    /// Best human label: merchant, else the raw bank descriptor.
    var displayName: String {
        if let m = merchant, !m.isEmpty { return m }
        return rawDescription
    }

    /// A credit/refund/inflow (shown green). Spend is positive in this backend.
    var isCredit: Bool { amount < 0 }

    static func == (l: TransactionDTO, r: TransactionDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

struct TransactionListResponse: Decodable {
    let items: [TransactionDTO]
    let total: Int
    let totalAmount: Decimal
    let page: Int
    let pageSize: Int
    let pages: Int
}

/// `GET /api/transactions/categories` row.
struct CategoryCount: Decodable, Identifiable {
    let category: String
    let count: Int
    var id: String { category }
}

/// Body for `PUT /api/transactions/{id}/category`. `Codable` so the same type can
/// decode the echo response (`{id, category, subcategory}`; extra keys are ignored).
struct CategoryUpdate: Codable {
    let category: String
    let subcategory: String
}

/// Partial update body for `PATCH /api/transactions/{id}`. Only non-nil fields are
/// sent (the encoder skips nil), so this doubles as a notes-only or merchant-only patch.
struct TransactionPatch: Encodable {
    var merchant: String?
    var category: String?
    var subcategory: String?
    var notes: String?
}

/// Body for `POST /api/transactions` (manual cash/reimbursement entry). Mirrors
/// `ManualTransactionRequest`. `date` is a "YYYY-MM-DD" string; `amount` follows the
/// backend sign convention (positive = spend, negative = income/credit). Nil optional
/// fields are skipped by the encoder. Field names convert to snake_case on the wire.
struct ManualTransactionRequest: Encodable {
    let date: String
    let amount: Decimal
    let merchant: String
    var category: String?
    var subcategory: String?
    var notes: String?
}

// MARK: - Category splits

/// One leg of a category split. Mirrors `SplitOut` from `backend/app/api/splits.py`.
struct SplitDTO: Decodable, Identifiable, Hashable {
    let id: String
    let transactionId: String
    let amount: Decimal
    let category: String?
    let subcategory: String?
    let notes: String?
    let sortOrder: Int

    static func == (l: SplitDTO, r: SplitDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// One leg to send when replacing splits (`PUT /{id}/splits`). Amount must be > 0
/// and the legs must sum to the transaction's amount (±0.02), per the backend.
struct SplitInput: Encodable {
    var amount: Decimal
    var category: String?
    var subcategory: String?
    var notes: String?
}

struct SetSplitsRequest: Encodable {
    let splits: [SplitInput]
}
