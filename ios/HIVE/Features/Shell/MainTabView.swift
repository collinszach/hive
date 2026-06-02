import SwiftUI

/// The signed-in root: the 5-tab bottom bar matching the audited IA
/// (Home · Money · Plan · Insights · Connect). Each tab owns its own
/// `NavigationStack` so deep navigation never leaks across tabs.
struct MainTabView: View {
    enum Tab: Hashable { case home, money, plan, insights, connect }
    @State private var selection: Tab = {
        #if DEBUG
        // Dev: when jumping straight to Forecast, start on the Plan tab so the Home
        // (Dashboard) tab never initializes — its load would 401 a synthetic dev token
        // and trigger a global sign-out before the Forecast cover appears.
        if ProcessInfo.processInfo.environment["HIVE_DEV_OPEN"] == "forecast" { return .plan }
        #endif
        return .home
    }()
    @State private var router = NotificationRouter.shared
    @State private var devForecast = false

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
        .onChange(of: router.pending) { _, route in
            if let route {
                selection = route
                router.pending = nil
            }
        }
        .fullScreenCover(isPresented: $devForecast) {
            NavigationStack { ForecastView() }
        }
        .task {
            #if DEBUG
            // Local dev: jump straight to Forecast by launching with HIVE_DEV_OPEN=forecast.
            if ProcessInfo.processInfo.environment["HIVE_DEV_OPEN"] == "forecast" { devForecast = true }
            #endif
        }
        .task {
            // Re-register opted-in devices so the backend has a fresh token, and
            // route any notification that launched the app cold.
            await PushManager.shared.registerIfAuthorized()
            // Start the StoreKit transaction listener and sync current entitlement so
            // renewals/refunds reflect even without opening the paywall.
            IAPManager.shared.startObserving()
            await IAPManager.shared.refreshStatus()
            if let route = router.pending {
                selection = route
                router.pending = nil
            }
        }
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
