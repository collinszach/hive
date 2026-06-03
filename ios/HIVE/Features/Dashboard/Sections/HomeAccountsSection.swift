import SwiftUI

/// Home · Accounts. Baseline flat list (ported from the original dashboard). **Epic H5**
/// upgrades this to grouped Cash / Cards / Investments with subtotals — see
/// `docs/ios/HOME-SCREEN-SPEC.md`. Backed by `GET /api/dashboard/summary` (accounts slice).
struct HomeAccountsSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let accounts) where !accounts.isEmpty:
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
            case .loading:
                SkeletonList(count: 3)
            default:
                EmptyView()
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

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
