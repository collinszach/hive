import SwiftUI
import Charts

/// Home · Top categories. The **reference implementation** of the Home section contract
/// (`docs/ios/HOME-SCREEN-SPEC.md`): self-contained view + private `@Observable` model,
/// loads on `.task(id: token)`, hides itself when empty, routes auth-expiry up.
///
/// Backed by `GET /api/dashboard/summary` (the `top_categories` slice).
struct HomeCategoriesSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let categories) where !categories.isEmpty:
                card(categories)
            case .loading:
                SkeletonBlock(height: 180, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()   // empty / failed → the section simply doesn't appear
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    private func card(_ categories: [CategorySpend]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                HStack {
                    Text("Top categories").hiveLabelStyle()
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.inkGhost)
                }
                VStack(spacing: 0) {
                    ForEach(categories) { item in
                        categoryRow(item, max: (categories.first?.total ?? 1) as Decimal)
                    }
                }
            }
        }
    }

    private func categoryRow(_ item: CategorySpend, max: Decimal) -> some View {
        let router = NotificationRouter.shared
        return Button {
            Haptics.selection()
            router.openTransactions(accountId: nil, category: item.category)
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                Text(item.category)
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 110, alignment: .leading)
                    .lineLimit(1)
                GeometryReader { geo in
                    let pct = max > 0 ? CGFloat(truncating: (item.total / max) as NSDecimalNumber) : 0
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.05)).frame(height: 4)
                        Capsule()
                            .fill(Theme.blue.opacity(0.7))
                            .frame(width: geo.size.width * pct, height: 4)
                    }
                }
                .frame(height: 4)
                MoneyText(amount: item.total, size: 11, weight: .regular)
                    .foregroundStyle(Theme.inkTertiary)
                    .frame(width: 64, alignment: .trailing)
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Theme.inkGhost.opacity(0.5))
            }
            .padding(.vertical, 7)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(item.category), \(item.total.formatted(.currency(code: "USD").precision(.fractionLength(0))))")
    }

    @MainActor @Observable
    final class Model {
        private(set) var state: LoadState<[CategorySpend]> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }
            do {
                let summary = try await api.send(.get("/api/dashboard/summary"), as: DashboardSummary.self)
                state = summary.topCategories.isEmpty ? .empty : .loaded(summary.topCategories)
            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }
    }
}
