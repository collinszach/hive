import SwiftUI

/// Home · Investments pulse (Investing spec I3). Total portfolio value + unrealized
/// return (rise/fall); taps through to the full Investments screen. Hides itself when
/// there are no holdings or SnapTrade isn't connected. Backed by `GET /api/snaptrade/portfolio`.
struct HomeInvestmentsSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()
    @State private var showPortfolio = false

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let p) where p.totalValue > 0:
                card(p)
            case .loading:
                SkeletonBlock(height: 84, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()   // no holdings / not connected / failed → hide
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    private func card(_ p: PortfolioDTO) -> some View {
        let gain = p.totalUnrealizedPnl >= 0
        let tint = gain ? Theme.income : Theme.expense
        return Button {
            Haptics.selection(); showPortfolio = true
        } label: {
            Card {
                HStack(alignment: .center, spacing: Theme.Spacing.lg) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text("Investments").hiveLabelStyle()
                        MoneyText(amount: p.totalValue, size: 20, weight: .semibold, currencyCode: p.currency)
                    }
                    Spacer(minLength: 0)
                    HStack(spacing: 4) {
                        Image(systemName: gain ? "arrow.up.right" : "arrow.down.right")
                            .font(.hiveMono(11, weight: .bold)).foregroundStyle(tint)
                        if let pct = p.totalReturnPct {
                            Text("\(gain ? "+" : "")\(String(format: "%.1f", pct))%")
                                .font(.hiveMono(13, weight: .semibold)).foregroundStyle(tint)
                        } else {
                            MoneyText(amount: p.totalUnrealizedPnl, size: 13, weight: .semibold,
                                      signed: true, currencyCode: p.currency)
                        }
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.inkTertiary)
                }
            }
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showPortfolio) {
            NavigationStack { InvestmentsView() }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Investments")
        .accessibilityValue(
            p.totalValue.formatted(.currency(code: p.currency).precision(.fractionLength(0)))
            + (p.totalReturnPct.map { ", \(gain ? "up" : "down") \(String(format: "%.1f", abs($0))) percent" } ?? "")
        )
    }

    @MainActor @Observable
    final class Model {
        private(set) var state: LoadState<PortfolioDTO> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }
            do {
                state = .loaded(try await api.send(.get("/api/snaptrade/portfolio"), as: PortfolioDTO.self))
            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }
    }
}
