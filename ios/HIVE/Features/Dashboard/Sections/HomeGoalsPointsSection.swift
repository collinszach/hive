import SwiftUI

/// Home · Goals & points glance (Epic H6).
///
/// Shows up to 2 in-progress goals (blue progress bars) and the top rewards
/// program by estimated value (honey chip when above redemption threshold).
/// Self-contained: owns its model, loads on `.task(id: token)`, collapses when
/// there is nothing to show, and routes auth-expiry up to the parent screen.
///
/// Backed by:
///   - `GET /api/goals`          → `[GoalDTO]`  (HomeDTOs.swift)
///   - `GET /api/points/summary` → `PointsSummary` (PlanDTO.swift)
struct HomeGoalsPointsSection: View {
    let token: Int
    let onAuthExpired: () -> Void
    @State private var model = Model()

    var body: some View {
        Group {
            switch model.state {
            case .loaded(let data):
                content(data)
            case .loading:
                SkeletonBlock(height: 88, cornerRadius: Theme.Radius.card)
            default:
                EmptyView()
            }
        }
        .task(id: token) { await model.load(onAuthExpired: onAuthExpired) }
    }

    // MARK: - Render

    @ViewBuilder
    private func content(_ data: GoalsPoints) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HomeSectionHeader(title: "Goals & rewards")

            if !data.goals.isEmpty {
                goalsCard(data.goals)
            }

            if let program = data.topProgram {
                pointsCard(program)
            }
        }
    }

    private func goalsCard(_ goals: [GoalDTO]) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                ForEach(Array(goals.enumerated()), id: \.element.id) { index, goal in
                    if index > 0 {
                        Rectangle()
                            .fill(Theme.borderSubtle)
                            .frame(height: 1)
                    }
                    goalRow(goal)
                }
            }
        }
    }

    private func goalRow(_ goal: GoalDTO) -> some View {
        Button(action: { /* TODO: route to goal detail / Plan→Goals */ }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                // Name + percentage
                HStack(alignment: .firstTextBaseline) {
                    Text(goal.name)
                        .font(.hiveBody(15, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text("\(Int(goal.fraction * 100))%")
                        .font(.hiveBody(13, weight: .medium))
                        .foregroundStyle(Theme.blue)
                        .monospacedDigit()
                }

                // Progress bar — blue for goals (planning surface, not rewards)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Theme.borderDefault)
                            .frame(height: 6)
                        Capsule()
                            .fill(Theme.blue)
                            .frame(width: max(geo.size.width * goal.fraction, 6), height: 6)
                    }
                }
                .frame(height: 6)

                // Caption: current / target amounts
                HStack {
                    Text(
                        "\(goal.currentAmount.formatted(.currency(code: "USD").precision(.fractionLength(0)))) of \(goal.targetAmount.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
                    )
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkTertiary)
                    Spacer()
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(goal.name)
        .accessibilityValue(
            "\(Int(goal.fraction * 100)) percent complete, " +
            "\(goal.currentAmount.formatted(.currency(code: "USD").precision(.fractionLength(0)))) " +
            "of \(goal.targetAmount.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
        )
    }

    private func pointsCard(_ program: ProgramSummary) -> some View {
        Button(action: { /* TODO: route to Plan→Points */ }) {
            RewardsCard {
                HStack(spacing: Theme.Spacing.md) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text(program.program)
                            .font(.hiveBody(13, weight: .medium))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                        PointsText(points: program.displayPoints, size: 20, weight: .semibold)
                        Text(program.estimatedValueDollars.formatted(
                            .currency(code: "USD").precision(.fractionLength(0))
                        ) + " est. value")
                        .font(.hiveBody(12))
                        .foregroundStyle(Theme.inkTertiary)
                    }
                    Spacer()
                    if program.aboveThreshold {
                        redeemChip
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(program.program)
        .accessibilityValue(
            "\(program.displayPoints.formatted(.number.grouping(.automatic))) points, " +
            "estimated value \(program.estimatedValueDollars.formatted(.currency(code: "USD").precision(.fractionLength(0))))" +
            (program.aboveThreshold ? ", ready to redeem" : "")
        )
    }

    private var redeemChip: some View {
        Text("Redeem")
            .font(.hiveBody(11, weight: .semibold))
            .foregroundStyle(Theme.base)
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)
            .background(Theme.honey)
            .clipShape(Capsule())
    }

    // MARK: - Model

    @MainActor @Observable
    final class Model {
        fileprivate private(set) var state: LoadState<GoalsPoints> = .loading
        private let api: APIClient
        init(api: APIClient = .shared) { self.api = api }

        func load(onAuthExpired: () -> Void) async {
            if state.value == nil { state = .loading }

            // Fetch both endpoints concurrently; a points failure doesn't blank goals.
            // `onAuthExpired` is handled here on the main actor (not passed into the
            // concurrent task) to satisfy Swift 6 strict concurrency.
            async let goalsResult = fetchGoals()
            async let pointsResult: PointsSummary? = fetchPoints()

            let goalsRes = await goalsResult
            let summary = await pointsResult

            var goals: [GoalDTO] = []
            switch goalsRes {
            case .success(let g):
                goals = g
            case .failure(let error):
                if error.isAuthExpiry { state = .failed(error); onAuthExpired(); return }
                // Non-auth failure → leave goals empty; the points half may still render.
            }

            let kept = Self.selectGoals(goals)
            let topProgram = Self.topProgram(from: summary)

            if kept.isEmpty && topProgram == nil {
                state = .empty
            } else {
                state = .loaded(GoalsPoints(goals: kept, topProgram: topProgram))
            }
        }

        /// Fetch goals — returns the error so the caller (on the main actor) can decide
        /// whether it's an auth-expiry that should bounce to sign-in.
        private func fetchGoals() async -> Result<[GoalDTO], APIError> {
            do {
                return .success(try await api.send(.get("/api/goals"), as: [GoalDTO].self))
            } catch let error as APIError {
                return .failure(error)
            } catch {
                return .failure(.network)
            }
        }

        /// Fetch points summary — silently returns nil on any failure.
        private func fetchPoints() async -> PointsSummary? {
            try? await api.send(.get("/api/points/summary"), as: PointsSummary.self)
        }

        /// Keep the top 1–2 goals: prefer in-progress (0 < fraction < 1) sorted by
        /// descending fraction (closest to done first), then fall back to highest fraction.
        private static func selectGoals(_ goals: [GoalDTO]) -> [GoalDTO] {
            let inProgress = goals.filter { $0.fraction > 0 && $0.fraction < 1 }
                                  .sorted { $0.fraction > $1.fraction }
            if !inProgress.isEmpty {
                return Array(inProgress.prefix(2))
            }
            // Fallback: anything, sorted by highest fraction
            let sorted = goals.sorted { $0.fraction > $1.fraction }
            return Array(sorted.prefix(2))
        }

        /// Pick the top rewards program: first aboveThreshold one if any,
        /// otherwise the one with the highest estimatedValueDollars.
        private static func topProgram(from summary: PointsSummary?) -> ProgramSummary? {
            guard let programs = summary?.programs, !programs.isEmpty else { return nil }
            if let above = programs.first(where: { $0.aboveThreshold }) { return above }
            return programs.max(by: { $0.estimatedValueDollars < $1.estimatedValueDollars })
        }
    }
}

// MARK: - Private result type

private struct GoalsPoints {
    let goals: [GoalDTO]
    let topProgram: ProgramSummary?
}
