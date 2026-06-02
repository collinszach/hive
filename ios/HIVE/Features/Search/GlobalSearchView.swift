import SwiftUI
import Observation

/// App-level transaction search, presented as a sheet from the Home toolbar so a
/// merchant lookup is one tap away from anywhere — not buried behind the Money tab.
/// Searches across *all time* (`search_all=true`) and reuses the Money ledger row and
/// the transaction detail sheet so edits here behave exactly like edits there.
struct GlobalSearchView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = GlobalSearchViewModel()
    @State private var selected: TransactionDTO?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                content
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.base, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.blue)
                }
            }
            .searchable(text: $model.query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search merchants")
            .onChange(of: model.query) { _, _ in model.reloadDebounced() }
            .sheet(item: $selected) { tx in
                TransactionDetailView(transaction: tx) { await model.reload() }
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    @ViewBuilder private var content: some View {
        if model.query.trimmingCharacters(in: .whitespaces).isEmpty {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "Search your money",
                message: "Find any transaction by merchant or description — across all accounts and all time."
            )
        } else {
            ScrollView {
                LoadStateView(
                    state: model.state,
                    emptyTitle: "No matches",
                    emptyMessage: "Nothing matches “\(model.query)”.",
                    emptyIcon: "magnifyingglass",
                    onRetry: { Task { await model.reload() } }
                ) { items in
                    ledger(items)
                } skeleton: {
                    SkeletonList(count: 6)
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.md)
                .padding(.bottom, Theme.Spacing.xxl)
            }
        }
    }

    private func ledger(_ items: [TransactionDTO]) -> some View {
        let groups = Dictionary(grouping: items, by: \.date).sorted { $0.key > $1.key }
        return VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            ForEach(groups, id: \.key) { date, txns in
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Text(DateOnly.relativeLabel(date))
                        .hiveLabelStyle()
                        .padding(.leading, Theme.Spacing.xs)
                    GroupedCard(data: txns) { tx in
                        Button { Haptics.selection(); selected = tx } label: {
                            TransactionRow(tx: tx)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

/// Debounced, all-time transaction search backed by `/api/transactions?search=&search_all=true`.
/// Idle (empty query) stays `.empty` so the prompt shows instead of a spinner.
@MainActor
@Observable
final class GlobalSearchViewModel {
    var query: String = ""
    private(set) var state: LoadState<[TransactionDTO]> = .empty

    private let api: APIClient
    private var loadTask: Task<Void, Never>?
    init(api: APIClient = .shared) { self.api = api }

    func reloadDebounced() {
        loadTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { state = .empty; return }
        loadTask = Task {
            try? await Task.sleep(for: .milliseconds(280))
            guard !Task.isCancelled else { return }
            await reload()
        }
    }

    func reload() async {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { state = .empty; return }
        if state.value == nil { state = .loading }
        let q: [URLQueryItem] = [
            .init(name: "search", value: trimmed),
            .init(name: "search_all", value: "true"),
            .init(name: "page_size", value: "100"),
            .init(name: "include_pending", value: "true"),
        ]
        do {
            let resp = try await api.send(.get("/api/transactions", query: q), as: TransactionListResponse.self)
            state = resp.items.isEmpty ? .empty : .loaded(resp.items)
        } catch let error as APIError {
            if case .cancelled = error { return }
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
