import SwiftUI

/// Paper Trading — an AI/ML signal engine in a sandboxed virtual portfolio.
/// Simulated, no real money. A *position/research* surface: blue + income/expense
/// tints, never honey (rewards-only). Backed by `/api/paper-trading/*`.
struct PaperTradingView: View {
    @State private var model = PaperTradingViewModel()

    var body: some View {
        Screen(title: "Paper Trading", refresh: { await model.load() }) {
            LoadStateView(
                state: model.state,
                emptyTitle: "Paper trading",
                emptyMessage: "A sandboxed virtual portfolio.",
                emptyIcon: "flask",
                onRetry: { Task { await model.load() } }
            ) { data in
                content(data)
            } skeleton: {
                VStack(spacing: Theme.Spacing.md) {
                    SkeletonBlock(height: 140, cornerRadius: Theme.Radius.card)
                    SkeletonBlock(height: 120, cornerRadius: Theme.Radius.card)
                    SkeletonList(count: 4)
                }
            }
        }
        .task {
            if model.state.value == nil { await model.load() }
            // Near-real-time: poll every 30s while the screen is visible. `load()` only
            // shows the skeleton on first load, so refreshes update in place (no flicker).
            // The task is cancelled automatically when the view disappears.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                if Task.isCancelled { break }
                await model.load()
            }
        }
    }

    @ViewBuilder
    private func content(_ data: PaperTradingData) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            if let p = data.portfolio {
                hero(p, report: data.report).hiveEntrance(0)
                if let report = data.report {
                    reportSection(report).hiveEntrance(1)
                }
                backtestSection(data.backtest, watchlist: data.watchlist).hiveEntrance(2)
                if !data.signals.isEmpty { signalsSection(data.signals).hiveEntrance(3) }
                if !data.trades.isEmpty { tradesSection(data.trades).hiveEntrance(4) }
            } else {
                emptyState.hiveEntrance(0)
                backtestSection(data.backtest, watchlist: data.watchlist).hiveEntrance(1)
                if !data.signals.isEmpty { signalsSection(data.signals).hiveEntrance(2) }
            }
            watchlistSection(data.watchlist).hiveEntrance(4)
            disclaimer
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: Hero

    @ViewBuilder
    private func hero(_ p: PaperPortfolioDTO, report: PaperEvaluationReportDTO?) -> some View {
        BlueCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text("\(p.name) · paper portfolio").hiveLabelStyle()
                        MoneyText(amount: report?.finalValue ?? p.currentCash, size: 30, weight: .semibold,
                                  currencyCode: "USD")
                        Text("Benchmark \(p.benchmarkSymbol) · simulated, no real money")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                    }
                    Spacer(minLength: 0)
                    if let days = daysLeft(p.evaluationEndsAt) {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("\(days)").font(.hiveMono(22, weight: .semibold)).foregroundStyle(Theme.blue)
                            Text("days left").font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                        }
                    }
                }
                HStack(spacing: Theme.Spacing.sm) {
                    statTile("Total return", pct(report?.totalReturn), tone: tone(report?.totalReturn))
                    statTile("vs SPY", pct(report?.alpha), tone: tone(report?.alpha))
                    statTile("Sharpe", report?.sharpe.map { String(format: "%.2f", $0) } ?? "—", tone: .neutral)
                }
            }
        }
    }

    // MARK: Evaluation report

    @ViewBuilder
    private func reportSection(_ r: PaperEvaluationReportDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Evaluation report").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: Theme.Spacing.sm) {
                    metricRow("CAGR", pct(r.cagr), "Benchmark", pct(r.benchmarkReturn))
                    metricRow("Alpha (ann., β-adj)", pct(r.alphaAnnualized),
                              "Beta", r.beta.map { String(format: "%.2f", $0) } ?? "—")
                    metricRow("Sharpe", r.sharpe.map { String(format: "%.2f", $0) } ?? "—",
                              "Benchmark Sharpe", r.benchmarkSharpe.map { String(format: "%.2f", $0) } ?? "—")
                    metricRow("Max drawdown", pct(r.maxDrawdown), "Win rate",
                              r.winRate.map { "\(Int(($0 * 100).rounded()))%" } ?? "—")
                    metricRow("Trades closed", "\(r.tradesClosed)", "Status", r.status)
                }
            }
        }
    }

    // MARK: Backtest (train → validation)

    @ViewBuilder
    private func backtestSection(_ run: PaperBacktestRunDTO?, watchlist: [PaperWatchlistSymbolDTO]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Backtest").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            BlueCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                    if let run {
                        Text("Tuned on \(run.trainStart) → \(run.trainEnd), proven on \(run.validationStart) → \(run.validationEnd).")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(spacing: Theme.Spacing.sm) {
                            statTile("Train Sharpe", run.trainSharpe.map { String(format: "%.2f", $0) } ?? "—", tone: .neutral)
                            statTile("Validation Sharpe", run.validationSharpe.map { String(format: "%.2f", $0) } ?? "—", tone: .neutral)
                            statTile("Val. return", pct(run.validationTotalReturn), tone: tone(run.validationTotalReturn))
                        }
                    } else {
                        Text("Learn parameters on historical data and prove them out-of-sample before trading forward. Runs in the background — pull to refresh for the result.")
                            .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Button {
                        Haptics.selection()
                        Task { await model.runBacktest(symbols: watchlist.map { $0.symbol }) }
                    } label: {
                        Text(model.backtestQueued ? "Backtest queued — refresh shortly"
                             : run == nil ? "Run backtest" : "Re-run backtest")
                            .font(.hiveBody(14, weight: .semibold))
                            .foregroundStyle(watchlist.isEmpty ? Theme.inkGhost : Theme.blue)
                    }
                    .disabled(model.backtestQueued || watchlist.isEmpty)
                }
            }
        }
    }

    // MARK: Signals

    @ViewBuilder
    private func signalsSection(_ signals: [PaperSignalDTO]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Latest signals").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    ForEach(Array(signals.prefix(12))) { s in
                        HStack {
                            Text(s.symbol).font(.hiveMono(14, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                            Text(s.signalLabel.uppercased())
                                .font(.hiveBody(11, weight: .semibold)).foregroundStyle(labelTone(s.signalLabel))
                            Spacer()
                            Text(s.regimeLabel ?? "—").font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                            Text(String(format: "%.2f", s.signalScore))
                                .font(.hiveMono(13, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                                .frame(width: 48, alignment: .trailing)
                        }
                        .padding(.vertical, Theme.Spacing.xs)
                        if s.id != signals.prefix(12).last?.id {
                            Divider().overlay(Theme.borderSubtle)
                        }
                    }
                }
            }
        }
    }

    // MARK: Trades

    @ViewBuilder
    private func tradesSection(_ trades: [PaperTradeDTO]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Trades").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    ForEach(Array(trades.prefix(15))) { t in
                        HStack {
                            Text(t.asOf).font(.hiveMono(12)).foregroundStyle(Theme.inkTertiary)
                            Text(t.symbol).font(.hiveMono(14, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                            Text(t.side.uppercased())
                                .font(.hiveBody(11, weight: .semibold))
                                .foregroundStyle(t.side == "buy" ? Theme.income : Theme.expense)
                            Spacer()
                            MoneyText(amount: t.price, size: 13, weight: .medium, currencyCode: "USD")
                        }
                        .padding(.vertical, Theme.Spacing.xs)
                        if t.id != trades.prefix(15).last?.id {
                            Divider().overlay(Theme.borderSubtle)
                        }
                    }
                }
            }
        }
    }

    // MARK: Watchlist

    @ViewBuilder
    private func watchlistSection(_ watchlist: [PaperWatchlistSymbolDTO]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Watchlist").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                if watchlist.isEmpty {
                    Text("No symbols yet. Add tickers on the web to expand the watchlist.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkTertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    FlowChips(symbols: watchlist.map { $0.symbol })
                }
            }
        }
    }

    // MARK: Empty state

    @ViewBuilder
    private var emptyState: some View {
        BlueCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                Text("No paper portfolio yet").font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                Text("Start a virtual portfolio. The engine generates daily signals from technical indicators + ML regime detection and trades them in simulation against real market data for a 6-month evaluation.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    Haptics.selection(); Task { await model.create() }
                } label: {
                    Text(model.creating ? "Creating…" : "Start paper portfolio")
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.base)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.sm + 2)
                        .background(Theme.blue, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                }
                .disabled(model.creating)
            }
        }
    }

    @ViewBuilder
    private var disclaimer: some View {
        Text("Simulated results from a virtual portfolio. Not investment advice and not a prediction of future returns.")
            .font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Theme.Spacing.xs)
    }

    // MARK: Small building blocks

    private enum Tone { case up, down, neutral }

    private func tone(_ x: Double?) -> Tone {
        guard let x else { return .neutral }
        return x >= 0 ? .up : .down
    }

    @ViewBuilder
    private func statTile(_ label: String, _ value: String, tone: Tone) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
            Text(value).font(.hiveMono(16, weight: .semibold)).foregroundStyle(toneColor(tone))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.sm)
        .background(Theme.base, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
    }

    @ViewBuilder
    private func metricRow(_ l1: String, _ v1: String, _ l2: String, _ v2: String) -> some View {
        HStack {
            metricCell(l1, v1)
            Spacer()
            metricCell(l2, v2)
        }
    }

    @ViewBuilder
    private func metricCell(_ label: String, _ value: String) -> some View {
        HStack(spacing: Theme.Spacing.xs) {
            Text(label).font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
            Text(value).font(.hiveMono(13, weight: .semibold)).foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func toneColor(_ tone: Tone) -> Color {
        switch tone {
        case .up: return Theme.income
        case .down: return Theme.expense
        case .neutral: return Theme.inkPrimary
        }
    }

    private func labelTone(_ label: String) -> Color {
        switch label {
        case "buy": return Theme.income
        case "sell": return Theme.expense
        default: return Theme.inkTertiary
        }
    }

    private func pct(_ x: Double?) -> String {
        guard let x else { return "—" }
        let v = x * 100
        return "\(v >= 0 ? "+" : "")\(String(format: "%.2f", v))%"
    }

    private func daysLeft(_ iso: String?) -> Int? {
        guard let iso else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let end = f.date(from: iso) ?? plainISO(iso) else { return nil }
        let secs = end.timeIntervalSinceNow
        return max(0, Int((secs / 86_400).rounded(.up)))
    }

    /// Fallback for ISO datetimes without fractional seconds.
    private func plainISO(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }
}

/// Hero-card variant with a blue-tinted border (DESIGN: hero cards take a blue border).
private struct BlueCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(Theme.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                    .stroke(Theme.blueBorder, lineWidth: 1)
            )
    }
}

