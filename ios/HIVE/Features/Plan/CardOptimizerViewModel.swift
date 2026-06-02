import SwiftUI
import Observation

/// Backs `CardOptimizerView` — "which card should I use at checkout?". Takes a
/// category/subcategory/amount and asks the backend for cards ranked by redemption
/// value across programs (`GET /api/points/optimize`). The UI presents the result
/// in points + earn rate only; dollar valuations are intentionally not shown.
@MainActor
@Observable
final class CardOptimizerViewModel {
    /// Defaults to the most common everyday-spend case so the screen shows a useful
    /// answer the moment it opens.
    var category: String = "Food & Drink"
    var subcategory: String?
    var amount: Decimal = 100

    private(set) var state: LoadState<[CardOption]> = .loading

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    /// Subcategory options for the currently-selected category, plus a "no
    /// subcategory" sentinel handled by the view.
    var subcategoryOptions: [String] { Taxonomy.subcategories(for: category) }

    /// Reset the subcategory when the category changes — the old one won't apply.
    func selectCategory(_ cat: String) {
        guard cat != category else { return }
        category = cat
        subcategory = nil
    }

    func optimize() async {
        if state.value == nil { state = .loading }
        var query: [URLQueryItem] = [
            .init(name: "category", value: category),
            .init(name: "amount", value: NSDecimalNumber(decimal: amount).stringValue),
        ]
        if let sub = subcategory, !sub.isEmpty {
            query.append(.init(name: "subcategory", value: sub))
        }
        do {
            let resp = try await api.send(.get("/api/points/optimize", query: query), as: OptimizerResponse.self)
            state = resp.cards.isEmpty ? .empty : .loaded(resp.cards)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
