import SwiftUI
import Observation

/// Owns the app-lock lifecycle: whether the lock is enabled, the re-lock timeout, and
/// the current locked/authenticating state. Injected at the root so `RootView` can gate
/// signed-in content and `SettingsView` can toggle it.
///
/// This guards the *existing* session behind device biometrics — it is not a second
/// sign-in. Preference + timeout persist in `UserDefaults`; nothing sensitive is stored.
@MainActor
@Observable
final class LockState {
    private enum Keys {
        static let enabled = "app_lock_enabled"
        static let timeout = "app_lock_timeout_minutes"
    }

    /// Whether app-lock is on. Persisted on change.
    private(set) var isEnabled: Bool
    /// Minutes the app may be backgrounded before it re-locks. Persisted on change.
    var timeoutMinutes: Int {
        didSet { defaults.set(timeoutMinutes, forKey: Keys.timeout) }
    }

    /// True when the lock screen should cover signed-in content.
    private(set) var isLocked: Bool
    /// True while a biometric prompt is in flight (prevents overlapping prompts).
    private(set) var isAuthenticating = false

    /// When the app entered the background, to measure elapsed time on return.
    private var backgroundedAt: Date?
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let enabled = defaults.bool(forKey: Keys.enabled)
        self.isEnabled = enabled
        let stored = defaults.integer(forKey: Keys.timeout)
        self.timeoutMinutes = stored == 0 ? 5 : stored  // default: 5 minutes
        // A cold launch with lock on must require auth before content shows.
        self.isLocked = enabled
    }

    var biometryLabel: String { BiometricAuth.biometryLabel() }
    var isBiometryAvailable: Bool { BiometricAuth.isAvailable }

    /// Toggle the lock from Settings. Enabling requires a successful auth first — that
    /// both confirms biometrics actually work and prevents enabling a lock you can't open.
    /// On a confirmed enable the app is left unlocked (the user is actively using it).
    func setEnabled(_ on: Bool) async {
        if on {
            guard await authenticate() else { return }  // toggle stays off on failure
        }
        isEnabled = on
        defaults.set(on, forKey: Keys.enabled)
        isLocked = false
    }

    /// React to scene-phase changes. Records background time and, on return to active,
    /// re-locks if the timeout has elapsed. Auto-prompting is owned by `LockScreenView`.
    func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background:
            backgroundedAt = Date()
        case .active:
            if isEnabled, let since = backgroundedAt {
                let elapsed = Date().timeIntervalSince(since)
                if elapsed >= Double(timeoutMinutes) * 60 { isLocked = true }
            }
            backgroundedAt = nil
        default:
            break
        }
    }

    /// Run the biometric / passcode prompt; clears the lock on success. Guards against
    /// overlapping calls. Returns the outcome so callers can react.
    @discardableResult
    func authenticate() async -> Bool {
        guard !isAuthenticating else { return false }
        isAuthenticating = true
        defer { isAuthenticating = false }
        let ok = await BiometricAuth.authenticate(reason: "Unlock HIVE")
        if ok { isLocked = false }
        return ok
    }
}
