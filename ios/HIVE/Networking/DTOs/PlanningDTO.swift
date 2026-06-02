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

// MARK: - Income streams (mirrors `_income_dict` / `IncomeStreamBody`)

/// One recurring income (or, with `kind == "expense"`, recurring outflow) stream.
struct IncomeStreamDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let kind: String?
    let monthlyAmount: Decimal
    let frequency: String
    let startDate: String
    let endDate: String?
    let growthPct: Double
    let taxable: Bool
    let isActive: Bool

    static func == (l: IncomeStreamDTO, r: IncomeStreamDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Body for `POST /api/planning/scenarios/{id}/income`. Nil optionals are omitted.
struct IncomeStreamCreateBody: Encodable {
    let name: String
    let kind: String?
    let monthlyAmount: Decimal
    let startDate: String
    let endDate: String?
    let growthPct: Double
    let taxable: Bool
}

// MARK: - Life events (mirrors `_event_dict` / `EventBody`)

/// One future cash event — one-off or recurring, inflow or outflow, to cash or investments.
struct PlanEventDTO: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let amount: Decimal
    let kind: String        // inflow | outflow
    let target: String      // cash | investment
    let recurrence: String  // once | monthly | quarterly | semiannual | annual
    let eventDate: String
    let endDate: String?
    let growthPct: Double
    let category: String?
    let notes: String?
    let isActive: Bool

    static func == (l: PlanEventDTO, r: PlanEventDTO) -> Bool { l.id == r.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Body for `POST /api/planning/scenarios/{id}/events`. Nil optionals are omitted.
struct EventCreateBody: Encodable {
    let name: String
    let amount: Decimal
    let eventDate: String
    let kind: String
    let target: String
    let recurrence: String
    let endDate: String?
    let growthPct: Double
    let category: String?
    let notes: String?
}

// MARK: - Assumptions edit (mirrors `AssumptionsUpdate`, PUT is exclude_unset)

/// Body for `PUT /api/planning/scenarios/{id}/assumptions`. Custom-encoded so that
/// `baseMonthlyExpenses` can be sent as explicit `null` to clear the override and fall
/// back to auto-derived spend — synthesized `encodeIfPresent` would drop it instead.
struct AssumptionsUpdateBody: Encodable {
    var annualReturnPct: Double
    var annualInflationPct: Double
    var effectiveTaxRatePct: Double
    var emergencyFloor: Decimal
    var autoInvestSurplus: Bool
    var bandSpreadPct: Double
    /// `nil` → auto-derive; a value → override.
    var baseMonthlyExpenses: Decimal?

    private enum CodingKeys: String, CodingKey {
        case annualReturnPct = "annual_return_pct"
        case annualInflationPct = "annual_inflation_pct"
        case effectiveTaxRatePct = "effective_tax_rate_pct"
        case emergencyFloor = "emergency_floor"
        case autoInvestSurplus = "auto_invest_surplus"
        case bandSpreadPct = "band_spread_pct"
        case baseMonthlyExpenses = "base_monthly_expenses"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(annualReturnPct, forKey: .annualReturnPct)
        try c.encode(annualInflationPct, forKey: .annualInflationPct)
        try c.encode(effectiveTaxRatePct, forKey: .effectiveTaxRatePct)
        try c.encode(emergencyFloor, forKey: .emergencyFloor)
        try c.encode(autoInvestSurplus, forKey: .autoInvestSurplus)
        try c.encode(bandSpreadPct, forKey: .bandSpreadPct)
        // Explicit encode (not encodeIfPresent) so nil serializes as JSON null.
        try c.encode(baseMonthlyExpenses, forKey: .baseMonthlyExpenses)
    }
}

extension PlanningDateParser {
    private static let outFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Serialize a `Date` back to the backend's `yyyy-MM-dd` (UTC) form.
    static func format(_ date: Date) -> String { outFormatter.string(from: date) }
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
