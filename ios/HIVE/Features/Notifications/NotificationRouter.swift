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

    /// Optional account id the Money tab should pre-filter to. Set alongside `pending = .money`
    /// (e.g. tapping an account on Home); consumed and cleared by `TransactionsView`.
    var accountFilter: String?

    /// Whether the pending account filter should also surface excluded transactions
    /// (transfers, autopay, Venmo/Zelle, CD moves). Cash/savings/investment accounts are
    /// mostly transfers — without this, "view account" lands on an empty list because the
    /// transactions screen hides excluded rows by default. Credit cards don't need it: real
    /// spend dominates there. Consumed and cleared alongside `accountFilter`.
    var accountFilterIncludeExcluded: Bool = false

    /// Optional category the Money tab should pre-filter to. Set alongside `pending = .money`
    /// (e.g. tapping a category bar on Home); consumed and cleared by `TransactionsView`.
    var categoryFilter: String?

    private init() {}

    /// Jump to the Money tab pre-filtered to one account (deep-link from Home cards).
    /// Pass `includeExcluded: true` for cash/savings/investment accounts so transfers and
    /// autopay — the bulk of their activity — aren't hidden by the default exclusion filter.
    /// Pass `category:` instead of `accountId:` to filter by spending category.
    func openTransactions(accountId: String? = nil, includeExcluded: Bool = false, category: String? = nil) {
        accountFilter = accountId
        accountFilterIncludeExcluded = includeExcluded
        categoryFilter = category
        pending = .money
    }

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
