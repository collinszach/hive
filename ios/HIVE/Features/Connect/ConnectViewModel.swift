import Foundation
import Observation

@MainActor
@Observable
final class ConnectViewModel {
    private(set) var state: LoadState<[LinkedInstitution]> = .loading
    private(set) var syncingItemId: String?

    /// ~1 month of net-worth snapshots, used only for the month-over-month deltas on
    /// the hero. Best-effort: if it fails the deltas just hide, the balances still show.
    private(set) var history: [NetWorthSnapshot] = []

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        async let hist: Void = loadHistory()
        do {
            let linked = try await api.send(
                .get("/api/accounts/linked"),
                as: [LinkedInstitution].self
            )
            state = linked.isEmpty ? .empty : .loaded(linked)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
        await hist
    }

    /// Pull ~35 days of snapshots so first↔last spans roughly one month.
    private func loadHistory() async {
        if let snaps = try? await api.send(
            .get("/api/net-worth/history", query: [.init(name: "days", value: "35")]),
            as: [NetWorthSnapshot].self
        ) {
            history = snaps
        }
    }

    // MARK: Linking new accounts (in-app)

    /// True while a link round-trip (token fetch / exchange / import) is in flight, so
    /// the UI can show a spinner and block double-taps.
    private(set) var isLinking = false
    /// Non-nil briefly after a successful link, for a confirmation toast.
    private(set) var linkResult: String?

    /// Fetch a fresh Plaid Link token to initialize the native SDK.
    func createPlaidLinkToken() async -> String? {
        do {
            let resp = try await api.send(.post("/api/plaid/link-token"), as: LinkTokenResponse.self)
            return resp.linkToken
        } catch {
            Haptics.error()
            return nil
        }
    }

    /// Swap the public token Plaid Link returns for a permanent connection, then reload.
    func exchangePlaidPublicToken(_ publicToken: String, institution: String?) async {
        isLinking = true
        defer { isLinking = false }
        do {
            let resp = try await api.send(
                .post("/api/plaid/exchange-token"),
                body: ExchangeTokenRequest(publicToken: publicToken, institutionName: institution),
                as: ExchangeTokenResponse.self
            )
            Haptics.success()
            linkResult = "Linked \(resp.accountsCreated) account\(resp.accountsCreated == 1 ? "" : "s")"
            await load()
        } catch {
            Haptics.error()
        }
    }

    /// Ask the backend for the SnapTrade connection-portal URL to open in-app.
    func snapTradeConnectURL() async -> URL? {
        isLinking = true
        defer { isLinking = false }
        do {
            let resp = try await api.send(.post("/api/snaptrade/connect"), as: SnapTradeConnectResponse.self)
            return URL(string: resp.redirectUrl)
        } catch {
            Haptics.error()
            return nil
        }
    }

    /// After the user finishes (or closes) the SnapTrade portal, import any new
    /// brokerage accounts and reload.
    func snapTradeImport() async {
        isLinking = true
        defer { isLinking = false }
        do {
            let resp = try await api.send(.get("/api/snaptrade/callback"), as: SnapTradeCallbackResponse.self)
            if resp.accountsAdded > 0 {
                Haptics.success()
                linkResult = "Linked \(resp.accountsAdded) investment account\(resp.accountsAdded == 1 ? "" : "s")"
            }
            await load()
        } catch {
            await load()
        }
    }

    /// Manual "sync now" for one linked institution. Re-pulls transactions/balances
    /// server-side, then refreshes the list so balances/last-sync update.
    func syncNow(_ item: LinkedInstitution) async {
        syncingItemId = item.itemId
        defer { syncingItemId = nil }
        do {
            try await api.send(.post("/api/plaid/sync-now"), body: SyncNowRequest(itemId: item.itemId))
            await load()
            Haptics.success()
        } catch {
            // Surface nothing destructive; a failed manual sync just leaves stale data.
            Haptics.warning()
        }
    }

    // MARK: Aggregates for the net-worth header
    //
    // Source-of-truth rule: the daily server snapshot is authoritative (it's exactly
    // what the Insights tab shows), so when we have one we display *its* totals — that
    // keeps the two tabs in lockstep. Only when no snapshot exists yet do we fall back
    // to a live sum, computed with the SAME classification the backend uses
    // (credit/loan/mortgage = liability, excluded/inactive accounts dropped).

    private var allAccounts: [AccountDTO] {
        (state.value ?? []).flatMap(\.accounts)
    }

    /// Accounts that count toward net worth: active and not excluded — mirrors the
    /// backend snapshot's `is_active AND NOT is_excluded` filter.
    private var countableAccounts: [AccountDTO] {
        allAccounts.filter { $0.isActive && !$0.isExcluded }
    }

    /// Latest server snapshot, if any. This is the authoritative net worth.
    private var latestSnapshot: NetWorthSnapshot? { history.last }

    private var liveAssets: Decimal {
        countableAccounts.filter { !$0.isLiability }
            .reduce(0) { $0 + ($1.currentBalance ?? 0) }
    }
    private var liveLiabilities: Decimal {
        countableAccounts.filter { $0.isLiability }
            .reduce(0) { $0 + abs($1.currentBalance ?? 0) }
    }

    var totalAssets: Decimal { latestSnapshot?.totalAssets ?? liveAssets }
    var totalLiabilities: Decimal { latestSnapshot?.totalLiabilities ?? liveLiabilities }
    var netWorth: Decimal { latestSnapshot?.netWorth ?? (liveAssets - liveLiabilities) }

    var hasAccounts: Bool { !allAccounts.isEmpty }

    // MARK: Month-over-month deltas — ORGANIC change only.
    //
    // A naive (last.total − first.total) counts a newly-linked account's whole balance
    // as "growth," which is wrong — linking an account isn't earning money. So we diff
    // only the per-account lines present in BOTH the first and last snapshot (via the
    // breakdown), which excludes accounts added (or removed) during the window.

    /// Sum of per-account deltas over accounts present in both snapshots, filtered by
    /// the breakdown-key suffix ("(asset)" / "(liability)"). Nil when we can't compare.
    private func organicDelta(suffix: String) -> Decimal? {
        guard let first = history.first, let last = history.last, first.id != last.id,
              let fb = first.breakdown, let lb = last.breakdown else { return nil }
        let common = Set(fb.keys).intersection(lb.keys).filter { $0.hasSuffix(suffix) }
        guard !common.isEmpty else { return nil }
        return common.reduce(Decimal(0)) { $0 + ((lb[$1] ?? 0) - (fb[$1] ?? 0)) }
    }

    var assetsChange: Decimal? { organicDelta(suffix: "(asset)") }
    var liabilitiesChange: Decimal? { organicDelta(suffix: "(liability)") }

    /// Organic net-worth change = asset growth − liability growth, over shared accounts.
    var netWorthChange: Decimal? {
        let a = assetsChange
        let l = liabilitiesChange
        guard a != nil || l != nil else { return nil }
        return (a ?? 0) - (l ?? 0)
    }
}

/// Body for `POST /api/plaid/sync-now`.
private struct SyncNowRequest: Encodable {
    let itemId: String
}
