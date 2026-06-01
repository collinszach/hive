import Foundation

/// Mirrors `AccountOut` from `backend/app/api/accounts.py`. Balances are `Decimal`.
struct AccountDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let officialName: String?
    let institution: String
    let type: String
    let subtype: String?
    let cardSlug: String?
    let currentBalance: Decimal?
    let availableBalance: Decimal?
    let creditLimit: Decimal?
    let statementBalance: Decimal?
    let mask: String?
    let isActive: Bool
    let isExcluded: Bool
    let isManual: Bool
    let currency: String

    /// Credit cards carry a liability (balance counts against net worth).
    var isCredit: Bool { type == "credit" }
    var isInvestment: Bool { type == "investment" }

    /// Net-worth classification — MUST mirror `backend/app/tasks/maintenance.py`
    /// `snapshot_net_worth`: credit / loan / mortgage are debt; everything else is an
    /// asset. (A plain `isCredit` check wrongly booked loans & mortgages as assets,
    /// which is why the Connect total diverged from the Insights snapshot.)
    var isLiability: Bool {
        ["credit", "loan", "mortgage"].contains(type.lowercased())
    }

    /// "Chase ···· 4321" style subtitle.
    var maskedLabel: String {
        if let mask, !mask.isEmpty { return "···· \(mask)" }
        return subtype?.capitalized ?? type.capitalized
    }

    static func == (l: AccountDTO, r: AccountDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Mirrors `LinkedInstitutionOut` from `GET /api/accounts/linked`.
struct LinkedInstitution: Decodable, Identifiable {
    let itemId: String
    let institutionName: String
    let lastSyncAt: String?
    let lastSyncError: String?
    let accounts: [AccountDTO]

    var id: String { itemId }
    var hasError: Bool { friendlyError != nil }

    /// A short, human-readable take on `lastSyncError`. The backend stores Plaid's raw
    /// exception (status line + headers + a JSON body), which is unreadable on a phone
    /// and floods the Connect screen. Map the common error codes to one clean line.
    var friendlyError: String? {
        guard let raw = lastSyncError, !raw.isEmpty else { return nil }
        if raw.contains("ADDITIONAL_CONSENT_REQUIRED") {
            return "Linked for balances only — this account doesn't share transaction history."
        }
        if raw.contains("ITEM_LOGIN_REQUIRED") || raw.contains("PENDING_EXPIRATION") {
            return "Sign-in expired. Reconnect this institution on the web to resume syncing."
        }
        if raw.contains("INSTITUTION_DOWN") || raw.contains("INSTITUTION_NOT_RESPONDING") {
            return "The institution is temporarily unavailable. Try syncing again later."
        }
        if raw.contains("INVALID_CREDENTIALS") || raw.contains("INVALID_MFA") {
            return "Your credentials need updating. Reconnect this institution on the web."
        }
        // Otherwise surface Plaid's own `error_message`, if present, else a short prefix.
        if let msg = Self.extractField("error_message", from: raw) { return msg }
        return String(raw.prefix(140))
    }

    /// Consent-required is benign for investment accounts (balances still sync), so the
    /// UI can render it quietly rather than as an alarming failure.
    var errorIsInformational: Bool {
        (lastSyncError?.contains("ADDITIONAL_CONSENT_REQUIRED")) == true
    }

    /// Pull a `"key": "value"` string out of a JSON-ish blob without a full parse.
    private static func extractField(_ key: String, from raw: String) -> String? {
        guard let r = raw.range(of: "\"\(key)\"") else { return nil }
        let tail = raw[r.upperBound...]
        guard let colon = tail.firstIndex(of: ":") else { return nil }
        let afterColon = tail[tail.index(after: colon)...]
        guard let open = afterColon.firstIndex(of: "\"") else { return nil }
        let valueStart = afterColon.index(after: open)
        guard let close = afterColon[valueStart...].firstIndex(of: "\"") else { return nil }
        let value = String(afterColon[valueStart..<close])
        return value.isEmpty ? nil : value
    }
}