/// Minimal wrapping chip row for watchlist tickers.
private struct FlowChips: View {
    let symbols: [String]
    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 64), spacing: Theme.Spacing.xs)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.xs) {
            ForEach(symbols, id: \.self) { sym in
                Text(sym)
                    .font(.hiveMono(12, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                    .padding(.horizontal, Theme.Spacing.sm).padding(.vertical, 4)
                    .background(Theme.base, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control).stroke(Theme.borderSubtle, lineWidth: 1))
            }
        }
    }
}

// MARK: - ViewModel

/// Bundles every paper-trading payload one screen needs. `portfolio == nil` is the
/// valid "not created yet" state (a 404), not an error.
struct PaperTradingData {
    var portfolio: PaperPortfolioDTO?
    var report: PaperEvaluationReportDTO?
    var performance: [PaperPerformancePointDTO]
    var signals: [PaperSignalDTO]
    var trades: [PaperTradeDTO]
    var watchlist: [PaperWatchlistSymbolDTO]
    var backtest: PaperBacktestRunDTO?
}

@MainActor @Observable
final class PaperTradingViewModel {
    private(set) var state: LoadState<PaperTradingData> = .loading
    private(set) var creating = false
    private(set) var backtestQueued = false
    private let api: APIClient

    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            // Watchlist gates the surface (Pro-only). Signals exist regardless of a portfolio.
            let watchlist = try await api.send(.get("/api/paper-trading/watchlist"),
                                               as: [PaperWatchlistSymbolDTO].self)
            let signals = (try? await api.send(.get("/api/paper-trading/signals"),
                                               as: [PaperSignalDTO].self)) ?? []
            let backtest = (try? await api.send(.get("/api/paper-trading/backtest",
                                                     query: [URLQueryItem(name: "limit", value: "1")]),
                                                as: [PaperBacktestRunDTO].self))?.first

