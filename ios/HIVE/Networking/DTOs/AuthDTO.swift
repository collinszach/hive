import Foundation

/// Body for `POST /api/auth/google/native`. Carries the Google ID token obtained
/// from the GoogleSignIn SDK; the backend verifies it and returns a session JWT.
struct GoogleNativeAuthRequest: Encodable {
    let idToken: String  // encoded as `id_token` (convertToSnakeCase)
}

/// Response from the native auth + exchange endpoints. `accessToken` is decoded
/// from `access_token` (convertFromSnakeCase).
struct AuthTokenResponse: Decodable {
    let accessToken: String
    let tokenType: String
}

/// Response from `GET /api/auth/me` — the signed-in account's identity, used by the
/// Settings screen to show who's logged in and to drive the delete confirmation.
struct MeResponse: Decodable {
    let username: String
    let role: String
    let totpEnabled: Bool
    let lastLoginAt: Date?
}

/// Body for `DELETE /api/auth/account`. The user types their account name to confirm;
/// the backend rejects a mismatch. Google-only auth means there's no password to
/// re-enter, so the typed name is the deliberate-deletion guard.
struct DeleteAccountRequest: Encodable {
    let confirmUsername: String  // encoded as `confirm_username`
}
