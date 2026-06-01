import SwiftUI

/// Money filter sheet — account picker plus the pending/excluded toggles that mirror
/// the web. Mutations write straight to the shared view model; `onApply` re-queries.
struct TransactionFiltersView: View {
    @Bindable var model: TransactionsViewModel
    var onApply: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        accountSection
                        togglesSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if model.hasActiveFilters {
                        Button("Clear") { model.clearFilters(); onApply() }
                            .foregroundStyle(Theme.blue)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.blue)
                }
            }
            .task { await model.loadAccountsIfNeeded() }
        }
    }

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Account").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    accountRow(label: "All accounts", id: nil)
                    ForEach(model.accounts) { acct in
                        Rectangle().fill(Theme.borderSubtle).frame(height: 1)
                            .padding(.vertical, Theme.Spacing.sm)
                        accountRow(label: acct.name, sublabel: acct.maskedLabel, id: acct.id)
                    }
                }
            }
        }
    }

    private func accountRow(label: String, sublabel: String? = nil, id: String?) -> some View {
        let selected = model.selectedAccountId == id
        return Button {
            Haptics.selection()
            model.selectedAccountId = id
            onApply()
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                    if let sublabel {
                        Text(sublabel).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    }
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.blue)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var togglesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Include").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    toggleRow("Pending transactions", isOn: $model.includePending)
                    Rectangle().fill(Theme.borderSubtle).frame(height: 1)
                        .padding(.vertical, Theme.Spacing.sm)
                    toggleRow("Excluded (transfers, Venmo/Zelle)", isOn: $model.includeExcluded)
                }
            }
        }
    }

    private func toggleRow(_ label: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
        }
        .tint(Theme.blue)
        .frame(minHeight: Theme.minTouchTarget)
        .onChange(of: isOn.wrappedValue) { _, _ in onApply() }
    }
}
