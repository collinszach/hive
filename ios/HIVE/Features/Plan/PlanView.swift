import SwiftUI

/// Plan tab — two related-but-distinct planning surfaces behind a segmented control:
/// **Budgets** (spend vs. plan, this month) and **Points** (rewards value + redemption).
/// Points is the only place honey/gold is allowed — it IS the rewards context.
struct PlanView: View {
    enum Segment: String, CaseIterable { case budgets = "Budgets", points = "Points" }

    @Environment(AppState.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var model = PlanViewModel()
    @State private var segment: Segment = .budgets
    @State private var budgetEditor: BudgetEditorTarget?
    @State private var ledgerProgram: ProgramSummary?
    @State private var showOptimizer = false

    var body: some View {
        Screen(title: "Plan", refresh: {
            await segment == .budgets ? model.loadBudgets() : model.loadPoints()
        }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                Picker("View", selection: $segment) {
                    ForEach(Segment.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .hiveEntrance(0)

                switch segment {
                case .budgets: budgets
                case .points:  points
                }
            }
            .padding(.top, Theme.Spacing.sm)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: segment)
        }
        .toolbar {
            if segment == .points {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.selection(); showOptimizer = true
                    } label: {
                        Image(systemName: "creditcard")
                    }
                    .foregroundStyle(Theme.honeyBright)
                    .accessibilityLabel("Find best card")
                }
            }
        }
        .task { await model.loadBudgets() }
        .onChange(of: segment) { _, seg in
            Haptics.selection()
            if seg == .points, model.pointsState.value == nil { Task { await model.loadPoints() } }
        }
        .sheet(item: $budgetEditor) { target in
            BudgetEditorView(
                target: target,
                monthLabel: MonthHelper.compactLabel(model.month),
                pickableCategories: model.unbudgetedCategories,
                onSave: { cat, amt, roll in await model.saveBudget(category: cat, amount: amt, rollover: roll) },
                onDelete: { id in await model.deleteBudget(id: id) }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $ledgerProgram) { program in
            ProgramLedgerView(program: program)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showOptimizer) {
            CardOptimizerView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: Budgets

    @ViewBuilder private var budgets: some View {
        MonthSwitcher(month: $model.month) { Task { await model.loadBudgets() } }
            .hiveEntrance(1)
        LoadStateView(
            state: model.budgetsState,
            emptyTitle: "No budgets yet",
            emptyMessage: "Set a monthly budget per category to track spending against a plan.",
            emptyIcon: "target",
            emptyAction: ("Add a budget", { budgetEditor = .new }),
            onRetry: { Task { await model.loadBudgets() } }
        ) { rows in
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                budgetHero.hiveEntrance(1)
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { i, b in
                        Button {
                            Haptics.selection(); budgetEditor = .edit(b)
                        } label: {
                            BudgetRowCard(budget: b)
                        }
                        .buttonStyle(.plain)
                        .hiveEntrance(min(i + 2, 6))
                    }
                }
                addBudgetButton.hiveEntrance(6)
            }
        } skeleton: {
            VStack(spacing: Theme.Spacing.md) {
                SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
                SkeletonList(count: 5)
            }
        }
    }

    private var addBudgetButton: some View {
        Button {
            Haptics.selection(); budgetEditor = .new
        } label: {
            Label("Add budget", systemImage: "plus")
                .font(.hiveBody(15, weight: .medium))
                .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                .foregroundStyle(Theme.blue)
        }
        .buttonStyle(.plain)
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
            .stroke(Theme.borderDefault, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }

    private var budgetHero: some View {
        let over = model.totalSpent > model.totalBudgeted
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Spent · \(MonthHelper.longLabel(model.month))").hiveLabelStyle()
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.sm) {
                MoneyHero(amount: model.totalSpent, size: 40)
                Text("of \(model.totalBudgeted.formatted(.currency(code: "USD").precision(.fractionLength(0))))")
                    .font(.hiveMono(15)).foregroundStyle(Theme.inkSecondary)
            }
            ProgressBar(
                fraction: model.totalBudgeted > 0
                    ? (model.totalSpent as NSDecimalNumber).doubleValue / (model.totalBudgeted as NSDecimalNumber).doubleValue
                    : 0,
                color: over ? Theme.expense : Theme.blue
            )
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
    }

    // MARK: Points

