import Foundation

/// Response from `POST /api/plaid/link-token` — the short-lived token that
/// initializes the native Plaid Link SDK.
struct LinkTokenResponse: Decodable {
    let linkToken: String
}

/// Body for `POST /api/plaid/exchange-token` — the public token Plaid Link hands
/// back on success, which the backend swaps for a permanent access token.
struct ExchangeTokenRequest: Encodable {
    let publicToken: String
    let institutionName: String?
}

/// Response from `POST /api/plaid/exchange-token`.
struct ExchangeTokenResponse: Decodable {
    let itemId: String
    let accountsCreated: Int
}

/// Response from `POST /api/snaptrade/connect` — the hosted connection-portal URL
/// we open in an in-app Safari sheet so the user can link a brokerage.
struct SnapTradeConnectResponse: Decodable {
    let redirectUrl: String
}

/// Response from `GET /api/snaptrade/callback` — how many brokerage accounts were
/// imported after the user finished the portal.
struct SnapTradeCallbackResponse: Decodable {
    let accountsAdded: Int
}
