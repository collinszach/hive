import SwiftUI
import Observation

/// Root session state. Owns the auth lifecycle and is injected into the
/// environment so any screen can trigger sign-out or react to expiry.
@MainActor
@Observable
final class AppState {
    enum Phase: Equatable {
        case launching   // checking Keychain
        case signedOut
        case signedIn
    }

    private(set) var phase: Phase = .launching
    /// Non-nil when the last sign-in attempt failed, for the sign-in screen to show.
    var signInError: String?
    private(set) var isSigningIn = false

    private let auth: AuthService

    init(auth: AuthService = AuthService()) {
        self.auth = auth
    }

    /// Called at launch: resume an existing session or fall to the sign-in screen.
    func bootstrap() {
        phase = auth.hasStoredSession ? .signedIn : .signedOut
    }

    func signIn() async {
        isSigningIn = true
        signInError = nil
        defer { isSigningIn = false }
        do {
            try await auth.signInWithGoogle()
            phase = .signedIn
        } catch APIError.cancelled {
            // User backed out — no error UI.
        } catch let error as APIError {
            signInError = error.userMessage
        } catch {
            signInError = "Sign-in failed. Please try again."
        }
    }

    func signOut() {
        auth.signOut()
        phase = .signedOut
    }

    /// Called when an authenticated request comes back 401 — drop to sign-in.
    func handleSessionExpired() {
        auth.signOut()
        phase = .signedOut
    }
}
