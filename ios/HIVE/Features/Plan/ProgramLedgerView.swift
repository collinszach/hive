import SwiftUI
import Observation

/// Recent points-earning transactions for one program. Opened by tapping a
/// `ProgramCard` on Plan → Points. Loads `GET /api/points/ledger?days=90` and
/// filters client-side to this program (the endpoint has no program filter).
struct ProgramLedgerView: View {
    let program: ProgramSummary

    @Environment(\.dismiss) private var dismiss
    @State private var model = ProgramLedgerViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        header.hiveEntrance(0)
                        LoadStateView(
                            state: model.state,
                            emptyTitle: "No recent activity",
                            emptyMessage: "Points you earn on this program over the last 90 days will show up here.",
                            emptyIcon: "sparkles",
                            onRetry: { Task { await model.load(program: program.program) } }
                        ) { entries in
                            VStack(spacing: Theme.Spacing.md) {
                                ForEach(Array(entries.enumerated()), id: \.element.id) { i, e in
                                    LedgerRow(entry: e).hiveEntrance(min(i + 1, 6))
                                }
                            }
                        } skeleton: {
                            SkeletonList(count: 6)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle(program.program)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
        .task { await model.load(program: program.program) }
    }

    private var header: some View {
        RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text(program.hasManualBalance ? "Balance" : "Earned · 90d").hiveLabelStyle()
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    PointsText(points: program.displayPoints, size: 34, weight: .medium)
                    Text("pts").font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                }
                if let threshold = program.redemptionThreshold, threshold > 0 {
                    Text(program.aboveThreshold
                         ? "Ready to redeem"
                         : "Redeem at \(threshold.formatted(.number.grouping(.automatic))) pts")
                        .font(.hiveBody(13))
                        .foregroundStyle(program.aboveThreshold ? Theme.honeyBright : Theme.inkSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Ledger row

private struct LedgerRow: View {
    let entry: PointsLedgerEntry

    var body: some View {
        Card {
            HStack(alignment: .center, spacing: Theme.Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.merchant ?? entry.category ?? "Transaction")
                        .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Spacing.xs) {
                        Text(DateOnly.shortLabel(entry.date))
                        if let context = entry.subcategory ?? entry.category {
                            Text("·")
                            Text(context).lineLimit(1)
                        }
                    }
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    PointsText(points: Int(entry.pointsEarned.rounded()), size: 16, weight: .semibold)
                    Text("\(earnRateLabel)×")
                        .font(.hiveMono(12)).foregroundStyle(Theme.honeyBright)
                }
            }
        }
    }

    private var earnRateLabel: String {
        let r = entry.earnRate
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }
}

// MARK: - View model

@MainActor
@Observable
final class ProgramLedgerViewModel {
    private(set) var state: LoadState<[PointsLedgerEntry]> = .loading

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load(program: String) async {
        if state.value == nil { state = .loading }
        do {
            let all = try await api.send(
                .get("/api/points/ledger", query: [.init(name: "days", value: "90")]),
                as: [PointsLedgerEntry].self
            )
            let mine = all.filter { $0.program == program }
            state = mine.isEmpty ? .empty : .loaded(mine)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
