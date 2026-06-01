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
