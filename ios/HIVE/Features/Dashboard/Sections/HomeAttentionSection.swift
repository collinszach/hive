import SwiftUI

// MARK: - Private data model

private struct AttentionItem: Identifiable {
    let id: String
    let icon: String
    let tint: Color
    let title: String
    let detail: String
    let rank: Int
}

// MARK: - Section

/// Home · Attention feed (Epic H2). Merges pace alerts, bills due soon, unreviewed
/// anomalies, and points-redemption nudges into a single prioritized list (max 5 items).
///
/// Contract mirrors `HomeCategoriesSection`: self-contained view + private `@Observable`
/// model, loads on `.task(id: token)`, hides itself when empty, routes auth-expiry up.
struct HomeAttentionSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let items) where !items.isEmpty:
                content(items)
            case .loading:
                SkeletonList(count: 3)
            default:
                EmptyView()   // empty / failed → section simply disappears
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    private func content(_ items: [AttentionItem]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HomeSectionHeader(title: "Needs your attention")
            GroupedCard(data: items) { item in
                itemRow(item)
            }
        }
    }

    private func itemRow(_ item: AttentionItem) -> some View {
        Button(action: {
            // TODO: deep-link to the relevant tab
        }) {
            HStack(spacing: Theme.Spacing.md) {
                // Icon badge
                ZStack {
                    RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                        .fill(item.tint.opacity(0.12))
                        .frame(width: 36, height: 36)
                    Image(systemName: item.icon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(item.tint)
                }

                // Text stack
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(Theme.inkPrimary)
                    Text(item.detail)
                        .font(.hiveBody(12))
                        .foregroundStyle(Theme.inkSecondary)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.inkTertiary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Model

    @MainActor @Observable
    final class Model {
        fileprivate private(set) var state: LoadState<[AttentionItem]> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }

            // First call: detect auth expiry explicitly on pace-alerts; other sources degrade gracefully.
            do {
                async let paceResult   = api.send(.get("/api/dashboard/pace-alerts"), as: [PaceAlert].self)
                async let billsResult  = api.send(.get("/api/subscriptions/upcoming?days=7"), as: [UpcomingBill].self)
                async let summaryResult = api.send(.get("/api/dashboard/summary"), as: DashboardSummary.self)
                async let pointsResult = api.send(.get("/api/points/summary"), as: PointsSummary.self)

                let pace    = try await paceResult          // auth-expiry guard: throw propagates
                let bills   = (try? await billsResult)   ?? []
                let summary = try? await summaryResult
                let points  = try? await pointsResult

                let items = Self.buildItems(pace: pace, bills: bills, summary: summary, points: points)
                state = items.isEmpty ? .empty : .loaded(items)

            } catch let error as APIError {
                state = .failed(error)
                state.reportAuthExpiry(onAuthExpired)
            } catch {
                state = .failed(.network)
            }
        }

        // MARK: Item assembly

        private static func buildItems(
            pace: [PaceAlert],
            bills: [UpcomingBill],
            summary: DashboardSummary?,
            points: PointsSummary?
        ) -> [AttentionItem] {
            var items: [AttentionItem] = []

            // 1. Pace alerts
            for alert in pace {
                let isDanger = alert.severity == "danger"
                let overFormatted = alert.overBy.formatted(
                    .currency(code: "USD").precision(.fractionLength(0))
                )
                items.append(AttentionItem(
                    id: "pace-\(alert.category)",
                    icon: isDanger ? "exclamationmark.triangle.fill" : "chart.line.uptrend.xyaxis",
                    tint: isDanger ? Theme.expense : Theme.warning,
                    title: "\(alert.category) projected over budget",
                    detail: "Trending \(overFormatted) over",
                    rank: isDanger ? 0 : 30
                ))
            }

            // 2. Bills due soon
            for bill in bills {
                let detail: String
                switch bill.daysAway {
                case 0:  detail = "Due today"
                case 1:  detail = "Due tomorrow"
                default: detail = "Due in \(bill.daysAway) days"
                }
                let amountStr = bill.amount.formatted(
                    .currency(code: "USD").precision(.fractionLength(0))
                )
                items.append(AttentionItem(
                    id: "bill-\(bill.id)",
                    icon: "calendar",
                    tint: Theme.warning,
                    title: "\(bill.name) \(amountStr)",
                    detail: detail,
                    rank: 10 + bill.daysAway
                ))
            }

            // 3. Anomalies
            if let anomalies = summary?.unreviewedAnomalies, anomalies.count > 0 {
                let plural = anomalies.count == 1 ? "transaction" : "transactions"
                items.append(AttentionItem(
                    id: "anomalies",
                    icon: "sparkle.magnifyingglass",
                    tint: Theme.warning,
                    title: "\(anomalies.count) flagged \(plural)",
                    detail: anomalies.latestReason ?? "Unusual activity detected",
                    rank: 40
                ))
            }

            // 4. Redemption nudges (honey tint — rewards context only)
            if let pointsSummary = points {
                for program in pointsSummary.programs where program.aboveThreshold {
                    let balanceStr = program.displayPoints.formatted()
                    let thresholdStr = program.redemptionThreshold.map { $0.formatted() } ?? "threshold"
                    items.append(AttentionItem(
                        id: "redeem-\(program.program)",
                        icon: "gift.fill",
                        tint: Theme.honey,
                        title: "\(program.program) — time to redeem",
                        detail: "\(balanceStr) pts (threshold: \(thresholdStr))",
                        rank: 50
                    ))
                }
            }

            // Sort by rank, then cap at 5
            return items.sorted { $0.rank < $1.rank }.prefix(5).map { $0 }
        }
    }
}
