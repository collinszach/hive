import SwiftUI

/// Connect tab — the account-of-record view: net worth on top, then each linked
/// institution as its own grouped surface with a manual "sync now" and a last-sync
/// line. New-account linking (Plaid/SnapTrade) runs on the web for now; this screen
/// owns the connected state, refresh, and sign-out.
struct ConnectView: View {
    @Environment(AppState.self) private var app
    @State private var model = ConnectViewModel()
    @State private var confirmingSignOut = false
    @State private var showLinkChooser = false
    @State private var snapTradeTarget: SnapTradeTarget?
    @State private var plaidLink = PlaidLinkCoordinator()

    /// Wrapper so a SnapTrade portal URL can drive a `.sheet(item:)`.
    private struct SnapTradeTarget: Identifiable { let id = UUID(); let url: URL }

    var body: some View {
        Screen(title: "Connect", refresh: { await model.load() }) {
            LoadStateView(
                state: model.state,
                emptyTitle: "No accounts linked",
                emptyMessage: "Link a bank or brokerage on the web to sync transactions and balances here.",
                emptyIcon: "link",
                onRetry: { Task { await model.load() } }
            ) { institutions in
                content(institutions)
            } skeleton: {
                VStack(spacing: Theme.Spacing.md) {
                    SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
                    SkeletonList(count: 4)
                }
            }
        }
        .task { if model.state.value == nil { await model.load() } }
        .onChange(of: isUnauthorized) { _, expired in if expired { app.handleSessionExpired() } }
        .confirmationDialog("Sign out of HIVE?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { app.signOut() }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(isPresented: $showLinkChooser) {
            LinkAccountSheet(
                onPlaid: { Task { await startPlaidLink() } },
                onSnapTrade: { Task { await startSnapTradeLink() } }
            )
            .presentationDetents([.height(280)])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $snapTradeTarget) { target in
            SafariView(url: target.url) {
                snapTradeTarget = nil
                Task { await model.snapTradeImport() }
            }
            .ignoresSafeArea()
        }
    }

    // MARK: Linking flows
    //
    // Both run after the chooser sheet dismisses: Plaid and Safari each present their
    // own modal from the top view controller, which must be the root once the chooser
    // is gone — hence the brief wait for the dismiss animation.

    private func startPlaidLink() async {
        try? await Task.sleep(for: .milliseconds(350))
        guard let token = await model.createPlaidLinkToken() else { return }
        plaidLink.present(
            linkToken: token,
            onSuccess: { publicToken, institution in
                Task { await model.exchangePlaidPublicToken(publicToken, institution: institution) }
            },
            onExit: {}
        )
    }

    private func startSnapTradeLink() async {
        try? await Task.sleep(for: .milliseconds(350))
        if let url = await model.snapTradeConnectURL() {
            snapTradeTarget = SnapTradeTarget(url: url)
        }
    }

    private var isUnauthorized: Bool {
        if case .failed(.unauthorized) = model.state { return true }
        if case .failed(.notAuthenticated) = model.state { return true }
        return false
    }

