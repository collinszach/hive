import SwiftUI
import Charts

/// Home · Net-worth pulse (Epic H4).
///
/// Backed by `GET /api/net-worth/history?days=30` → `[NetWorthSnapshot]`.
/// Renders a slim card with the current net-worth amount, a 30-day delta badge,
/// and a sparkline chart — all in the standard Home section contract.
struct HomeNetWorthSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let snapshots) where snapshots.count >= 2:
                card(snapshots)
            case .loading:
                SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()   // empty / failed / < 2 points → section hides itself
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    // MARK: - Card

    private func card(_ snapshots: [NetWorthSnapshot]) -> some View {
        let first   = snapshots.first!
        let last    = snapshots.last!
        let delta   = last.netWorth - first.netWorth
        let isGain  = delta >= 0
        let pct: Double? = {
            guard first.netWorth != 0 else { return nil }
            let d = (delta as NSDecimalNumber).doubleValue
            let b = (first.netWorth as NSDecimalNumber).doubleValue
            return d / b * 100
        }()

        return Button(action: {
            Haptics.selection()
            NotificationRouter.shared.pending = .insights
        }) {
            Card {
                HStack(alignment: .center, spacing: Theme.Spacing.lg) {

                    // Left — label + amount + delta badge
                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text("Net worth").hiveLabelStyle()

                        MoneyText(amount: last.netWorth, size: 20, weight: .semibold)

                        deltaBadge(isGain: isGain, delta: delta, pct: pct)
                    }

                    Spacer(minLength: 0)

                    // Right — sparkline
                    sparkline(snapshots)
                        .frame(width: 100, height: 44)
                }
            }
        }
        .buttonStyle(.plain)
        // Accessibility: collapse into one element
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Net worth")
        .accessibilityValue(accessibilityValue(
            amount: last.netWorth,
            isGain: isGain,
            pct: pct
        ))
    }

    // MARK: - Delta badge

    @ViewBuilder
    private func deltaBadge(isGain: Bool, delta: Decimal, pct: Double?) -> some View {
        HStack(spacing: 2) {
            Image(systemName: isGain ? "arrow.up.right" : "arrow.down.right")
                .font(.hiveMono(10))
                .foregroundStyle(isGain ? Theme.income : Theme.expense)

            if let pct {
                Text(String(format: "%.1f%%", abs(pct)))
                    .font(.hiveMono(11))
                    .foregroundStyle(isGain ? Theme.income : Theme.expense)
            }
        }
    }

    // MARK: - Sparkline

    private func sparkline(_ snapshots: [NetWorthSnapshot]) -> some View {
        // Build (Date, Double) pairs; skip snapshots that can't be parsed.
        let points: [(date: Date, value: Double)] = snapshots.compactMap { snap in
            guard let d = snap.date else { return nil }
            return (d, (snap.netWorth as NSDecimalNumber).doubleValue)
        }

        return Chart(points, id: \.date) { point in
            LineMark(
                x: .value("Date", point.date),
                y: .value("Net worth", point.value)
            )
            .foregroundStyle(Theme.blue)
            .interpolationMethod(.monotone)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .accessibilityHidden(true)   // parent element carries full a11y description
    }

    // MARK: - Accessibility helpers

    private func accessibilityValue(amount: Decimal, isGain: Bool, pct: Double?) -> String {
        let formattedAmount = amount.formatted(
            .currency(code: "USD").precision(.fractionLength(2))
        )
        guard let pct else { return formattedAmount }
        let dir = isGain ? "up" : "down"
        return "\(formattedAmount), \(dir) \(String(format: "%.1f", abs(pct))) percent over 30 days"
    }

    // MARK: - Model

    @MainActor @Observable
    final class Model {
        private(set) var state: LoadState<[NetWorthSnapshot]> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }
            do {
                let snapshots = try await api.send(
                    .get("/api/net-worth/history?days=30"),
                    as: [NetWorthSnapshot].self
                )
                if snapshots.count < 2 {
                    state = .empty
                } else {
                    state = .loaded(snapshots)
                }
            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }
    }
}
