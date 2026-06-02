import Foundation

// MARK: - Planning & Forecast (Epic 8)
//
// Mirrors `backend/app/api/planning.py`. Money is `Decimal` end-to-end (JSON numbers
// decode cleanly into Decimal); rates stay `Double` since they're assumptions, not money.

/// One planning scenario. Mirrors `_scenario_dict`. The baseline always exists.
struct ScenarioDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let isBaseline: Bool

    private enum CodingKeys: String, CodingKey { case id, name, isBaseline }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        isBaseline = try c.decodeIfPresent(Bool.self, forKey: .isBaseline) ?? false
    }

    static func == (l: ScenarioDTO, r: ScenarioDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Projection assumptions. Mirrors `_assumptions_dict`.
struct AssumptionsDTO: Decodable {
    let annualReturnPct: Double
    let annualInflationPct: Double
    let effectiveTaxRatePct: Double
    let emergencyFloor: Decimal
    let autoInvestSurplus: Bool
    let bandSpreadPct: Double
    let baseMonthlyExpenses: Decimal?
}

/// Echo of what fed the engine. Mirrors the `inputs` block of `get_projection`.
struct ProjectionInputsDTO: Decodable {
    let horizonMonths: Int
    let startDate: String
    let startingCash: Decimal
    let startingInvestments: Decimal
    let baseMonthlyExpenses: Decimal
    let incomeStreams: Int
    let events: Int
}

/// One projected month. Mirrors `MonthPoint`. `date` is an ISO first-of-month string.
struct MonthPointDTO: Decodable, Identifiable {
    let month: Int
    let date: String
    let income: Decimal
    let expenses: Decimal
    let cash: Decimal
    let investments: Decimal
    let netWorth: Decimal
    let netWorthLow: Decimal
    let netWorthHigh: Decimal

    var id: Int { month }

    /// Parsed first-of-month date for charting. Kept UTC so the bucket never shifts.
    var monthDate: Date { PlanningDateParser.parse(date) }
}

/// Full projection payload. Mirrors `get_projection` (scenario + assumptions + inputs
/// + the spread of `ProjectionResult`).
struct ProjectionResponse: Decodable {
    let scenario: ScenarioDTO
    let assumptions: AssumptionsDTO
    let inputs: ProjectionInputsDTO
    let points: [MonthPointDTO]
    let finalNetWorth: Decimal
    let minCash: Decimal
    let minCashMonth: Int
    let minCashDate: String
    let totalIncome: Decimal
    let totalExpenses: Decimal

    /// True when the cash-runway trough dips negative — the plan goes underwater.
    var runsOutOfCash: Bool { minCash < 0 }
    var minCashDateParsed: Date { PlanningDateParser.parse(minCashDate) }
}

/// Body for `POST /api/planning/scenarios`.
struct ScenarioCreateBody: Encodable {
    let name: String
}

/// Shared parser for the backend's `YYYY-MM-DD` month strings. The API client's
/// decoder uses `.iso8601` for `Date`, but these are date-only strings decoded as
/// `String`, so we parse them here in UTC.
enum PlanningDateParser {
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parse(_ s: String) -> Date {
        formatter.date(from: s) ?? Date()
    }
}
