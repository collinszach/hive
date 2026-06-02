import Foundation

/// Mirrors `ForecastResponse` / `DayForecast` from `backend/app/api/forecast.py`.
/// The daily series is **future-only** (the next `periods` days); each point carries a
/// predicted value plus a Prophet confidence band (`lower`…`upper`).
struct ForecastResponse: Decodable {
    let category: String
    let projectedTotal: Decimal
    let dailyForecast: [DayForecast]
    let historyDays: Int
    let periods: Int
}

struct DayForecast: Decodable, Identifiable {
    let date: String
    let predicted: Decimal
    let lower: Decimal
    let upper: Decimal

    var id: String { date }
    var day: Date? { DateOnly.parse(date) }
}
