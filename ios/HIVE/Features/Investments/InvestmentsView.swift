import SwiftUI

/// Investments — aggregated portfolio across every connected SnapTrade account.
/// Hero (value + total return), allocation, positions ranked by value, recent trades.
/// A *position* surface: blue + income/expense tints, never honey. (Investing spec I2.)
struct InvestmentsView: View {
    @State private var model = InvestmentsViewModel()

    var body: some View {
        Screen(title: "Investments", refresh: { await model.load() }) {
            LoadStateView(
                state: model.state,
                emptyTitle: "No holdings",
                emptyMessage: "Connect an investment account to see your portfolio.",
                emptyIcon: "chart.pie",
                onRetry: { Task { await model.load() } }
            ) { portfolio in
                content(portfolio)
            } skeleton: {
                VStack(spacing: Theme.Spacing.md) {
                    SkeletonBlock(height: 120, cornerRadius: Theme.Radius.card)
                    SkeletonBlock(height: 160, cornerRadius: Theme.Radius.card)
                    SkeletonList(count: 5)
                }
            }
        }
        .task { if model.state.value == nil { await model.load() } }
    }

    @ViewBuilder
    private func content(_ p: PortfolioDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            hero(p).hiveEntrance(0)
            if !p.positions.isEmpty {
                allocation(p).hiveEntrance(1)
                positionsSection(p).hiveEntrance(2)
            }
            if !p.recentOrders.isEmpty {
                tradesSection(p).hiveEntrance(3)
            }
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: Hero

    private func hero(_ p: PortfolioDTO) -> some View {
        let gain = p.totalUnrealizedPnl >= 0
        let tint = gain ? Theme.income : Theme.expense
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Portfolio value · \(p.accountCount) account\(p.accountCount == 1 ? "" : "s")")
                .hiveLabelStyle()
            MoneyHero(amount: p.totalValue, size: 40)
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: gain ? "arrow.up.right" : "arrow.down.right")
                    .font(.hiveMono(12, weight: .bold)).foregroundStyle(tint)
                MoneyText(amount: p.totalUnrealizedPnl, size: 15, weight: .semibold,
                          signed: true, currencyCode: p.currency)
                if let pct = p.totalReturnPct {
                    Text("(\(gain ? "+" : "")\(String(format: "%.1f", pct))%)")
                        .font(.hiveMono(13)).foregroundStyle(tint)
                }
                Text("total return").font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.xl)
        .background(Theme.surface)
        .background(Theme.heroLift)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
            .stroke(Theme.borderDefault, lineWidth: 1))
        .hiveCardShadow()
        .accessibilityElement(children: .combine)
    }

    // MARK: Allocation (top weights)

    private func allocation(_ p: PortfolioDTO) -> some View {
        let top = Array(p.positions.prefix(6))
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Allocation").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: Theme.Spacing.sm) {
                    ForEach(top) { pos in
                        VStack(spacing: 4) {
                            HStack {
                                Text(pos.displaySymbol)
                                    .font(.hiveMono(13, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                                Spacer()
                                Text("\(String(format: "%.0f", pos.weightPct))%")
                                    .font(.hiveMono(12)).foregroundStyle(Theme.inkSecondary)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Theme.borderDefault).frame(height: 5)
                                    Capsule().fill(Theme.blue)
                                        .frame(width: max(geo.size.width * pos.weightPct / 100, 3), height: 5)
                                }
                            }
                            .frame(height: 5)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(pos.displaySymbol), \(Int(pos.weightPct)) percent of portfolio")
                    }
                }
            }
        }
    }

    // MARK: Positions

    private func positionsSection(_ p: PortfolioDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Positions").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            GroupedCard(data: p.positions) { pos in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pos.displaySymbol)
                            .font(.hiveMono(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                        if let units = pos.units {
                            Text(unitsLabel(units) + (pos.description.map { " · \($0)" } ?? ""))
                                .font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary).lineLimit(1)
                        }
                    }
                    Spacer(minLength: Theme.Spacing.md)
                    VStack(alignment: .trailing, spacing: 2) {
                        MoneyText(amount: pos.marketValue ?? 0, size: 15, currencyCode: pos.currency ?? "USD")
                        if let pnl = pos.openPnl, pnl != 0 {
                            MoneyText(amount: pnl, size: 12, signed: true, currencyCode: pos.currency ?? "USD")
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    // MARK: Recent trades

    private func tradesSection(_ p: PortfolioDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Recent trades").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            GroupedCard(data: p.recentOrders) { order in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\((order.action ?? "").capitalized) \(order.symbol ?? order.description ?? "—")")
                            .font(.hiveBody(14, weight: .medium)).foregroundStyle(Theme.inkPrimary).lineLimit(1)
                        if let status = order.status {
                            Text(status.capitalized).font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                        }
                    }
                    Spacer()
                    if let qty = order.filledQuantity ?? order.quantity, let price = order.price {
                        Text("\(unitsLabel(qty)) @ \(price.formatted(.currency(code: order.currency ?? "USD").precision(.fractionLength(2))))")
                            .font(.hiveMono(12)).foregroundStyle(Theme.inkSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func unitsLabel(_ units: Decimal) -> String {
        let d = (units as NSDecimalNumber).doubleValue
        let s = d == d.rounded() ? String(Int(d)) : String(format: "%.4g", d)
        return "\(s) sh"
    }
}

@MainActor @Observable
final class InvestmentsViewModel {
    private(set) var state: LoadState<PortfolioDTO> = .loading
    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            state = .loaded(try await api.send(.get("/api/snaptrade/portfolio"), as: PortfolioDTO.self))
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
