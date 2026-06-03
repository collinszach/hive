import SwiftUI
import Charts

/// Forecast — the spreadsheet-replacement surface. Picks a scenario + horizon and
/// renders the projection: net-worth trajectory with a confidence band, the
/// cash-runway trough, and the assumptions/flows that produced it.
///
/// Editable: tap a scenario to switch, Compare to overlay a what-if, the Assumptions
/// "Edit" to tune rates/expenses, and the Income / Life-events "+" to add flows. Blue
/// throughout — this is not a rewards surface, so honey never appears here.
struct ForecastView: View {
    @State private var model = ForecastViewModel()
    @State private var showNewScenario = false
    @State private var showAssumptions = false
    @State private var showAddIncome = false
    @State private var showAddEvent = false
    @State private var incomeToDelete: IncomeStreamDTO?
    @State private var eventToDelete: PlanEventDTO?
    @State private var incomeToEdit: IncomeStreamDTO?
    @State private var eventToEdit: PlanEventDTO?
    @State private var confirmDeleteScenario = false

    var body: some View {
        Screen(title: "Forecast", refresh: { await model.loadProjection() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                controls.hiveEntrance(0)
                projection
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .task { await model.load(); await model.loadPresets() }
        .sheet(isPresented: $showNewScenario) {
            NewScenarioSheet { name in await model.createScenario(name: name) }
                .presentationDetents([.height(220)])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showAssumptions) {
            if let a = model.currentAssumptions {
                AssumptionsEditorSheet(current: a) { await model.saveAssumptions($0) }
            }
        }
        .sheet(isPresented: $showAddIncome) {
            IncomeFormSheet { await model.addIncome($0) }
        }
        .sheet(isPresented: $showAddEvent) {
            EventFormSheet { await model.addEvent($0) }
        }
        .sheet(item: $incomeToEdit) { stream in
            IncomeFormSheet(existing: stream) { await model.updateIncome(stream.id, $0) }
        }
        .sheet(item: $eventToEdit) { event in
            EventFormSheet(existing: event) { await model.updateEvent(event.id, $0) }
        }
        .confirmationDialog("Remove this income?", isPresented: incomeDeletePresented, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let s = incomeToDelete { Task { await model.deleteIncome(s) } }
            }
        } message: { Text(incomeToDelete?.name ?? "") }
        .confirmationDialog("Remove this event?", isPresented: eventDeletePresented, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let e = eventToDelete { Task { await model.deleteEvent(e) } }
            }
        } message: { Text(eventToDelete?.name ?? "") }
        .confirmationDialog("Delete \(model.selectedScenario?.name ?? "scenario")?",
                            isPresented: $confirmDeleteScenario, titleVisibility: .visible) {
            Button("Delete scenario", role: .destructive) { Task { await model.deleteSelectedScenario() } }
        } message: { Text("This removes its assumptions, income, and events.") }
    }

    private var incomeDeletePresented: Binding<Bool> {
        Binding(get: { incomeToDelete != nil }, set: { if !$0 { incomeToDelete = nil } })
    }
    private var eventDeletePresented: Binding<Bool> {
        Binding(get: { eventToDelete != nil }, set: { if !$0 { eventToDelete = nil } })
    }

    // MARK: Controls (scenario + horizon)

