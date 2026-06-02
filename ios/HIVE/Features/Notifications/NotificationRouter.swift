import SwiftUI
import Observation

/// Bridges a push-notification tap to a tab selection. The app delegate writes a
/// `pending` route when the user opens a notification; `MainTabView` observes it and
/// switches tabs, then clears it. A shared singleton so the (non-View) app delegate
/// can reach it without dependency plumbing.
@MainActor
@Observable
final class NotificationRouter {
    static let shared = NotificationRouter()

    /// Set when a notification is tapped; consumed (set back to nil) by MainTabView.
    var pending: MainTabView.Tab?

    private init() {}

    /// Map a backend `route` payload string to a tab. Unknown routes are ignored.
    func handle(route: String?) {
        guard let route else { return }
        switch route {
        case "insights": pending = .insights
        case "money", "transactions": pending = .money
        case "plan", "points": pending = .plan
        case "connect": pending = .connect
        case "home", "dashboard": pending = .home
        default: break
        }
    }
}
