import SwiftUI

/// Tap-through from a Connect account row: the account's balance summary plus its
/// recent transactions (a pre-filtered Money view). Read-only — linking, sync, and
/// manual entry stay on their owning screens.
struct AccountDetailView: View {
    let account: AccountDTO
    @State private var model = AccountDetailViewModel()
    @State private var selected: TransactionDTO?

    var body: some View {
        Screen(title: account.name, refresh: { await model.load(accountId: account.id) }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                summaryCard.hiveEntrance(0)
                transactionsSection.hiveEntrance(1)
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { if model.state.value == nil { await model.load(accountId: account.id) } }
        .sheet(item: $selected) { tx in
            TransactionDetailView(transaction: tx) { await model.load(accountId: account.id) }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: Balance summary

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text(account.isLiability ? "Current balance" : "Balance").hiveLabelStyle()
                MoneyHero(amount: account.currentBalance ?? 0, size: 38)
                Text("\(account.institution) · \(account.maskedLabel)")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }

            if !detailRows.isEmpty {
                GroupedCard(data: detailRows) { row in
                    HStack {
                        Text(row.label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                        Spacer()
                        Text(row.value).font(.hiveMono(14, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                    }
                    .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
                }
            }
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

    private struct DetailRow: Identifiable { let id = UUID(); let label: String; let value: String }

    private var detailRows: [DetailRow] {
        var rows: [DetailRow] = []
        let cur = account.currency
        if let avail = account.availableBalance {
            rows.append(.init(label: "Available", value: money(avail, cur)))
        }
        if account.isCredit, let limit = account.creditLimit, limit > 0 {
            rows.append(.init(label: "Credit limit", value: money(limit, cur)))
        }
        if let stmt = account.statementBalance, stmt != 0 {
            rows.append(.init(label: "Statement balance", value: money(stmt, cur)))
        }
        let typeLabel = account.subtype?.capitalized ?? account.type.capitalized
        rows.append(.init(label: "Type", value: typeLabel))
        return rows
    }

    private func money(_ amount: Decimal, _ code: String) -> String {
        amount.formatted(.currency(code: code).precision(.fractionLength(2)))
    }

    // MARK: Recent transactions

    @ViewBuilder private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Recent activity").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            LoadStateView(
                state: model.state,
                emptyTitle: "No transactions",
                emptyMessage: "Nothing has synced for this account yet.",
                emptyIcon: "tray",
                onRetry: { Task { await model.load(accountId: account.id) } }
            ) { items in
                ledger(items)
            } skeleton: {
                SkeletonList(count: 6)
            }
        }
    }

    private func ledger(_ items: [TransactionDTO]) -> some View {
        let groups = Dictionary(grouping: items, by: \.date).sorted { $0.key > $1.key }
        return VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            ForEach(groups, id: \.key) { date, txns in
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Text(DateOnly.relativeLabel(date))
                        .hiveLabelStyle()
                        .padding(.leading, Theme.Spacing.xs)
                    GroupedCard(data: txns) { tx in
                        Button { Haptics.selection(); selected = tx } label: {
                            TransactionRow(tx: tx)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

/// Loads a single account's most-recent transactions (all-time, newest first) via the
/// shared `/api/transactions` list endpoint filtered by `account_id`.
@MainActor
@Observable
final class AccountDetailViewModel {
    private(set) var state: LoadState<[TransactionDTO]> = .loading

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load(accountId: String) async {
        if state.value == nil { state = .loading }
        let query: [URLQueryItem] = [
            .init(name: "account_id", value: accountId),
            .init(name: "page_size", value: "50"),
            .init(name: "include_pending", value: "true"),
        ]
        do {
            let resp = try await api.send(
                .get("/api/transactions", query: query), as: TransactionListResponse.self
            )
            state = resp.items.isEmpty ? .empty : .loaded(resp.items)
        } catch let error as APIError {
            if case .cancelled = error { return }
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
