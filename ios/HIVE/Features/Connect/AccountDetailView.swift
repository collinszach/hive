import SwiftUI

/// Tap-through from a Connect account row: the account's balance summary plus its
/// recent transactions (a pre-filtered Money view). Read-only — linking, sync, and
/// manual entry stay on their owning screens.
struct AccountDetailView: View {
    let account: AccountDTO
    @State private var model = AccountDetailViewModel()
    @State private var selected: TransactionDTO?

    var body: some View {
        Screen(title: account.name, refresh: {
            await model.load(accountId: account.id)
            if let sid = account.snaptradeAccountId { await model.loadHoldings(snaptradeAccountId: sid) }
        }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                summaryCard.hiveEntrance(0)
                if account.snaptradeAccountId != nil {
                    holdingsSection.hiveEntrance(1)
                    ordersSection.hiveEntrance(2)
                }
                transactionsSection.hiveEntrance(account.snaptradeAccountId != nil ? 3 : 1)
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model.state.value == nil { await model.load(accountId: account.id) }
            if let sid = account.snaptradeAccountId, model.holdingsState?.value == nil {
                await model.loadHoldings(snaptradeAccountId: sid)
            }
        }
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

    // MARK: Holdings (SnapTrade investment accounts)

    @ViewBuilder private var holdingsSection: some View {
        if let sid = account.snaptradeAccountId, let state = model.holdingsState {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Holdings").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
                LoadStateView(
                    state: state,
                    emptyTitle: "No holdings",
                    emptyMessage: "This account has no open positions.",
                    emptyIcon: "chart.pie",
                    onRetry: { Task { await model.loadHoldings(snaptradeAccountId: sid) } }
                ) { holdings in
                    VStack(spacing: Theme.Spacing.sm) {
                        holdingsSummary(holdings)
                        positionsList(holdings.positions)
                    }
                } skeleton: {
                    SkeletonList(count: 4)
                }
            }
        }
    }

    /// Portfolio rise/fall summary: total market value and total unrealized gain/loss
    /// (sum of per-position open P&L) with the percent return on cost basis.
    @ViewBuilder private func holdingsSummary(_ holdings: HoldingsDTO) -> some View {
        let totalPnl = holdings.positions.reduce(Decimal(0)) { $0 + ($1.openPnl ?? 0) }
        let marketValue = holdings.totalValue
            ?? holdings.positions.reduce(Decimal(0)) { $0 + ($1.marketValue ?? 0) }
        let costBasis = marketValue - totalPnl
        let pct: Double? = {
            let cb = (costBasis as NSDecimalNumber).doubleValue
            guard cb > 0 else { return nil }
            return (totalPnl as NSDecimalNumber).doubleValue / cb * 100
        }()
        let gain = totalPnl >= 0
        let tint = gain ? Theme.income : Theme.expense
        let code = holdings.currency ?? account.currency
        Card {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Market value").hiveLabelStyle()
                    MoneyText(amount: marketValue, size: 22, weight: .semibold, currencyCode: code)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Total return").hiveLabelStyle()
                    HStack(spacing: 4) {
                        Image(systemName: gain ? "arrow.up.right" : "arrow.down.right")
                            .font(.hiveMono(11, weight: .bold)).foregroundStyle(tint)
                        MoneyText(amount: totalPnl, size: 15, weight: .semibold, signed: true, currencyCode: code)
                    }
                    if let pct {
                        Text("\(gain ? "+" : "")\(String(format: "%.1f", pct))%")
                            .font(.hiveMono(12)).foregroundStyle(tint)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Portfolio value \(money(marketValue, code)), total return \(money(totalPnl, code))")
        }
    }

    @ViewBuilder private func positionsList(_ positions: [PositionDTO]) -> some View {
        if positions.isEmpty {
            EmptyView()
        } else {
            GroupedCard(data: positions) { pos in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pos.displaySymbol)
                            .font(.hiveMono(15, weight: .semibold))
                            .foregroundStyle(Theme.inkPrimary)
                        if let desc = pos.description, desc != pos.symbol {
                            Text(desc)
                                .font(.hiveBody(12))
                                .foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                        }
                        if let units = pos.units, let price = pos.price {
                            Text("\(unitsLabel(units)) @ \(money(price, pos.currency ?? account.currency))")
                                .font(.hiveBody(11))
                                .foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    Spacer(minLength: Theme.Spacing.md)
                    VStack(alignment: .trailing, spacing: 2) {
                        MoneyText(amount: pos.marketValue ?? 0, size: 15,
                                  currencyCode: pos.currency ?? account.currency)
                        if let pnl = pos.openPnl, pnl != 0 {
                            MoneyText(amount: pnl, size: 12, signed: true,
                                      currencyCode: pos.currency ?? account.currency)
                        }
                    }
                }
                .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
            }
        }
    }

