import Foundation
import LocalAuthentication

/// Thin wrapper over `LocalAuthentication`. Uses `.deviceOwnerAuthenticationWithBiometrics`
/// — Face ID / Touch ID / Optic ID with **no** device-passcode fallback. The app opens only
/// for an enrolled face/fingerprint; a non-matching face cannot get in. (Account sign-in
/// remains the ultimate recovery path, since this lock guards an existing session.)
enum BiometricAuth {

    /// Whether the device has biometrics enrolled and usable. Passcode-only devices return
    /// false here — by design, since we never fall back to a passcode.
    static var isAvailable: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    /// Human label for the available biometry, for the Settings toggle ("Face ID",
    /// "Touch ID", "Optic ID"). Defaults to "Face ID" when the type can't be probed.
    static func biometryLabel() -> String {
        let ctx = LAContext()
        // biometryType is only populated after a canEvaluatePolicy probe.
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch ctx.biometryType {
        case .faceID:  return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default:       return "Face ID"
        }
    }

    /// Present the biometrics-only prompt. Returns true only on a successful biometric
    /// match; any error, passcode attempt, or user cancel resolves to false (content
    /// stays hidden). No passcode fallback is offered.
    static func authenticate(reason: String) async -> Bool {
        let ctx = LAContext()
        // Suppress the system's passcode-fallback affordance entirely.
        ctx.localizedFallbackTitle = ""
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else { return false }
        return await withCheckedContinuation { continuation in
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, _ in
                continuation.resume(returning: success)
            }
        }
    }
}
