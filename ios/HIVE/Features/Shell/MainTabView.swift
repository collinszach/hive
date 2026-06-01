import SwiftUI

/// The signed-in root: the 5-tab bottom bar matching the audited IA
/// (Home · Money · Plan · Insights · Connect). Each tab owns its own
/// `NavigationStack` so deep navigation never leaks across tabs.
struct MainTabView: View {
    enum Tab: Hashable { case home, money, plan, insights, connect }
    @State private var selection: Tab = .home

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { DashboardView() }
                .tabItem { Label("Home", systemImage: "gauge.medium") }
                .tag(Tab.home)

            NavigationStack { TransactionsView() }
                .tabItem { Label("Money", systemImage: "list.bullet.rectangle") }
                .tag(Tab.money)

            NavigationStack { PlanView() }
                .tabItem { Label("Plan", systemImage: "target") }
                .tag(Tab.plan)

            NavigationStack { InsightsView() }
                .tabItem { Label("Insights", systemImage: "sparkles") }
                .tag(Tab.insights)

            NavigationStack { ConnectView() }
                .tabItem { Label("Connect", systemImage: "link") }
                .tag(Tab.connect)
        }
        .onChange(of: selection) { _, _ in Haptics.selection() }
    }
}

/// Shared chrome: a screen scaffold with the base background, a large title, and a
/// scroll view that supports pull-to-refresh. Feature screens wrap their content in this.
struct Screen<Content: View>: View {
    let title: String
    var refresh: (() async -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            ScrollView {
                content
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
            }
            .refreshable { await refresh?() }
        }
        .navigationTitle(title)
        .toolbarBackground(Theme.base, for: .navigationBar)
    }
}

/// Temporary placeholder for tabs whose screens land in later tasks.
struct ComingSoonView: View {
    let title: String
    let note: String
    var body: some View {
        Screen(title: title) {
            EmptyStateView(icon: "hammer", title: title, message: note)
                .frame(minHeight: 360)
        }
    }
}
