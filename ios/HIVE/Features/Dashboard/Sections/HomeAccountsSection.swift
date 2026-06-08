import SwiftUI

/// Home · Accounts (Epic H5). Grouped into Cash / Cards / Investments with per-group
/// subtotals — see `docs/ios/HOME-SCREEN-SPEC.md`. Credit balances read as amounts owed
/// (liability tint). Backed by `GET /api/dashboard/summary` (accounts slice).
struct HomeAccountsSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let accounts) where !accounts.isEmpty:
                content(accounts)
            case .loading:
                SkeletonList(count: 3)
            default:
                EmptyView()
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    // MARK: Grouping

    private enum AcctBucket: Int, CaseIterable {
        case cash, cards, investments, other
        var title: String {
            switch self {
            case .cash: "Cash"; case .cards: "Cards"
            case .investments: "Investments"; case .other: "Other"
            }
        }
        /// Credit balances are liabilities — show the subtotal/rows in the expense tint.
        var isLiability: Bool { self == .cards }

        static func of(_ type: String) -> AcctBucket {
            switch type.lowercased() {
            case "depository": return .cash
            case "credit": return .cards
            case "investment", "brokerage": return .investments
            default: return .other
            }
        }
    }

    @ViewBuilder
    private func content(_ accounts: [AccountSummary]) -> some View {
        let grouped = Dictionary(grouping: accounts) { AcctBucket.of($0.type) }
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            ForEach(AcctBucket.allCases, id: \.rawValue) { bucket in
                if let items = grouped[bucket], !items.isEmpty {
                    accountGroup(bucket, items)
                }
            }
        }
    }

    private func accountGroup(_ bucket: AcctBucket, _ items: [AccountSummary]) -> some View {
        let subtotal = items.reduce(Decimal(0)) { $0 + ($1.currentBalance ?? 0) }
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text(bucket.title).hiveLabelStyle()
                Spacer()
                MoneyText(amount: subtotal, size: 14, weight: .semibold)
                    .foregroundStyle(bucket.isLiability ? Theme.expense : Theme.inkPrimary)
            }
            .padding(.leading, Theme.Spacing.xs)
            GroupedCard(data: items) { account in
                accountRow(account, isLiability: bucket.isLiability, isCard: bucket == .cards)
            }
        }
    }

    private func accountRow(_ account: AccountSummary, isLiability: Bool, isCard: Bool) -> some View {
        // Tapping an account jumps to the Money tab pre-filtered to it.
        Button {
            Haptics.selection()
            NotificationRouter.shared.openTransactions(accountId: account.id, includeExcluded: !isCard)
        } label: {
            HStack {
                // Honey accent on every card in the Cards group (not just ones with a
                // matched card_slug — one card may not have a slug yet).
                if isCard {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(Theme.honey.opacity(0.9))
                        .frame(width: 4, height: 26)
                        .accessibilityHidden(true)
                        .padding(.trailing, Theme.Spacing.xs)
                }
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
                        .foregroundStyle(isLiability ? Theme.expense : Theme.inkPrimary)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.inkTertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("View transactions for \(account.name)")
    }

    // MARK: Model

    @MainActor @Observable
    final class Model {
        private(set) var state: LoadState<[AccountSummary]> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }
            do {
                let summary = try await api.send(.get("/api/dashboard/summary"), as: DashboardSummary.self)
                state = summary.accounts.isEmpty ? .empty : .loaded(summary.accounts)
            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }
    }
}
