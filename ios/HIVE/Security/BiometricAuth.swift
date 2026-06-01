import Foundation
import LocalAuthentication

/// Thin wrapper over `LocalAuthentication`. Uses `.deviceOwnerAuthentication`, which is
/// Face ID / Touch ID with an automatic device-passcode fallback — so a user whose
/// biometrics fail (or who has none enrolled) can still get in with their passcode.
enum BiometricAuth {

    /// Whether the device can authenticate the owner at all (biometrics or passcode).
    static var isAvailable: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    /// Human label for the available biometry, for the Settings toggle ("Face ID",
    /// "Touch ID", "Optic ID"), falling back to "Passcode" when no biometry is enrolled.
    static func biometryLabel() -> String {
        let ctx = LAContext()
        // biometryType is only populated after a canEvaluatePolicy probe.
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
        switch ctx.biometryType {
        case .faceID:  return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default:       return "Passcode"
        }
    }

    /// Present the biometric / passcode prompt. Returns true only on a successful
    /// evaluation; any error or user cancel resolves to false (content stays hidden).
    static func authenticate(reason: String) async -> Bool {
        let ctx = LAContext()
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else { return false }
        return await withCheckedContinuation { continuation in
            ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
                continuation.resume(returning: success)
            }
        }
    }
}
