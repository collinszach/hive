import SwiftUI
import Charts

/// Home tab — spend totals, top categories, account balances, and an anomaly nudge,
/// from `GET /api/dashboard/summary`.
struct DashboardView: View {
    @Environment(AppState.self) private var app
    @State private var model = DashboardViewModel()
    @State private var showSearch = false

    var body: some View {
        Screen(title: "Home", refresh: { await model.load() }) {
            LoadStateView(
                state: model.state,
                emptyTitle: "No activity yet",
                emptyMessage: "Link an account to see your spending here.",
                onRetry: { Task { await model.load() } }
            ) { summary in
                content(summary)
            } skeleton: {
                VStack(spacing: Theme.Spacing.md) {
                    SkeletonBlock(height: 110, cornerRadius: Theme.Radius.card)
                    SkeletonBlock(height: 200, cornerRadius: Theme.Radius.card)
                    SkeletonList(count: 3)
                }
            }
        }
        .task { if model.state.value == nil { await model.load() } }
        .onChange(of: isUnauthorized) { _, expired in
            if expired { app.handleSessionExpired() }
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
    }

    private var isUnauthorized: Bool {
        if case .failed(.unauthorized) = model.state { return true }
        if case .failed(.notAuthenticated) = model.state { return true }
        return false
    }

    @ViewBuilder
    private func content(_ s: DashboardSummary) -> some View {
        // One dominant hero, then supporting blocks revealed in a staggered cascade
        // so the eye is led top-down in reading order (Ch. 6 direction, Ch. 7 hierarchy).
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            spendHero(s).hiveEntrance(0)
            if s.unreviewedAnomalies.count > 0 {
                anomalyCard(s.unreviewedAnomalies).hiveEntrance(1)
            }
            if !s.topCategories.isEmpty {
                categoriesCard(s.topCategories).hiveEntrance(2)
            }
            if !s.accounts.isEmpty {
                accountsSection(s.accounts).hiveEntrance(3)
            }
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: Hero — the one dominant number
    //
    // Deliberately NOT a generic card: extra white space, a hue-shifted lift off the
    // OLED base, and the split-fraction MoneyHero make this the unmistakable anchor
    // of the screen (composition: dominance; hierarchy: white space before weight).

    private func spendHero(_ s: DashboardSummary) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Spent · \(monthLabel(s.month))").hiveLabelStyle()
            MoneyHero(amount: s.totalSpend, size: 46)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.xl)
        .background(Theme.surface)
        .background(Theme.heroLift)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1)
        )
        .hiveCardShadow()
    }

    // MARK: Top categories (Swift Charts)

    private func categoriesCard(_ categories: [CategorySpend]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                Text("Top categories").hiveLabelStyle()
                Chart(categories) { item in
                    BarMark(
                        x: .value("Amount", (item.total as NSDecimalNumber).doubleValue),
                        y: .value("Category", item.category)
                    )
                    .foregroundStyle(Theme.blue)
                    .cornerRadius(4)
                }
                .chartXAxis {
                    AxisMarks(preset: .aligned) { value in
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(Decimal(amount).formatted(
                                    .currency(code: "USD").precision(.fractionLength(0))
                                ))
                                .font(.hiveMono(10))
                                .foregroundStyle(Theme.inkTertiary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(preset: .aligned, position: .leading) { _ in
                        AxisValueLabel().font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
                    }
                }
                .frame(height: CGFloat(categories.count) * 32 + 24)
                .accessibilityElement()
                .accessibilityLabel("Top spending categories")
                .accessibilityValue(categories.map { "\($0.category) \($0.total.formatted(.currency(code: "USD").precision(.fractionLength(0))))" }.joined(separator: ", "))
            }
        }
    }

    // MARK: Anomalies nudge

    private func anomalyCard(_ a: AnomalySummary) -> some View {
        Card {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.warning)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(a.count) flagged transaction\(a.count == 1 ? "" : "s")")
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(Theme.inkPrimary)
                    if let reason = a.latestReason {
                        Text(reason)
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(2)
                    }
                }
                Spacer()
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: Accounts

    private func accountsSection(_ accounts: [AccountSummary]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Accounts").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            GroupedCard(data: accounts) { account in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(account.name)
                            .font(.hiveBody(15, weight: .medium))
                            .foregroundStyle(Theme.inkPrimary)
                        Text(account.type.capitalized)
                            .font(.hiveBody(12))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    Spacer()
                    if let balance = account.currentBalance {
                        MoneyText(amount: balance, size: 16)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    // MARK: Helpers

    /// "2026-06" → "June".
    private func monthLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let m = Int(parts[1]), (1...12).contains(m) else { return month }
        var comps = DateComponents(); comps.month = m
        let date = Calendar.current.date(from: comps) ?? Date()
        return date.formatted(.dateTime.month(.wide))
    }
}
