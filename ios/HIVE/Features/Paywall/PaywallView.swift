import SwiftUI
import StoreKit

/// The subscription paywall, presented as a sheet from Settings (Plan section) and from
/// the chat Pro-gate. Lists Starter and Pro with a Monthly/Annual toggle, prices fetched
/// live from StoreKit, plus the Apple-required Restore button and terms/privacy links.
///
/// Accent discipline: blue is the only interactive accent here. This is not a rewards
/// surface, so no honey — that color is reserved for points/earn.
struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var iap = IAPManager.shared
    @State private var period: BillingPeriod = .annual

    /// Optional context line shown at the top (e.g. why the user hit the paywall).
    var reason: String?

    private enum BillingPeriod: String, CaseIterable, Identifiable {
        case monthly = "Monthly", annual = "Annual"
        var id: String { rawValue }
    }

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                    if iap.isLoadingProducts && iap.products.isEmpty {
                        loadingState
                    } else if iap.products.isEmpty {
                        unavailableState
                    } else {
                        periodPicker
                        planCards
                    }
                    if let err = iap.errorMessage {
                        Text(err)
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.expense)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    footer
                }
                .padding(Theme.Spacing.lg)
            }
        }
        .task {
            await iap.refreshStatus()
            if iap.products.isEmpty { await iap.loadProducts() }
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.inkTertiary)
                    .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
            }
            .accessibilityLabel("Close")
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Upgrade HIVE")
                .font(.hiveBody(26, weight: .bold))
                .foregroundStyle(Theme.inkPrimary)
            Text(reason ?? "Link more accounts, unlock the AI assistant, and connect investments.")
                .font(.hiveBody(14))
                .foregroundStyle(Theme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if let billing = iap.billing, billing.isPaid {
                currentPlanBadge(billing)
            }
        }
        .padding(.top, Theme.Spacing.sm)
    }

    @ViewBuilder
    private func currentPlanBadge(_ billing: BillingStatus) -> some View {
        HStack(spacing: Theme.Spacing.xs) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 13))
            Text("Current plan: \(billing.plan.capitalized)")
                .font(.hiveBody(13, weight: .medium))
            if !billing.managedByApple, billing.isPaid {
                Text("· managed on the web")
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkTertiary)
            }
        }
        .foregroundStyle(Theme.blue)
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(Theme.blueDim)
        .clipShape(Capsule())
    }

    // MARK: Period picker

    private var periodPicker: some View {
        Picker("Billing period", selection: $period) {
            ForEach(BillingPeriod.allCases) { p in Text(p.rawValue).tag(p) }
        }
        .pickerStyle(.segmented)
        .tint(Theme.blue)
    }

    // MARK: Plan cards

    private var planCards: some View {
        VStack(spacing: Theme.Spacing.lg) {
            planCard(
                title: "Starter",
                productID: period == .monthly ? IAPManager.ProductID.starterMonthly : IAPManager.ProductID.starterAnnual,
                features: ["Link up to 3 accounts", "Daily sync & categorization", "Budgets, points & net worth"],
                planKey: "starter"
            )
            planCard(
                title: "Pro",
                productID: period == .monthly ? IAPManager.ProductID.proMonthly : IAPManager.ProductID.proAnnual,
                features: ["Everything in Starter", "Link up to 10 accounts", "AI chat assistant (Claude)", "Investment accounts via SnapTrade"],
                planKey: "pro",
                highlighted: true
            )
        }
    }

    @ViewBuilder
    private func planCard(title: String, productID: String, features: [String], planKey: String, highlighted: Bool = false) -> some View {
        let product = iap.product(productID)
        let isCurrent = iap.billing?.plan == planKey
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(.hiveBody(19, weight: .bold))
                        .foregroundStyle(Theme.inkPrimary)
                    if highlighted {
                        Text("Most popular")
                            .font(.hiveBody(11, weight: .semibold))
                            .foregroundStyle(Theme.blue)
                            .padding(.horizontal, Theme.Spacing.sm)
                            .padding(.vertical, 3)
                            .background(Theme.blueDim)
                            .clipShape(Capsule())
                    }
                    Spacer()
                    if let product {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(product.displayPrice)
                                .font(.hiveMono(17, weight: .semibold))
                                .foregroundStyle(Theme.inkPrimary)
                            Text(period == .monthly ? "/mo" : "/yr")
                                .font(.hiveBody(11))
                                .foregroundStyle(Theme.inkTertiary)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    ForEach(features, id: \.self) { feature in
                        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.blue)
                                .padding(.top, 3)
                            Text(feature)
                                .font(.hiveBody(13))
                                .foregroundStyle(Theme.inkSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                Button {
                    guard let product else { return }
                    Haptics.selection()
                    Task {
                        if await iap.purchase(product) {
                            Haptics.success()
                            dismiss()
                        }
                    }
                } label: {
                    HStack {
                        if iap.isPurchasing { ProgressView().tint(.white) }
                        Text(isCurrent ? "Current plan" : "Choose \(title)")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(HivePrimaryButtonStyle())
                .disabled(product == nil || iap.isPurchasing || isCurrent)
                .opacity(isCurrent ? 0.5 : 1)
            }
        }
    }

    // MARK: States

    private var loadingState: some View {
        VStack(spacing: Theme.Spacing.lg) {
            SkeletonBlock(height: 180, cornerRadius: Theme.Radius.card)
            SkeletonBlock(height: 220, cornerRadius: Theme.Radius.card)
        }
    }

    private var unavailableState: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Subscriptions are unavailable right now")
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                Text("Check your connection and try again.")
                    .font(.hiveBody(13))
                    .foregroundStyle(Theme.inkTertiary)
                Button("Retry") { Task { await iap.loadProducts() } }
                    .font(.hiveBody(14, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                    .frame(minHeight: Theme.minTouchTarget, alignment: .leading)
            }
        }
    }

    // MARK: Footer

    private var footer: some View {
        VStack(spacing: Theme.Spacing.md) {
            Button {
                Haptics.selection()
                Task {
                    if await iap.restore() { Haptics.success(); dismiss() }
                }
            } label: {
                Text("Restore purchases")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(HiveSecondaryButtonStyle())
            .disabled(iap.isPurchasing)

            Text("Subscriptions renew automatically until canceled. Manage or cancel anytime in the App Store. Payment is charged to your Apple ID.")
                .font(.hiveBody(11))
                .foregroundStyle(Theme.inkTertiary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: Theme.Spacing.lg) {
                Link("Terms", destination: URL(string: "https://hive.zacharyjcollins.com/terms")!)
                Link("Privacy", destination: URL(string: "https://hive.zacharyjcollins.com/privacy")!)
            }
            .font(.hiveBody(12, weight: .medium))
            .tint(Theme.blue)
        }
        .padding(.top, Theme.Spacing.sm)
    }
}
