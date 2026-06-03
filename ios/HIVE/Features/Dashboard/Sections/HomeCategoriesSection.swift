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
                Text("Top categories").hiveLabelStyle()
                Chart(categories) { item in
                    BarMark(
                        x: .value("Amount", (item.total as NSDecimalNumber).doubleValue),
                        y: .value("Category", item.category)
                    )
                    .foregroundStyle(Theme.blue)
                    .cornerRadius(4)
                }
                .chartXAxis {
                    AxisMarks(preset: .aligned) { value in
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(Decimal(amount).formatted(
                                    .currency(code: "USD").precision(.fractionLength(0))
                                ))
                                .font(.hiveMono(10))
                                .foregroundStyle(Theme.inkTertiary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(preset: .aligned, position: .leading) { _ in
                        AxisValueLabel().font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
                    }
                }
                .frame(height: CGFloat(categories.count) * 32 + 24)
                .accessibilityElement()
                .accessibilityLabel("Top spending categories")
                .accessibilityValue(categories.map {
                    "\($0.category) \($0.total.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
                }.joined(separator: ", "))
            }
        }
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
