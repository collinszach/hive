import Foundation

/// Mirrors `HoldingsOut` from `backend/app/api/snaptrade.py` — positions and recent
/// orders for one connected SnapTrade investment account. All money is `Decimal`.
struct HoldingsDTO: Decodable {
    let totalValue: Decimal?
    let currency: String?
    let positions: [PositionDTO]
    let orders: [OrderDTO]

    private enum CodingKeys: String, CodingKey {
        case totalValue, currency, positions, orders
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalValue = try c.decodeIfPresent(Decimal.self, forKey: .totalValue)
        currency = try c.decodeIfPresent(String.self, forKey: .currency)
        positions = (try? c.decode([PositionDTO].self, forKey: .positions)) ?? []
        orders = (try? c.decode([OrderDTO].self, forKey: .orders)) ?? []
    }
}

/// One open position. Mirrors `PositionOut`.
struct PositionDTO: Decodable, Identifiable {
    let symbol: String?
    let description: String?
    let units: Decimal?
    let price: Decimal?
    let marketValue: Decimal?
    let openPnl: Decimal?
    let avgPrice: Decimal?
    let currency: String?
    let type: String?

    /// Stable-enough identity for a SwiftUI list; positions are unique per symbol.
    var id: String { symbol ?? description ?? UUID().uuidString }

    /// Display ticker, falling back to the long description.
    var displaySymbol: String { symbol ?? description ?? "—" }
}

/// One recent order (trade). Mirrors `OrderOut`.
struct OrderDTO: Decodable, Identifiable {
    let action: String?
    let status: String?
    let symbol: String?
    let description: String?
    let quantity: Decimal?
    let filledQuantity: Decimal?
    let price: Decimal?
    let orderType: String?
    let placedAt: String?
    let executedAt: String?
    let currency: String?

    var id: String {
        [symbol, action, placedAt].compactMap { $0 }.joined(separator: "-")
            .ifEmpty(UUID().uuidString)
    }

    var displaySymbol: String { symbol ?? description ?? "—" }

    /// "BUY" / "SELL" uppercased for the side badge.
    var sideLabel: String? { action?.uppercased() }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}
