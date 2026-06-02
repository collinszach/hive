import Foundation

/// Typed failures surfaced to view models so each screen can render a precise
/// error+retry state. `userMessage` is safe to show; it never contains a token,
/// balance, or other PII.
enum APIError: Error, Equatable {
    case notAuthenticated          // no/expired session — bounce to sign-in
    case unauthorized              // 401 from server
    case forbidden                 // 403
    case paymentRequired           // 402 — feature needs an upgraded plan (e.g. Pro)
    case notFound                  // 404
    case server(status: Int)       // 5xx
    case decoding                  // response didn't match the expected shape
    case network                   // transport failure / offline
    case cancelled

    var userMessage: String {
        switch self {
        case .notAuthenticated, .unauthorized: return "Your session expired. Please sign in again."
        case .forbidden: return "You don't have access to this."
        case .paymentRequired: return "This feature requires the Pro plan."
        case .notFound: return "We couldn't find that."
        case .server: return "Something went wrong on our end. Try again."
        case .decoding: return "We couldn't read the response. Try again."
        case .network: return "You appear to be offline. Check your connection."
        case .cancelled: return "Request cancelled."
        }
    }

    /// Whether a retry button makes sense for this failure.
    var isRetryable: Bool {
        switch self {
        case .server, .decoding, .network: return true
        case .notAuthenticated, .unauthorized, .forbidden, .paymentRequired, .notFound, .cancelled: return false
        }
    }
}
