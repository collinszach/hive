import Foundation
import UIKit
import GoogleSignIn

/// Drives the native Google sign-in round-trip:
///   GoogleSignIn SDK → Google ID token → `POST /api/auth/google/native`
///   → our session JWT → Keychain.
///
/// The session JWT lives only in the Keychain; it's never logged or put in a URL.
@MainActor
struct AuthService {
    let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Present the Google consent flow, exchange the ID token for our JWT, persist it.
    func signInWithGoogle() async throws {
        guard let presenter = Self.topViewController() else {
            throw APIError.network
        }

        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        } catch {
            // User cancellation or SDK failure — treat as a non-fatal cancel.
            throw APIError.cancelled
        }

        guard let idToken = result.user.idToken?.tokenString else {
            throw APIError.notAuthenticated
        }

        let response = try await api.send(
            Endpoint(method: .post, path: "/api/auth/google/native", requiresAuth: false),
            body: GoogleNativeAuthRequest(idToken: idToken),
            as: AuthTokenResponse.self
        )

        guard KeychainStore.set(response.accessToken, for: .sessionToken) else {
            throw APIError.notAuthenticated
        }
    }

    /// Clear the local session and the Google SDK's cached sign-in.
    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        KeychainStore.delete(.sessionToken)
    }

    /// Whether a session token is already present (used at launch to skip sign-in).
    var hasStoredSession: Bool {
        KeychainStore.get(.sessionToken) != nil
    }

    // MARK: - Presenter lookup

    /// The frontmost view controller to present the Google sheet from.
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
