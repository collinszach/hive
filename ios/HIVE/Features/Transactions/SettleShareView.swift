import SwiftUI

/// "Which payment was this?" — pick the transaction that cleared a share.
///
/// A repayment is an ordinary money-in transaction with nothing marking it as a
/// repayment, so the backend ranks plausible ones (exact amount, a lump sum clearing
/// the person's balance, a name in the descriptor) and this lists them best first.
/// Linking is optional: plenty of people pay in cash, so "Settled outside HIVE" is a
/// first-class choice rather than a dead end.
struct SettleShareView: View {
    let share: ExpenseShareDTO
    /// Other pending shares for the same person, offered for one-tap bulk settling.
    let otherPending: [ExpenseShareDTO]
    /// (settlementTransactionId, alsoSettleShareIds)
    let onSettle: (String?, [String]) async -> Void

    @Environment(\.dismiss) private var dismiss
    private let api = APIClient.shared

    @State private var candidates: [SettlementCandidateDTO] = []
    @State private var selected: String?
    @State private var alsoSettleOthers = false
    @State private var isLoading = true
    @State private var isSaving = false

    private var otherTotal: Decimal { otherPending.reduce(0) { $0 + $1.amount } }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        contextHeader
                        if !otherPending.isEmpty { bulkSection }
                        candidateSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Mark as paid back")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(isSaving ? Theme.inkGhost : Theme.blue)
                        .disabled(isSaving)
                }
            }
            .task { await loadCandidates() }
        }
    }

    private var contextHeader: some View {
        Card {
            VStack(spacing: Theme.Spacing.sm) {
                detailRow("Who", Text(share.contactName)
                    .font(.hiveBody(15, weight: .semibold))
                    .foregroundStyle(Theme.inkPrimary))
                divider
                detailRow("Owed", MoneyText(amount: share.amount, size: 15, weight: .semibold))
            }
        }
    }

    // MARK: Bulk

    private var bulkSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Their other pending shares").hiveLabelStyle()
                .padding(.horizontal, Theme.Spacing.xs)
            Card {
                Button {
                    Haptics.selection()
                    alsoSettleOthers.toggle()
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: alsoSettleOthers ? "checkmark.square.fill" : "square")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(alsoSettleOthers ? Theme.blue : Theme.inkGhost)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Also settle \(otherPending.count) more")
                                .font(.hiveBody(15, weight: .medium))
                                .foregroundStyle(Theme.inkPrimary)
                            Text("\(share.contactName) owes \(money(otherTotal)) besides this one")
                                .font(.hiveBody(12))
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Candidates

    private var candidateSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Which payment was this?").hiveLabelStyle()
                .padding(.horizontal, Theme.Spacing.xs)

            Card {
                VStack(spacing: 0) {
                    noTransactionRow
                    if isLoading {
                        divider
                        HStack {
                            ProgressView().controlSize(.small)
                            Text("Finding payments…")
                                .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                    } else if candidates.isEmpty {
                        divider
                        Text("No money-in transactions since this charge.")
                            .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, Theme.Spacing.sm)
                    } else {
                        ForEach(candidates) { c in
                            divider
                            candidateRow(c)
                        }
                    }
                }
            }
        }
    }

    private var noTransactionRow: some View {
        Button {
            Haptics.selection()
            selected = nil
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Settled outside HIVE")
                        .font(.hiveBody(15, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                    Text("Cash, or a payment that never hit a linked account")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                if selected == nil {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.blue)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
        .buttonStyle(.plain)
    }

    private func candidateRow(_ c: SettlementCandidateDTO) -> some View {
        Button {
            Haptics.selection()
            selected = (selected == c.transactionId) ? nil : c.transactionId
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.description)
                        .font(.hiveBody(15, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Spacing.xs) {
                        Text(DateOnly.shortLabel(c.date))
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        if let label = c.matchLabel {
                            Text("· \(label)")
                                .font(.hiveBody(12, weight: .medium))
                                .foregroundStyle(Theme.income)
                        }
                    }
                    .lineLimit(1)
                }
                Spacer(minLength: Theme.Spacing.sm)
                MoneyText(amount: c.amount, size: 14, weight: .medium)
                if selected == c.transactionId {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.blue)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
        .buttonStyle(.plain)
    }

    // MARK: Helpers

    private var divider: some View {
        Rectangle().fill(Theme.borderDefault).frame(height: 1)
    }

    private func detailRow(_ label: String, _ value: some View) -> some View {
        HStack {
            Text(label).font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            value
        }
        .frame(minHeight: 28)
    }

    private func money(_ d: Decimal) -> String {
        d.formatted(.currency(code: "USD").precision(.fractionLength(2)))
    }

    private func loadCandidates() async {
        defer { isLoading = false }
        if let c = try? await api.send(
            .get("/api/shares/\(share.id)/settlement-candidates"),
            as: [SettlementCandidateDTO].self
        ) {
            candidates = c
            // Pre-select a single unambiguous match so the common case is one tap,
            // but never guess when several candidates are equally strong.
            let strongest = c.filter { $0.match == "exact" || $0.match == "batch" }
            if strongest.count == 1 { selected = strongest[0].transactionId }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let alsoIds = alsoSettleOthers ? otherPending.map(\.id) : []
        await onSettle(selected, alsoIds)
        dismiss()
    }
}
