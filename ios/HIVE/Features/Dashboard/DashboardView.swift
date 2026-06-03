import SwiftUI

/// Home tab — the command center. Composed of independent, self-contained **sections**
/// (one file each under `Features/Dashboard/Sections/`), each owning its own data load,
/// skeleton, empty, and error state. See `docs/ios/HOME-SCREEN-SPEC.md`.
///
/// ## Section contract
/// Every section is a `View` with the initializer:
/// ```swift
/// init(token: Int, onAuthExpired: @escaping () -> Void)
/// ```
/// - `token` — a refresh token; the section reloads via `.task(id: token)`. Pull-to-refresh
///   on Home increments it, re-running every section concurrently.
/// - `onAuthExpired` — called when a section sees `.unauthorized` / `.notAuthenticated`,
///   so the one global sign-out path (`AppState.handleSessionExpired`) still fires.
///
/// A section that has no data hides itself (renders `EmptyView`), so Home never shows an
/// empty block. Sections load independently — one slow or failed call never blanks Home.
struct DashboardView: View {
    @Environment(AppState.self) private var app
    @State private var refreshToken = 0
    @State private var showSearch = false
    @State private var showAdd = false
    @State private var showOptimize = false

    var body: some View {
        Screen(title: "Home", refresh: { await refreshAll() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                HomeGreetingSection(onAdd: { showAdd = true }, onOptimize: { showOptimize = true })
                HomeSafeToSpendSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(0)
                HomeAttentionSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(1)
                HomeGlanceSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(2)
                HomeNetWorthSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(3)
                HomeInvestmentsSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(4)
                HomeCategoriesSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(5)
                HomeAccountsSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(6)
                HomeGoalsPointsSection(token: refreshToken, onAuthExpired: signOut).hiveEntrance(7)
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.selection(); showSearch = true
                } label: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Theme.inkSecondary)
                }
                .accessibilityLabel("Search transactions")
            }
        }
        .sheet(isPresented: $showSearch) { GlobalSearchView() }
        .sheet(isPresented: $showAdd) {
            AddTransactionView { body in await addManual(body) }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showOptimize) { CardOptimizerView() }
    }

    private func signOut() { app.handleSessionExpired() }

    /// Post a manually-added transaction, then refresh Home so the new spend shows up.
    private func addManual(_ body: ManualTransactionRequest) async -> Bool {
        do {
            try await APIClient.shared.send(.post("/api/transactions"), body: body)
            refreshToken &+= 1
            return true
        } catch {
            return false
        }
    }

    /// Bump the token so every section's `.task(id:)` re-fires, then yield briefly so the
    /// pull-to-refresh control reads as meaningful before dismissing.
    private func refreshAll() async {
        refreshToken &+= 1
        try? await Task.sleep(for: .milliseconds(450))
    }
}
