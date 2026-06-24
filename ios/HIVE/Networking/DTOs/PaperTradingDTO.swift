import Foundation

/// DTOs for the paper-trading signal engine. Mirror the FastAPI response shapes in
/// `backend/app/api/paper_trading.py`. The client decoder uses
/// `.convertFromSnakeCase`, so snake_case JSON maps to these camelCase properties.
/// Money is `Decimal`; scores/returns are `Double`; dates arrive as ISO strings.

/// Mirrors `PortfolioOut`. A sandboxed virtual portfolio (simulated, no real money).
struct PaperPortfolioDTO: Decodable {
    let id: String
    let name: String
    let status: String
    let startingCash: Decimal
    let currentCash: Decimal
    let benchmarkSymbol: String
    let startedAt: String?
    let evaluationEndsAt: String?
    // `strategy_params` (free-form) intentionally omitted.
}

/// Mirrors `SignalOut`. Point-in-time signal for one symbol.
struct PaperSignalDTO: Decodable, Identifiable {
    let symbol: String
    let asOf: String
    let signalScore: Double
    let signalLabel: String
    let confidence: Double
    let regimeLabel: String?
    let source: String

    var id: String { "\(symbol)-\(asOf)-\(source)" }
}

/// Mirrors `TradeOut`. One simulated trade execution.
struct PaperTradeDTO: Decodable, Identifiable {
    let id: String
    let symbol: String
    let side: String
    let quantity: Decimal
    let price: Decimal
    let executorType: String
    let signalScore: Double?
    let asOf: String
    let executedAt: String?
}

/// Mirrors `PerformancePointOut`. One daily mark-to-market point.
struct PaperPerformancePointDTO: Decodable, Identifiable {
    let asOf: String
    let cash: Decimal
    let positionsValue: Decimal
    let portfolioValue: Decimal
    let benchmarkValue: Decimal?

    var id: String { asOf }
}

/// Mirrors `WatchlistSymbolOut`.
struct PaperWatchlistSymbolDTO: Decodable, Identifiable {
    let symbol: String
    let isActive: Bool

    var id: String { symbol }
}

/// Mirrors the `/report` response (`compute_evaluation_report` + `portfolio_id`).
struct PaperEvaluationReportDTO: Decodable {
    let portfolioId: String
    let startingCash: Decimal
    let finalValue: Decimal
    let totalReturn: Double?
    let cagr: Double?
    let benchmarkReturn: Double?
    let alpha: Double?
    let beta: Double?
    let alphaAnnualized: Double?
    let benchmarkSharpe: Double?
    let sharpe: Double?
    let maxDrawdown: Double?
    let winRate: Double?
    let avgWin: Decimal?
    let avgLoss: Decimal?
    let tradesClosed: Int
    let daysElapsed: Int
    let daysTarget: Int
    let status: String
}

/// Mirrors `BacktestRunOut`. The durable train→validation record.
struct PaperBacktestRunDTO: Decodable, Identifiable {
    let id: String
    let portfolioId: String?
    let trainStart: String
    let trainEnd: String
    let validationStart: String
    let validationEnd: String
    let trainSharpe: Double?
    let validationSharpe: Double?
    let validationTotalReturn: Double?
    let validationVsBenchmark: Double?
    let createdAt: String?
    // `selected_params` (free-form) intentionally omitted.
}

/// Encodable body for `POST /api/paper-trading/portfolio` (encoder is `.convertToSnakeCase`).
struct CreatePaperPortfolioBody: Encodable {
    var name: String = "Signal Engine"
    var startingCash: Decimal = 100_000
    var benchmarkSymbol: String = "SPY"
}

/// Encodable body for `POST /api/paper-trading/backtest`. Dates are `YYYY-MM-DD` strings.
struct StartPaperBacktestBody: Encodable {
    let symbols: [String]
    let trainStart: String
    let trainEnd: String
    let validationStart: String
    let validationEnd: String
}