    @ViewBuilder
    private func content(_ institutions: [LinkedInstitution]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            netWorthHero.hiveEntrance(0)
            ForEach(Array(institutions.enumerated()), id: \.element.id) { i, inst in
                institutionSection(inst).hiveEntrance(min(i + 1, 6))
            }
            footer.hiveEntrance(min(institutions.count + 1, 6))
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: Net worth hero — assets minus card debt across linked accounts.

    private var netWorthHero: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Net worth").hiveLabelStyle()
            MoneyHero(amount: model.netWorth, size: 40)
            if let change = model.netWorthChange, change != 0 {
                changeIndicator(change, suffix: "this month")
            }
            HStack(spacing: Theme.Spacing.lg) {
                // Assets are money you have — green, growing. Liabilities are debt —
                // shown red and negative so the sign reads at a glance.
                statColumn("Assets", model.totalAssets, tint: Theme.income, change: model.assetsChange)
                statColumn("Liabilities", -model.totalLiabilities, tint: Theme.expense, change: nil)
            }
            .padding(.top, Theme.Spacing.xs)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.xl)
        .background(Theme.surface)
        .background(Theme.heroLift)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
            .stroke(Theme.borderDefault, lineWidth: 1))
        .hiveCardShadow()
    }

    /// One labelled balance. `tint` colors the amount; a positive `change` shows a
    /// small green/red ▲▼ delta beneath it.
    private func statColumn(_ label: String, _ amount: Decimal, tint: Color, change: Decimal?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
            Text(amount.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                .font(.hiveMono(15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
            if let change, change != 0 {
                changeIndicator(change, suffix: nil, size: 11)
            }
        }
    }

    /// ▲/▼ + signed amount, green when up / red when down. Used for the net-worth
    /// month-over-month delta and the asset growth line.
    private func changeIndicator(_ change: Decimal, suffix: String?, size: CGFloat = 13) -> some View {
        let up = change > 0
        return HStack(spacing: 3) {
            Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: size - 2, weight: .bold))
            Text(abs(change).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                .font(.hiveMono(size, weight: .medium))
                .monospacedDigit()
            if let suffix {
                Text(suffix).font(.hiveBody(size)).foregroundStyle(Theme.inkTertiary)
            }
        }
        .foregroundStyle(up ? Theme.income : Theme.expense)
    }

    // MARK: One institution

    private func institutionSection(_ inst: LinkedInstitution) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(inst.institutionName)
                    .font(.hiveBody(13, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
                    .textCase(.uppercase)
                    .kerning(0.5)
                Spacer()
                syncButton(inst)
            }
            .padding(.horizontal, Theme.Spacing.xs)

            GroupedCard(data: inst.accounts) { account in
                accountRow(account)
            }

            if let err = inst.friendlyError {
                Label {
                    Text(err)
                } icon: {
                    Image(systemName: inst.errorIsInformational ? "info.circle" : "exclamationmark.triangle.fill")
                }
                .font(.hiveBody(12))
                .foregroundStyle(inst.errorIsInformational ? Theme.inkTertiary : Theme.warning)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Theme.Spacing.xs)
            } else if let synced = inst.lastSyncAt {
                Text("Synced \(DateOnly.syncLabel(synced))")
                    .font(.hiveBody(11))
                    .foregroundStyle(Theme.inkTertiary)
                    .padding(.horizontal, Theme.Spacing.xs)
            }
        }
    }

    @ViewBuilder
    private func syncButton(_ inst: LinkedInstitution) -> some View {
        let isSyncing = model.syncingItemId == inst.itemId
        Button {
            Task { await model.syncNow(inst) }
        } label: {
            HStack(spacing: Theme.Spacing.xs) {
                if isSyncing {
                    ProgressView().controlSize(.mini).tint(Theme.blue)
                } else {
                    Image(systemName: "arrow.clockwise").font(.system(size: 12, weight: .semibold))
                }
                Text(isSyncing ? "Syncing…" : "Sync")
                    .font(.hiveBody(12, weight: .medium))
            }
            .foregroundStyle(Theme.blue)
        }
        .buttonStyle(.plain)
        .disabled(model.syncingItemId != nil)
    }

    private func accountRow(_ account: AccountDTO) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: accountIcon(account))
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 34, height: 34)
                .background(Theme.elevated)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(account.name)
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1)
                Text(account.maskedLabel)
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: Theme.Spacing.sm)

            VStack(alignment: .trailing, spacing: 2) {
                if let balance = account.currentBalance {
                    MoneyText(amount: balance, size: 16, weight: .medium)
                }
                if account.isCredit, let limit = account.creditLimit, limit > 0 {
                    Text("of \(limit.formatted(.currency(code: account.currency).precision(.fractionLength(0))))")
                        .font(.hiveMono(11)).foregroundStyle(Theme.inkTertiary)
                }
            }
        }
        .contentShape(Rectangle())
    }

    private func accountIcon(_ a: AccountDTO) -> String {
        if a.isCredit { return "creditcard" }
        if a.isInvestment { return "chart.line.uptrend.xyaxis" }
        switch a.subtype?.lowercased() {
        case "savings": return "banknote"
        case "checking": return "building.columns"
        default: return "dollarsign.circle"
        }
    }

    // MARK: Footer — link more (web) + sign out

    private var footer: some View {
        VStack(spacing: Theme.Spacing.md) {
            Button {
                Haptics.selection(); showLinkChooser = true
            } label: {
                HStack {
                    if model.isLinking { ProgressView().tint(.white) }
                    Label("Link another account", systemImage: "plus")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(HivePrimaryButtonStyle())
            .disabled(model.isLinking)

            Button(role: .destructive) {
                confirmingSignOut = true
            } label: {
                Text("Sign out")
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.expense)
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, Theme.Spacing.sm)
    }
}