    // MARK: Recent orders (trades)

    @ViewBuilder private var ordersSection: some View {
        if let holdings = model.holdingsState?.value, !holdings.orders.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Recent trades").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
                GroupedCard(data: holdings.orders) { order in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: Theme.Spacing.xs) {
                                if let side = order.sideLabel {
                                    Text(side)
                                        .font(.hiveMono(10, weight: .bold))
                                        .foregroundStyle(sideTint(order.action))
                                }
                                Text(order.displaySymbol)
                                    .font(.hiveMono(15, weight: .semibold))
                                    .foregroundStyle(Theme.inkPrimary)
                            }
                            if let status = order.status {
                                Text(status.capitalized)
                                    .font(.hiveBody(11))
                                    .foregroundStyle(Theme.inkSecondary)
                            }
                        }
                        Spacer(minLength: Theme.Spacing.md)
                        VStack(alignment: .trailing, spacing: 2) {
                            if let qty = order.quantity, let price = order.price {
                                Text("\(unitsLabel(qty)) @ \(money(price, order.currency ?? account.currency))")
                                    .font(.hiveBody(12))
                                    .foregroundStyle(Theme.inkPrimary)
                            }
                            if let when = orderDateLabel(order) {
                                Text(when).font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
                            }
                        }
                    }
                    .frame(minHeight: Theme.minTouchTarget - 2 * Theme.Spacing.md)
                }
            }
        }
    }

    private func sideTint(_ action: String?) -> Color {
        switch action?.uppercased() {
        case "BUY": return Theme.income
        case "SELL": return Theme.expense
        default: return Theme.inkSecondary
        }
    }

    private func unitsLabel(_ units: Decimal) -> String {
        units.formatted(.number.precision(.fractionLength(0...4)))
    }

    /// Best-effort short date from an ISO-8601 order timestamp.
    private func orderDateLabel(_ order: OrderDTO) -> String? {
        guard let raw = order.executedAt ?? order.placedAt else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return String(raw.prefix(10)) }
        return date.formatted(.dateTime.month(.abbreviated).day())
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

    /// Holdings for SnapTrade investment accounts. `nil` = not an investment account
    /// (the section is hidden); otherwise a normal load lifecycle.
    private(set) var holdingsState: LoadState<HoldingsDTO>?

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

    /// Load SnapTrade positions + recent orders for a connected investment account.
    func loadHoldings(snaptradeAccountId: String) async {
        if holdingsState?.value == nil { holdingsState = .loading }
        do {
            let resp = try await api.send(
                .get("/api/snaptrade/accounts/\(snaptradeAccountId)/holdings"),
                as: HoldingsDTO.self
            )
            holdingsState = (resp.positions.isEmpty && resp.orders.isEmpty) ? .empty : .loaded(resp)
        } catch let error as APIError {
            if case .cancelled = error { return }
            holdingsState = .failed(error)
        } catch {
            holdingsState = .failed(.network)
        }
    }
}