    @ViewBuilder private var points: some View {
        LoadStateView(
            state: model.pointsState,
            emptyTitle: "No rewards yet",
            emptyMessage: "Link a rewards card to start tracking the points you earn.",
            emptyIcon: "star",
            onRetry: { Task { await model.loadPoints() } }
        ) { summary in
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                pointsHero(summary).hiveEntrance(1)
                if !readyToRedeem(summary).isEmpty {
                    redemptionNudge(readyToRedeem(summary)).hiveEntrance(2)
                }
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(Array(summary.programs.enumerated()), id: \.element.id) { i, p in
                        Button {
                            Haptics.selection(); ledgerProgram = p
                        } label: {
                            ProgramCard(program: p)
                        }
                        .buttonStyle(.plain)
                        .hiveEntrance(min(i + 2, 6))
                    }
                }
            }
        } skeleton: {
            VStack(spacing: Theme.Spacing.md) {
                SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
                SkeletonList(count: 4)
            }
        }
    }

    /// Programs whose balance has crossed the redemption threshold (`REDEMPTION_THRESHOLDS`
    /// on the backend), surfaced as a nudge so big balances don't sit idle.
    private func readyToRedeem(_ s: PointsSummary) -> [ProgramSummary] {
        s.programs.filter(\.aboveThreshold)
    }

    /// Honey nudge banner. One ready program → tap opens its ledger; multiple → a
    /// summary heads-up directing attention to the cards below.
    @ViewBuilder
    private func redemptionNudge(_ ready: [ProgramSummary]) -> some View {
        let names = ready.map(\.program)
        let summary: String = {
            switch names.count {
            case 1: return "\(names[0]) is ready to redeem."
            case 2: return "\(names[0]) and \(names[1]) are ready to redeem."
            default: return "\(names[0]) and \(names.count - 1) more are ready to redeem."
            }
        }()
        let banner = RewardsCard {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: "gift.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.honeyBright)
                    .frame(width: 40, height: 40)
                    .background(Theme.honeyBright.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Time to redeem").font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Text(summary).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Theme.Spacing.sm)
                if ready.count == 1 {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        }

        if ready.count == 1, let only = ready.first {
            Button { Haptics.selection(); ledgerProgram = only } label: { banner }
                .buttonStyle(.plain)
        } else {
            banner
        }
    }

    private func pointsHero(_ s: PointsSummary) -> some View {
        // Rewards context → RewardsCard (honey treatment). Points only — never a
        // dollar valuation: the headline is the total points across all programs.
        let totalPoints = s.programs.reduce(0) { $0 + $1.displayPoints }
        return RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Total points").hiveLabelStyle()
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    PointsText(points: totalPoints, size: 40, weight: .semibold)
                    Text("pts").font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
                }
                Text("Across \(s.programs.count) program\(s.programs.count == 1 ? "" : "s")")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Budget row

struct BudgetRowCard: View {
    let budget: BudgetDTO

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack {
                    Text(budget.category)
                        .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                    Spacer()
                    MoneyText(amount: budget.actualSpend, size: 15, weight: .semibold)
                    Text("/ \(budget.effectiveBudget.formatted(.currency(code: "USD").precision(.fractionLength(0))))")
                        .font(.hiveMono(13)).foregroundStyle(Theme.inkSecondary)
                }
                ProgressBar(fraction: budget.fraction, color: barColor)
                HStack {
                    Text("\(Int(budget.pctUsed))% used")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    if budget.isOver {
                        Text("\((-budget.remaining).formatted(.currency(code: "USD").precision(.fractionLength(0)))) over")
                            .font(.hiveBody(12, weight: .medium)).foregroundStyle(Theme.expense)
                    } else {
                        Text("\(budget.remaining.formatted(.currency(code: "USD").precision(.fractionLength(0)))) left")
                            .font(.hiveBody(12)).foregroundStyle(Theme.income)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var barColor: Color {
        if budget.fraction > 1.0 { return Theme.expense }
        if budget.fraction >= 0.85 { return Theme.warning }
        return Theme.blue
    }
}

// MARK: - Program card

struct ProgramCard: View {
    let program: ProgramSummary

    var body: some View {
        RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack {
                    Text(program.program)
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Spacer()
                    if program.aboveThreshold {
                        Text("Ready to redeem")
                            .font(.hiveBody(11, weight: .semibold))
                            .foregroundStyle(Theme.honeyBright)
                    }
                }
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    PointsText(points: program.displayPoints, size: 26, weight: .medium)
                    Text(program.hasManualBalance ? "balance" : "earned · 90d")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }
                if let threshold = program.redemptionThreshold, threshold > 0 {
                    Text("Redeem at \(threshold.formatted(.number.grouping(.automatic))) pts")
                        .font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Progress bar

/// Thin track + fill, clamped to [0,1] visually. Color is passed in so semantics
/// (over-budget red, etc.) live with the caller.
struct ProgressBar: View {
    let fraction: Double
    var color: Color = Theme.blue
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.elevated)
                Capsule().fill(color)
                    .frame(width: max(0, min(1, fraction)) * geo.size.width)
            }
        }
        .frame(height: height)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }
}
