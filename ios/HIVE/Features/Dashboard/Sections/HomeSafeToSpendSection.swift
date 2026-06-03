import SwiftUI

/// Home · Safe-to-Spend hero (Epic H1).
///
/// The keystone anchor of the Home screen: shows how much the user can still spend
/// this month after subtracting spending, upcoming bills, and goal savings from income.
/// Taps to a breakdown sheet. Mirrors the section contract in `HomeCategoriesSection`.
struct HomeSafeToSpendSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()
    @State private var showBreakdown = false

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let s):
                heroCard(s)
            case .loading:
                SkeletonBlock(height: 120, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    // MARK: - Hero card

    private func heroCard(_ s: SafeToSpend) -> some View {
        Button { showBreakdown = true } label: {
            heroContent(s)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showBreakdown) {
            breakdownSheet(s)
        }
    }

    private func heroContent(_ s: SafeToSpend) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Label row: status dot + label
            HStack(spacing: Theme.Spacing.xs) {
                Circle()
                    .fill(statusColor(s.color))
                    .frame(width: 7, height: 7)
                    .accessibilityHidden(true)
                Text("Safe to spend · \(s.daysRemaining) days left")
                    .hiveLabelStyle()
                Spacer()
            }

            // Hero amount
            MoneyHero(amount: s.safeToSpend, size: 46)

            // Status text replaces the dot for VoiceOver — visible-but-muted
            Text(statusLabel(s.color))
                .font(.hiveBody(12))
                .foregroundStyle(statusColor(s.color))
                .accessibilityHidden(true) // included in combined accessibility below

            // Caption
            Text("Income minus spending, bills, and goal savings.")
                .font(.hiveBody(12))
                .foregroundStyle(Theme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface)
        .background(Theme.heroLift)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1)
        )
        .hiveCardShadow()
        // Unified accessibility element
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Safe to spend, \(s.daysRemaining) days left. Status: \(statusLabel(s.color)).")
        .accessibilityValue(s.safeToSpend.formatted(.currency(code: "USD").precision(.fractionLength(0))))
        .accessibilityHint("Tap to see breakdown")
    }

    // MARK: - Breakdown sheet

    private func breakdownSheet(_ s: SafeToSpend) -> some View {
        NavigationStack {
            List {
                Section {
                    breakdownRow(
                        label: "Monthly income",
                        amount: s.breakdown.monthlyIncome,
                        color: Theme.income
                    )
                    breakdownRow(
                        label: "Spent this month",
                        amount: s.breakdown.spentThisMonth,
                        color: Theme.expense
                    )
                    breakdownRow(
                        label: "Upcoming bills",
                        amount: s.breakdown.upcomingBills,
                        color: Theme.warning
                    )
                    breakdownRow(
                        label: "Goal savings",
                        amount: s.breakdown.goalSavings,
                        color: Theme.blue
                    )
                }

                if s.breakdown.monthlyIncome == 0 {
                    Section {
                        Text("Set your income in Plan to sharpen this.")
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.inkTertiary)
                            .listRowBackground(Color.clear)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.base)
            .navigationTitle("Safe to spend")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showBreakdown = false }
                        .font(.hiveBody(16, weight: .medium))
                        .foregroundStyle(Theme.blue)
                }
            }
        }
    }

    private func breakdownRow(label: String, amount: Decimal, color: Color) -> some View {
        HStack {
            HStack(spacing: Theme.Spacing.sm) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                    .accessibilityHidden(true)
                Text(label)
                    .font(.hiveBody(15))
                    .foregroundStyle(Theme.inkPrimary)
            }
            Spacer()
            MoneyText(amount: amount, size: 15, weight: .medium)
        }
        .padding(.vertical, Theme.Spacing.xs)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Helpers

    private func statusColor(_ colorKey: String) -> Color {
        switch colorKey {
        case "green": return Theme.income
        case "amber": return Theme.warning
        case "red":   return Theme.expense
        default:      return Theme.inkSecondary
        }
    }

    private func statusLabel(_ colorKey: String) -> String {
        switch colorKey {
        case "green": return "On track"
        case "amber": return "Watch your spending"
        case "red":   return "Over budget"
        default:      return ""
        }
    }

    // MARK: - Model

    @MainActor @Observable
    final class Model {
        private(set) var state: LoadState<SafeToSpend> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }
            do {
                let s = try await api.send(.get("/api/dashboard/safe-to-spend"), as: SafeToSpend.self)
                state = .loaded(s)
            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }
    }
}
