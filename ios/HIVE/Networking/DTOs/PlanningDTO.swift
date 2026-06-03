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
    /// `nil` → use live account balances at t=0; a value → assume this starting position
    /// (e.g. anticipated net cash/investments at the start of the modeled program).
    let startingCashOverride: Decimal?
    let startingInvestmentsOverride: Decimal?
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

/// One scenario template. Mirrors an entry of `GET /api/planning/presets`.
struct ScenarioPresetDTO: Decodable, Identifiable {
    let key: String
    let label: String
    let description: String

    var id: String { key }

    /// SF Symbol per known preset; a neutral fallback keeps unknown keys renderable.
    var icon: String {
        switch key {
        case "grad_school": return "graduationcap"
        case "home_purchase": return "house"
        case "new_baby": return "figure.and.child.holdinghands"
        default: return "sparkles"
        }
    }
}

/// Body for `POST /api/planning/scenarios/from-preset`.
struct PresetCreateBody: Encodable {
    let preset: String
    let name: String?
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
    /// `nil` → use live balances at t=0; a value → assume this starting position.
    var startingCashOverride: Decimal?
    var startingInvestmentsOverride: Decimal?

    private enum CodingKeys: String, CodingKey {
        case annualReturnPct = "annual_return_pct"
        case annualInflationPct = "annual_inflation_pct"
        case effectiveTaxRatePct = "effective_tax_rate_pct"
        case emergencyFloor = "emergency_floor"
        case autoInvestSurplus = "auto_invest_surplus"
        case bandSpreadPct = "band_spread_pct"
        case baseMonthlyExpenses = "base_monthly_expenses"
        case startingCashOverride = "starting_cash_override"
        case startingInvestmentsOverride = "starting_investments_override"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(annualReturnPct, forKey: .annualReturnPct)
        try c.encode(annualInflationPct, forKey: .annualInflationPct)
        try c.encode(effectiveTaxRatePct, forKey: .effectiveTaxRatePct)
        try c.encode(emergencyFloor, forKey: .emergencyFloor)
        try c.encode(autoInvestSurplus, forKey: .autoInvestSurplus)
        try c.encode(bandSpreadPct, forKey: .bandSpreadPct)
        // Explicit encode (not encodeIfPresent) so nil serializes as JSON null — clearing
        // an override back to the live/auto value.
        try c.encode(baseMonthlyExpenses, forKey: .baseMonthlyExpenses)
        try c.encode(startingCashOverride, forKey: .startingCashOverride)
        try c.encode(startingInvestmentsOverride, forKey: .startingInvestmentsOverride)
    }
}

// MARK: - AI advisor (Epic 10, mirrors `AdvisorResponse` in planning.py)

/// A JSON scalar that may arrive as a number or a boolean (`current`/`suggested` values).
/// Decoded permissively so a string slips through too, and rendered for display.
enum AdvisorScalar: Decodable, Hashable {
    case number(Double)
    case bool(Bool)
    case string(String)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let d = try? c.decode(Double.self) { self = .number(d); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        self = .string("—")
    }

    var doubleValue: Double? { if case let .number(d) = self { return d } else { return nil } }
    var boolValue: Bool? { if case let .bool(b) = self { return b } else { return nil } }

    var display: String {
        switch self {
        case .number(let d):
            // Whole numbers render without a trailing .0; fractions keep up to 2 places.
            return d == d.rounded() ? String(Int(d)) : d.formatted(.number.precision(.fractionLength(0...2)))
        case .bool(let b): return b ? "On" : "Off"
        case .string(let s): return s
        }
    }
}

/// One risk the advisor surfaced in the projection.
struct AdvisorRisk: Decodable, Identifiable, Hashable {
    let title: String
    let detail: String
    let severity: String   // low | medium | high

    var id: String { title + detail }

    private enum CodingKeys: String, CodingKey { case title, detail, severity }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? "Risk"
        detail = (try? c.decode(String.self, forKey: .detail)) ?? ""
        severity = ((try? c.decode(String.self, forKey: .severity)) ?? "medium").lowercased()
    }
}

/// One actionable assumption change the advisor recommends. `assumption` is one of the
/// tunable keys the backend whitelists, so it maps directly onto `AssumptionsUpdateBody`.
struct AdvisorSuggestion: Decodable, Identifiable, Hashable {
    let assumption: String
    let current: AdvisorScalar?
    let suggested: AdvisorScalar?
    let rationale: String

    var id: String { assumption + rationale }

    private enum CodingKeys: String, CodingKey { case assumption, current, suggested, rationale }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        assumption = (try? c.decode(String.self, forKey: .assumption)) ?? ""
        current = try? c.decodeIfPresent(AdvisorScalar.self, forKey: .current)
        suggested = try? c.decodeIfPresent(AdvisorScalar.self, forKey: .suggested)
        rationale = (try? c.decode(String.self, forKey: .rationale)) ?? ""
    }

    /// Human-readable label for the assumption key (matches the assumptions editor).
    var label: String {
        switch assumption {
        case "annual_return_pct": return "Annual return"
        case "annual_inflation_pct": return "Inflation"
        case "effective_tax_rate_pct": return "Effective tax rate"
        case "emergency_floor": return "Emergency floor"
        case "auto_invest_surplus": return "Auto-invest surplus"
        case "band_spread_pct": return "Confidence band"
        case "base_monthly_expenses": return "Monthly expenses"
        default: return assumption
        }
    }
}

/// Full advisor payload. Mirrors `AdvisorResponse`.
struct AdvisorResponse: Decodable {
    let summary: String
    let risks: [AdvisorRisk]
    let suggestions: [AdvisorSuggestion]
    let modelUsed: String

    private enum CodingKeys: String, CodingKey { case summary, risks, suggestions, modelUsed }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        summary = (try? c.decode(String.self, forKey: .summary)) ?? ""
        risks = (try? c.decode([AdvisorRisk].self, forKey: .risks)) ?? []
        suggestions = (try? c.decode([AdvisorSuggestion].self, forKey: .suggestions)) ?? []
        modelUsed = (try? c.decode(String.self, forKey: .modelUsed)) ?? "claude"
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