    @ViewBuilder private var controls: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            HStack {
                Text("Scenario").hiveLabelStyle()
                Spacer()
                scenarioMenu
            }
            Picker("Horizon", selection: horizonBinding) {
                ForEach(model.horizons, id: \.self) { m in
                    Text(horizonLabel(m)).tag(m)
                }
            }
            .pickerStyle(.segmented)
            if !model.comparableScenarios.isEmpty {
                HStack {
                    Text("Compare").hiveLabelStyle()
                    Spacer()
                    compareMenu
                }
            }
        }
    }

    private var compareMenu: some View {
        Menu {
            Button {
                Task { await model.setCompare(nil) }
            } label: {
                if model.compareScenarioId == nil { Label("None", systemImage: "checkmark") } else { Text("None") }
            }
            Divider()
            ForEach(model.comparableScenarios) { s in
                Button {
                    Task { await model.setCompare(s.id) }
                } label: {
                    if s.id == model.compareScenarioId { Label(s.name, systemImage: "checkmark") } else { Text(s.name) }
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.xs) {
                Text(model.compareScenario?.name ?? "None")
                    .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
            }
        }
        .accessibilityLabel("Compare against: \(model.compareScenario?.name ?? "None"). Tap to change.")
    }

    private var scenarioMenu: some View {
        Menu {
            ForEach(model.scenariosState.value ?? []) { s in
                Button {
                    Task { await model.selectScenario(s.id) }
                } label: {
                    if s.id == model.selectedScenarioId {
                        Label(s.name, systemImage: "checkmark")
                    } else {
                        Text(s.name)
                    }
                }
            }
            Divider()
            Button {
                Haptics.selection(); showNewScenario = true
            } label: {
                Label("New scenario", systemImage: "plus")
            }
            if !model.presets.isEmpty {
                Menu {
                    ForEach(model.presets) { preset in
                        Button {
                            Haptics.selection()
                            Task { await model.createFromPreset(preset) }
                        } label: {
                            Label(preset.label, systemImage: preset.icon)
                        }
                    }
                } label: {
                    Label("New from template", systemImage: "wand.and.stars")
                }
            }
            if model.selectedScenario?.isBaseline == false {
                Button(role: .destructive) {
                    Haptics.selection(); confirmDeleteScenario = true
                } label: {
                    Label("Delete scenario", systemImage: "trash")
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.xs) {
                Text(model.selectedScenario?.name ?? "Baseline")
                    .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.blue)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.blue)
            }
        }
        .accessibilityLabel("Scenario: \(model.selectedScenario?.name ?? "Baseline"). Tap to change.")
    }

    private var horizonBinding: Binding<Int> {
        Binding(get: { model.horizonMonths }, set: { m in Task { await model.setHorizon(m) } })
    }

    private func horizonLabel(_ months: Int) -> String {
        months % 12 == 0 ? "\(months / 12)y" : "\(months)mo"
    }

    // MARK: Projection

    @ViewBuilder private var projection: some View {
        LoadStateView(
            state: model.projectionState,
            emptyTitle: "Nothing to project",
            emptyMessage: "Add income and expenses to this scenario to see a forecast.",
            emptyIcon: "chart.line.uptrend.xyaxis",
            onRetry: { Task { await model.loadProjection() } }
        ) { resp in
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                netWorthHero(resp).hiveEntrance(1)
                trajectoryChart(resp).hiveEntrance(2)
                runwayCallout(resp).hiveEntrance(3)
                advisorSection.hiveEntrance(4)
                incomeSection.hiveEntrance(5)
                eventsSection.hiveEntrance(6)
                detailGrid(resp).hiveEntrance(7)
            }
        } skeleton: {
            VStack(spacing: Theme.Spacing.md) {
                SkeletonBlock(height: 110, cornerRadius: Theme.Radius.card)
                SkeletonBlock(height: 220, cornerRadius: Theme.Radius.card)
                SkeletonBlock(height: 80, cornerRadius: Theme.Radius.card)
            }
        }
    }

    private func netWorthHero(_ resp: ProjectionResponse) -> some View {
        let endLabel = ForecastFormat.monthYear(resp.points.last?.monthDate)
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Projected net worth · \(endLabel)").hiveLabelStyle()
            MoneyHero(amount: resp.finalNetWorth, size: 40)
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "arrow.up.forward")
                    .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.income)
                    .accessibilityHidden(true)
                Text("from \(resp.inputs.startingCash + resp.inputs.startingInvestments, format: .currency(code: "USD").precision(.fractionLength(0))) today")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
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

    private func trajectoryChart(_ resp: ProjectionResponse) -> some View {
        let points: [(Date, Double, Double, Double)] = resp.points.map {
            ($0.monthDate,
             ($0.netWorth as NSDecimalNumber).doubleValue,
             ($0.netWorthLow as NSDecimalNumber).doubleValue,
             ($0.netWorthHigh as NSDecimalNumber).doubleValue)
        }
        let comparePoints: [(Date, Double)] = (model.compareProjection?.points ?? []).map {
            ($0.monthDate, ($0.netWorth as NSDecimalNumber).doubleValue)
        }
        return Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                HStack {
                    Text("Net worth trajectory").font(.hiveBody(13, weight: .medium))
                        .foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    if let name = model.compareScenario?.name {
                        compareLegend(selected: model.selectedScenario?.name ?? "This", compare: name)
                    }
                }
                Chart {
                    ForEach(points, id: \.0) { point in
                        AreaMark(
                            x: .value("Month", point.0),
                            yStart: .value("Low", point.2),
                            yEnd: .value("High", point.3)
                        )
                        .foregroundStyle(Theme.blue.opacity(0.12))
                        .interpolationMethod(.monotone)

                        LineMark(x: .value("Month", point.0), y: .value("Net worth", point.1),
                                 series: .value("Series", "selected"))
                            .foregroundStyle(Theme.blue)
                            .lineStyle(StrokeStyle(lineWidth: 2))
                            .interpolationMethod(.monotone)
                    }
                    ForEach(comparePoints, id: \.0) { point in
                        LineMark(x: .value("Month", point.0), y: .value("Net worth", point.1),
                                 series: .value("Series", "compare"))
                            .foregroundStyle(Theme.inkSecondary)
                            .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                            .interpolationMethod(.monotone)
                    }
                }
                .frame(height: 200)
                .chartXAxis {
                    AxisMarks(preset: .aligned, values: .automatic(desiredCount: 4)) { _ in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits))
                            .font(.hiveBody(10)).foregroundStyle(Theme.inkTertiary)
                    }
                }
                .chartYAxis {
                    AxisMarks(preset: .aligned, position: .leading, values: .automatic(desiredCount: 3)) { value in
                        AxisValueLabel {
                            if let v = value.as(Double.self) {
                                Text(ForecastFormat.compactDollars(v))
                                    .font(.hiveMono(9)).foregroundStyle(Theme.inkTertiary)
                            }
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Projected net worth over \(resp.inputs.horizonMonths) months, ending at \(resp.finalNetWorth.formatted(.currency(code: "USD").precision(.fractionLength(0)))), with a confidence band.")
    }

    /// Cash-runway trough: the lowest cash balance and when. Turns red when the plan
    /// goes underwater (cash < 0) — the single most important failure signal here.
    private func runwayCallout(_ resp: ProjectionResponse) -> some View {
        let underwater = resp.runsOutOfCash
        let tint = underwater ? Theme.expense : Theme.income
        let icon = underwater ? "exclamationmark.triangle.fill" : "checkmark.shield.fill"
        let title = underwater ? "Cash runs out" : "Cash stays positive"
        let detail = underwater
            ? "Lowest cash \(resp.minCash.formatted(.currency(code: "USD").precision(.fractionLength(0)))) in \(ForecastFormat.monthYear(resp.minCashDateParsed))"
            : "Lowest cash \(resp.minCash.formatted(.currency(code: "USD").precision(.fractionLength(0)))) in \(ForecastFormat.monthYear(resp.minCashDateParsed))"
        return Card {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold)).foregroundStyle(tint)
                    .frame(width: 40, height: 40)
                    .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Text(detail).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
        }
    }

    private func compareLegend(selected: String, compare: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            HStack(spacing: 4) {
                Capsule().fill(Theme.blue).frame(width: 14, height: 2)
                Text(selected).font(.hiveBody(10)).foregroundStyle(Theme.inkTertiary).lineLimit(1)
            }
            HStack(spacing: 4) {
                Capsule().fill(Theme.inkSecondary).frame(width: 14, height: 2)
                Text(compare).font(.hiveBody(10)).foregroundStyle(Theme.inkTertiary).lineLimit(1)
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: Income & events

    private var incomeSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            incomeHeader
            switch model.incomeState {
            case .loaded(let streams):
                GroupedCard(data: streams) { s in
                    flowRow(name: s.name,
                            amount: s.monthlyAmount, suffix: "/mo",
                            detail: dateRange(s.startDate, s.endDate),
                            tint: Theme.income,
                            onTap: { incomeToEdit = s },
                            onDelete: { incomeToDelete = s })
                }
            default:
                emptyFlowCard(message: "No income yet. Add a salary, stipend, or side income — or predict it from your history.")
            }
        }
    }

    /// Income header with a menu: add manually, or predict an editable stream from history.
    private var incomeHeader: some View {
        HStack {
            Text("Income").hiveLabelStyle()
            Spacer()
            Menu {
                Button { Haptics.selection(); showAddIncome = true } label: {
                    Label("Add income", systemImage: "plus")
                }
                Button { Haptics.selection(); Task { await model.predictIncomeFromHistory() } } label: {
                    Label("Predict from history", systemImage: "wand.and.stars")
                }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.blue)
                    .frame(width: 30, height: 30)
                    .background(Theme.blueDim, in: Circle())
            }
            .accessibilityLabel("Add income")
        }
        .padding(.leading, Theme.Spacing.xs)
    }

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            sectionHeader(title: "Life events", systemImage: "plus") { Haptics.selection(); showAddEvent = true }
            switch model.eventsState {
            case .loaded(let events):
                GroupedCard(data: events) { e in
                    flowRow(name: e.name,
                            amount: e.amount,
                            suffix: e.recurrence == "once" ? "" : "·\(recurrenceShort(e.recurrence))",
                            detail: eventDetail(e),
                            tint: e.kind == "inflow" ? Theme.income : Theme.expense,
                            onTap: { eventToEdit = e },
                            onDelete: { eventToDelete = e })
                }
            default:
                emptyFlowCard(message: "No events yet. Add tuition, a home purchase, a windfall.")
            }
        }
    }

    // MARK: AI advisor

    @ViewBuilder private var advisorSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("AI advisor").hiveLabelStyle()
                Spacer()
                if case .loaded = model.advisorState {
                    Button {
                        Haptics.selection(); Task { await model.runAdvisor() }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.clockwise").font(.system(size: 11, weight: .semibold))
                            Text("Re-run").font(.hiveBody(13, weight: .medium))
                        }
                        .foregroundStyle(Theme.blue)
                    }
                    .accessibilityLabel("Re-run advisor")
                }
            }
            .padding(.leading, Theme.Spacing.xs)

            switch model.advisorState {
            case .none, .some(.empty):
                advisorPrompt
            case .some(.loading):
                advisorLoading
            case .some(.failed(let error)):
                advisorError(error)
            case .some(.loaded(let resp)):
                advisorResult(resp)
            }
        }
    }

    /// Pre-run call to action.
    private var advisorPrompt: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.blue)
                        .accessibilityHidden(true)
                    Text("Stress-test this plan")
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                }
                Text("Have AI review this scenario for risks — cash runway, optimistic returns, inflation drag — and suggest assumption changes.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button {
                    Haptics.selection(); Task { await model.runAdvisor() }
                } label: {
                    Text("Analyze")
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.base)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.sm + 2)
                        .background(Theme.blue, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                }
                .accessibilityLabel("Analyze this plan with AI")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var advisorLoading: some View {
        Card {
            HStack(spacing: Theme.Spacing.md) {
                ProgressView().tint(Theme.blue)
                Text("Analyzing your projection…")
                    .font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel("Analyzing your projection")
        }
    }

    @ViewBuilder private func advisorError(_ error: APIError) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text(error == .paymentRequired ? "Pro feature" : "Couldn't analyze")
                    .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                Text(error.userMessage)
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if error.isRetryable {
                    Button {
                        Haptics.selection(); Task { await model.runAdvisor() }
                    } label: {
                        Text("Try again").font(.hiveBody(14, weight: .medium)).foregroundStyle(Theme.blue)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func advisorResult(_ resp: AdvisorResponse) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            if !resp.summary.isEmpty {
                Card {
                    Text(resp.summary)
                        .font(.hiveBody(14)).foregroundStyle(Theme.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            if !resp.risks.isEmpty {
                GroupedCard(data: resp.risks) { risk in advisorRiskRow(risk) }
            }
            ForEach(resp.suggestions) { s in advisorSuggestionCard(s) }
            Text("AI estimate · \(resp.modelUsed). Review before acting.")
                .font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                .padding(.leading, Theme.Spacing.xs)
        }
    }

    private func advisorRiskRow(_ risk: AdvisorRisk) -> some View {
        let tint = severityTint(risk.severity)
        return HStack(alignment: .top, spacing: Theme.Spacing.md) {
            Circle().fill(tint).frame(width: 8, height: 8).padding(.top, 6)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(risk.title).font(.hiveBody(14, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                Text(risk.detail).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(risk.severity) risk: \(risk.title). \(risk.detail)")
    }

    private func advisorSuggestionCard(_ s: AdvisorSuggestion) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack {
                    Text(s.label).font(.hiveBody(14, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Spacer()
                    if let from = s.current?.display, let to = s.suggested?.display {
                        HStack(spacing: 4) {
                            Text(from).font(.hiveMono(12)).foregroundStyle(Theme.inkTertiary)
                            Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.inkTertiary)
                            Text(to).font(.hiveMono(12, weight: .medium)).foregroundStyle(Theme.blue)
                        }
                    }
                }
                Text(s.rationale).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if s.suggested != nil {
                    Button {
                        Haptics.selection(); Task { await model.applySuggestion(s) }
                    } label: {
                        Text("Apply change")
                            .font(.hiveBody(13, weight: .semibold)).foregroundStyle(Theme.blue)
                            .padding(.vertical, Theme.Spacing.xs + 2).padding(.horizontal, Theme.Spacing.md)
                            .background(Theme.blueDim, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    }
                    .accessibilityLabel("Apply: set \(s.label) to \(s.suggested?.display ?? "")")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func severityTint(_ severity: String) -> Color {
        switch severity {
        case "high": return Theme.expense
        case "low": return Theme.income
        default: return Theme.blue
        }
    }

    private func sectionHeader(title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        HStack {
            Text(title).hiveLabelStyle()
            Spacer()
            Button(action: action) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.blue)
                    .frame(width: 30, height: 30)
                    .background(Theme.blueDim, in: Circle())
            }
            .accessibilityLabel("Add \(title.lowercased())")
        }
        .padding(.leading, Theme.Spacing.xs)
    }

    private func flowRow(name: String, amount: Decimal, suffix: String, detail: String,
                         tint: Color, onTap: @escaping () -> Void,
                         onDelete: @escaping () -> Void) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Button(action: { Haptics.selection(); onTap() }) {
                HStack(spacing: Theme.Spacing.md) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary).lineLimit(1)
                        Text(detail).font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary).lineLimit(1)
                    }
                    Spacer(minLength: Theme.Spacing.sm)
                    Text("\(amount.formatted(.currency(code: "USD").precision(.fractionLength(0))))\(suffix.isEmpty ? "" : " \(suffix)")")
                        .font(.hiveMono(14, weight: .medium)).foregroundStyle(tint).monospacedDigit()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Edit \(name)")
            Button(action: { Haptics.selection(); onDelete() }) {
                Image(systemName: "minus.circle.fill")
                    .font(.system(size: 18)).foregroundStyle(Theme.inkTertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(name)")
        }
    }

    private func emptyFlowCard(message: String) -> some View {
        Card {
            Text(message).font(.hiveBody(13)).foregroundStyle(Theme.inkTertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func dateRange(_ start: String, _ end: String?) -> String {
        let s = ForecastFormat.monthYear(PlanningDateParser.parse(start))
        guard let end else { return "from \(s)" }
        return "\(s) – \(ForecastFormat.monthYear(PlanningDateParser.parse(end)))"
    }

    private func eventDetail(_ e: PlanEventDTO) -> String {
        let when = ForecastFormat.monthYear(PlanningDateParser.parse(e.eventDate))
        let to = e.target == "investment" ? "investments" : "cash"
        if e.recurrence == "once" { return "\(when) · \(to)" }
        return "from \(when) · \(to)"
    }

    private func recurrenceShort(_ r: String) -> String {
        switch r {
        case "monthly": "mo"; case "quarterly": "qtr"; case "semiannual": "6mo"; case "annual": "yr"; default: r
        }
    }

    private func detailGrid(_ resp: ProjectionResponse) -> some View {
        let rows: [(String, String)] = [
            ("Starting cash", resp.inputs.startingCash.formatted(.currency(code: "USD").precision(.fractionLength(0)))),
            ("Starting investments", resp.inputs.startingInvestments.formatted(.currency(code: "USD").precision(.fractionLength(0)))),
            ("Monthly expenses", resp.inputs.baseMonthlyExpenses.formatted(.currency(code: "USD").precision(.fractionLength(0)))),
            ("Total income · horizon", resp.totalIncome.formatted(.currency(code: "USD").precision(.fractionLength(0)))),
            ("Total expenses · horizon", resp.totalExpenses.formatted(.currency(code: "USD").precision(.fractionLength(0)))),
            ("Assumed return", "\(resp.assumptions.annualReturnPct.formatted(.number.precision(.fractionLength(0...1))))% / yr"),
            ("Assumed inflation", "\(resp.assumptions.annualInflationPct.formatted(.number.precision(.fractionLength(0...1))))% / yr"),
        ]
        return VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Assumptions").hiveLabelStyle()
                Spacer()
                Button {
                    Haptics.selection(); showAssumptions = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "slider.horizontal.3").font(.system(size: 11, weight: .semibold))
                        Text("Edit").font(.hiveBody(13, weight: .medium))
                    }
                    .foregroundStyle(Theme.blue)
                }
                .accessibilityLabel("Edit assumptions")
            }
            .padding(.leading, Theme.Spacing.xs)
            GroupedCard(data: rows.map { ForecastRow(label: $0.0, value: $0.1) }) { r in
                HStack {
                    Text(r.label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Text(r.value).font(.hiveMono(14, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                        .monospacedDigit()
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

private struct ForecastRow: Identifiable {
    let label: String
    let value: String
    var id: String { label }
}

// MARK: - New scenario sheet

private struct NewScenarioSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var saving = false
    let onCreate: (String) async -> Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    Text("Name this what-if scenario to compare against your baseline.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    TextField("e.g. Grad school", text: $name)
                        .textInputAutocapitalization(.words)
                        .font(.hiveBody(16))
                        .padding(Theme.Spacing.md)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                            .stroke(Theme.borderDefault, lineWidth: 1))
                    Spacer()
                }
                .padding(Theme.Spacing.lg)
            }
            .navigationTitle("New scenario")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        saving = true
                        Task {
                            let ok = await onCreate(name.trimmingCharacters(in: .whitespaces))
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Formatting helpers

private enum ForecastFormat {
    static func monthYear(_ date: Date?) -> String {
        guard let date else { return "—" }
        return date.formatted(.dateTime.month(.abbreviated).year())
    }

    /// Compact axis dollars: $1.2M / $340K / $900.
    static func compactDollars(_ v: Double) -> String {
        let a = abs(v)
        let sign = v < 0 ? "-" : ""
        if a >= 1_000_000 { return "\(sign)$\((a / 1_000_000).formatted(.number.precision(.fractionLength(0...1))))M" }
        if a >= 1_000 { return "\(sign)$\((a / 1_000).formatted(.number.precision(.fractionLength(0))))K" }
        return "\(sign)$\(a.formatted(.number.precision(.fractionLength(0))))"
    }
}
