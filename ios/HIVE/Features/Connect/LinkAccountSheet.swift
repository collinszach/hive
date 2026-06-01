import SwiftUI

/// The "Link another account" chooser. Two paths, both fully in-app:
/// • Bank / card  → native Plaid Link SDK
/// • Investments  → SnapTrade portal in an in-app Safari sheet
/// The sheet only *picks* a path; the parent runs the flow after this dismisses (Plaid
/// and Safari each present their own modal, which must come up after this sheet is gone).
struct LinkAccountSheet: View {
    let onPlaid: () -> Void
    let onSnapTrade: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                VStack(spacing: Theme.Spacing.md) {
                    option(
                        icon: "building.columns.fill",
                        title: "Bank or card",
                        subtitle: "Checking, savings, and credit cards via Plaid.",
                        action: { dismiss(); onPlaid() }
                    )
                    option(
                        icon: "chart.line.uptrend.xyaxis",
                        title: "Investments",
                        subtitle: "Brokerage and retirement accounts via SnapTrade.",
                        action: { dismiss(); onSnapTrade() }
                    )
                    Spacer()
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.lg)
            }
            .navigationTitle("Link an account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private func option(icon: String, title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.selection(); action() }) {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Theme.blue)
                    .frame(width: 44, height: 44)
                    .background(Theme.blueDim)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.hiveBody(16, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Text(subtitle).font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Theme.Spacing.sm)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkTertiary)
            }
            .padding(Theme.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
