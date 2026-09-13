import Foundation

// MARK: - Travel planner
//
// Mirrors `backend/app/api/travel.py`. The planner's job is one question: pay cash or
// burn points, in which currency, and can it actually be covered. Every option is
// reduced server-side to a `trueCost` — cash out plus the baseline value of the points
// burnt — so an award and a cash quote rank on the same axis. Points are never free.

/// A trip being considered, planned, or taken.
struct TripDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let destination: String?
    let startDate: String?
    let endDate: String?
    let travelers: Int
    /// dreaming | planning | booked | taken
    let status: String
    let cashBudget: Decimal?
    let notes: String?
    let legCount: Int
    /// Sum of the chosen option per leg. Nil until something is priced.
    let estimatedTrueCost: Decimal?

    var statusLabel: String {
        switch status {
        case "planning": return "Planning"
        case "booked":   return "Booked"
        case "taken":    return "Taken"
        default:         return "Dreaming"
        }
    }

    static func == (l: TripDTO, r: TripDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// One way to book a leg — a cash quote or an award.
struct TravelOptionDTO: Decodable, Identifiable, Hashable {
    let id: String
    let legId: String
    let source: String
    let label: String?
    let cashPrice: Decimal?
    let pointsPrice: Decimal?
    let program: String?
    let fees: Decimal
    let url: String?
    let quotedOn: String?
    let isSelected: Bool
    let notes: String?
    /// Value extracted per point. Nil for a cash option, or until a cash price is known.
    let centsPerPoint: Double?
    /// great | good | fair | poor | cash | unknown
    let rating: String
    let verdict: String
    /// Cash out plus the baseline value of points burnt — the ranking key.
    let trueCost: Decimal?
    let isBest: Bool

    var isAward: Bool { (pointsPrice ?? 0) > 0 }

    static func == (l: TravelOptionDTO, r: TravelOptionDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// One bookable piece of a trip.
struct TripLegDTO: Decodable, Identifiable, Hashable {
    let id: String
    let tripId: String
    /// flight | hotel | car | activity
    let kind: String
    let title: String?
    let origin: String?
    let destination: String?
    let legDate: String?
    let sortOrder: Int
    let notes: String?
    let options: [TravelOptionDTO]

    var displayTitle: String {
        if let t = title, !t.isEmpty { return t }
        return kind.prefix(1).uppercased() + kind.dropFirst()
    }

    var icon: String {
        switch kind {
        case "hotel":    return "bed.double"
        case "car":      return "car"
        case "activity": return "ticket"
        default:         return "airplane"
        }
    }

    static func == (l: TripLegDTO, r: TripLegDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// A trip with its legs and their ranked options — the comparison board.
struct TripDetailDTO: Decodable {
    let id: String
    let name: String
    let destination: String?
    let startDate: String?
    let endDate: String?
    let travelers: Int
    let status: String
    let cashBudget: Decimal?
    let notes: String?
    let legCount: Int
    let estimatedTrueCost: Decimal?
    let legs: [TripLegDTO]
}

/// Where the points for an award could come from.
struct PointsRouteDTO: Decodable, Identifiable, Hashable {
    let program: String
    let available: Double
    let needed: Double
    let direct: Bool
    let partner: String?
    let ratio: Double
    let shortfall: Double
    let covered: Bool
    let typicalDays: Int
    /// Present on transfers: they're one-way and can't be undone.
    let warning: String?

    var id: String { "\(program)-\(partner ?? "direct")" }
}

/// A balance with its transfer reach, plus currency-specific advice.
struct TravelBalanceDTO: Decodable, Identifiable {
    let program: String
    let balance: Double
    let transferable: Bool
    let partnerCount: Int
    let advice: String?

    var id: String { program }
}

struct TravelBalancesDTO: Decodable {
    let programs: [TravelBalanceDTO]
    /// Transfer data is curated and goes stale — always shown, never implied live.
    let partnersVerifiedOn: String
}

// MARK: - Request bodies

struct TripCreate: Encodable {
    let name: String
    var destination: String? = nil
    var status: String = "dreaming"
}

struct LegCreate: Encodable {
    var kind: String = "flight"
    var title: String? = nil
}

struct OptionCreate: Encodable {
    var source: String = "manual_cash"
    var label: String? = nil
    var cashPrice: Double? = nil
    var pointsPrice: Double? = nil
    var program: String? = nil
    var fees: Double = 0
    var quotedOn: String? = nil
}