            var portfolio: PaperPortfolioDTO?
            var report: PaperEvaluationReportDTO?
            var trades: [PaperTradeDTO] = []
            var performance: [PaperPerformancePointDTO] = []
            do {
                portfolio = try await api.send(.get("/api/paper-trading/portfolio"),
                                               as: PaperPortfolioDTO.self)
                performance = (try? await api.send(.get("/api/paper-trading/performance"),
                                                   as: [PaperPerformancePointDTO].self)) ?? []
                trades = (try? await api.send(.get("/api/paper-trading/trades"),
                                              as: [PaperTradeDTO].self)) ?? []
                report = try? await api.send(.get("/api/paper-trading/report"),
                                             as: PaperEvaluationReportDTO.self)
            } catch {
                portfolio = nil  // 404 — no portfolio created yet
            }

            state = .loaded(PaperTradingData(
                portfolio: portfolio, report: report, performance: performance,
                signals: signals, trades: trades, watchlist: watchlist, backtest: backtest
            ))
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }

    func create() async {
        creating = true
        defer { creating = false }
        do {
            _ = try await api.send(.post("/api/paper-trading/portfolio"),
                                   body: CreatePaperPortfolioBody(), as: PaperPortfolioDTO.self)
            Haptics.success()
            await load()
        } catch {
            Haptics.error()
        }
    }

    /// Kick off a walk-forward backtest: validation = last 6 months, training = the ~2 years before it.
    func runBacktest(symbols: [String]) async {
        guard !symbols.isEmpty else { return }
        backtestQueued = true
        let day: TimeInterval = 86_400
        func iso(_ daysAgo: Int) -> String {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            f.timeZone = TimeZone(identifier: "UTC")
            return f.string(from: Date(timeIntervalSinceNow: -Double(daysAgo) * day))
        }
        let body = StartPaperBacktestBody(
            symbols: symbols,
            trainStart: iso(181 + 730), trainEnd: iso(181),
            validationStart: iso(180), validationEnd: iso(0)
        )
        do {
            try await api.send(.post("/api/paper-trading/backtest"), body: body)
            Haptics.success()
        } catch {
            Haptics.error()
            backtestQueued = false
        }
    }
}
