import Foundation
import Observation

@MainActor
@Observable
final class TransactionsViewModel {
    private(set) var state: LoadState<[TransactionDTO]> = .loading
    private(set) var monthTotal: Decimal = 0
    private(set) var total: Int = 0

    /// Filters. Changing any of these re-queries.
    var month: String = MonthHelper.current
    var searchText: String = ""
    var selectedCategory: String? = nil
    var selectedAccountId: String? = nil
    var includePending: Bool = false
    var includeExcluded: Bool = false
    /// When true, bypasses the month filter and returns all-time results for the active filters.
    /// Set when navigating from a category/account deep-link so the full history is visible.
    var searchAllTime: Bool = false

    /// Accounts for the filter picker (loaded lazily the first time filters open).
    private(set) var accounts: [AccountDTO] = []

    /// True when any non-category filter is active (drives the toolbar badge).
    var hasActiveFilters: Bool {
        selectedAccountId != nil || includePending || includeExcluded
    }

    private let api: APIClient
    private var loadTask: Task<Void, Never>?

    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            let resp = try await api.send(endpoint(), as: TransactionListResponse.self)
            monthTotal = resp.totalAmount
            total = resp.total
            state = resp.items.isEmpty ? .empty : .loaded(resp.items)
        } catch let error as APIError {
            if case .cancelled = error { return }
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }

    /// Pull-to-refresh: kick off a server-side Plaid sync, give it a moment to land
    /// new rows, then reload. The sync is async on the backend (Celery), so we wait a
    /// short bounded window — anything still in flight shows up on the next pull.
    func refreshWithSync() async {
        do { try await api.sendVoid(.post("/api/transactions/sync-now")) } catch { /* fall through to reload */ }
        try? await Task.sleep(for: .seconds(4))
        await load()
    }

    /// Load accounts for the filter picker (idempotent — skips if already loaded).
    func loadAccountsIfNeeded() async {
        guard accounts.isEmpty else { return }
        if let list = try? await api.send(.get("/api/accounts"), as: [AccountDTO].self) {
            accounts = list
        }
    }

    /// Cancel any pending debounced reload (e.g. before applying a deep-link filter directly).
    func cancelPendingReload() {
        loadTask?.cancel()
        loadTask = nil
    }

    func clearFilters() {
        selectedAccountId = nil
        includePending = false
        includeExcluded = false
    }

    /// Debounced reload used by the search field / filter chips.
    func reloadDebounced() {
        loadTask?.cancel()
        loadTask = Task {
            try? await Task.sleep(for: .milliseconds(280))
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    /// Manual category override — optimistic local update, then server sync.
    func updateCategory(_ tx: TransactionDTO, category: String, subcategory: String) async {
        do {
            try await api.send(
                Endpoint(method: .put, path: "/api/transactions/\(tx.id)/category"),
                body: CategoryUpdate(category: category, subcategory: subcategory)
            )
            await load()
        } catch {
            // Re-pull to restore truth on failure.
            await load()
        }
    }

    /// Create a manual (cash/reimbursement) transaction, then reload the ledger.
    /// `amount` follows the backend's sign convention: positive = spend, negative =
    /// income/credit. Returns true on success so the sheet can dismiss.
    func createManual(_ body: ManualTransactionRequest) async -> Bool {
        do {
            try await api.send(.post("/api/transactions"), body: body)
            await load()
            return true
        } catch {
            return false
        }
    }

    private func endpoint() -> Endpoint {
        var query: [URLQueryItem] = [.init(name: "page_size", value: "100")]
        let trimmed = searchText.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            // Searching spans all time, not just the selected month.
            query.append(.init(name: "search", value: trimmed))
            query.append(.init(name: "search_all", value: "true"))
        } else if searchAllTime {
            query.append(.init(name: "search_all", value: "true"))
        } else {
            query.append(.init(name: "month", value: month))
        }
        if let cat = selectedCategory {
            query.append(.init(name: "category", value: cat))
        }
        if let acct = selectedAccountId {
            query.append(.init(name: "account_id", value: acct))
        }
        if includePending { query.append(.init(name: "include_pending", value: "true")) }
        if includeExcluded { query.append(.init(name: "include_excluded", value: "true")) }
        return .get("/api/transactions", query: query)
    }
}
