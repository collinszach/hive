import SwiftUI
import Charts

/// Forecast — the spreadsheet-replacement surface. Picks a scenario + horizon and
/// renders the projection: net-worth trajectory with a confidence band, the
/// cash-runway trough, and the assumptions/flows that produced it.
///
/// Read-only for now (scenario + horizon selection); editing assumptions, income,
/// and life events lands in a follow-up. Blue throughout — this is not a rewards
/// surface, so honey never appears here.
struct ForecastView: View {
    @State private var model = ForecastViewModel()
    @State private var showNewScenario = false

    var body: some View {
        Screen(title: "Forecast", refresh: { await model.loadProjection() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                controls.hiveEntrance(0)
                projection
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .task { await model.load() }
        .sheet(isPresented: $showNewScenario) {
            NewScenarioSheet { name in await model.createScenario(name: name) }
                .presentationDetents([.height(220)])
                .presentationDragIndicator(.visible)
        }
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
        }
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
                detailGrid(resp).hiveEntrance(4)
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
        return Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                Text("Net worth trajectory").font(.hiveBody(13, weight: .medium))
                    .foregroundStyle(Theme.inkSecondary)
                Chart(points, id: \.0) { point in
                    AreaMark(
                        x: .value("Month", point.0),
                        yStart: .value("Low", point.2),
                        yEnd: .value("High", point.3)
                    )
                    .foregroundStyle(Theme.blue.opacity(0.12))
                    .interpolationMethod(.monotone)

                    LineMark(x: .value("Month", point.0), y: .value("Net worth", point.1))
                        .foregroundStyle(Theme.blue)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.monotone)
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
            Text("Assumptions").hiveLabelStyle()
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
