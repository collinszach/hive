import SwiftUI

/// Editing surfaces for the Forecast screen (Epic 8, Phase 3): assumptions, income
/// streams, and life events. Blue throughout — Forecast is never a rewards surface.

// MARK: - Assumptions editor

struct AssumptionsEditorSheet: View {
    let current: AssumptionsDTO
    let onSave: (_ body: AssumptionsUpdateBody) async -> Bool

    @Environment(\.dismiss) private var dismiss

    @State private var returnPct: Double
    @State private var inflationPct: Double
    @State private var taxPct: Double
    @State private var bandSpreadPct: Double
    @State private var floor: Decimal?
    @State private var autoInvest: Bool
    @State private var overrideExpenses: Bool
    @State private var expenseAmount: Decimal?
    @State private var overrideStart: Bool
    @State private var startCash: Decimal?
    @State private var startInvestments: Decimal?
    @State private var isSaving = false

    init(current: AssumptionsDTO, onSave: @escaping (_ body: AssumptionsUpdateBody) async -> Bool) {
        self.current = current
        self.onSave = onSave
        _returnPct = State(initialValue: current.annualReturnPct)
        _inflationPct = State(initialValue: current.annualInflationPct)
        _taxPct = State(initialValue: current.effectiveTaxRatePct)
        _bandSpreadPct = State(initialValue: current.bandSpreadPct)
        _floor = State(initialValue: current.emergencyFloor)
        _autoInvest = State(initialValue: current.autoInvestSurplus)
        _overrideExpenses = State(initialValue: current.baseMonthlyExpenses != nil)
        _expenseAmount = State(initialValue: current.baseMonthlyExpenses)
        _overrideStart = State(initialValue: current.startingCashOverride != nil
                               || current.startingInvestmentsOverride != nil)
        _startCash = State(initialValue: current.startingCashOverride)
        _startInvestments = State(initialValue: current.startingInvestmentsOverride)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        ratesSection
                        startingSection
                        expensesSection
                        cashSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Assumptions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(isSaving ? Theme.inkGhost : Theme.blue)
                        .disabled(isSaving)
                }
            }
        }
    }

    private var ratesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Rates").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    PercentRow(label: "Investment return", value: $returnPct)
                    Divider().overlay(Theme.borderDefault)
                    PercentRow(label: "Inflation", value: $inflationPct)
                    Divider().overlay(Theme.borderDefault)
                    PercentRow(label: "Effective tax rate", value: $taxPct)
                    Divider().overlay(Theme.borderDefault)
                    PercentRow(label: "Confidence band ±", value: $bandSpreadPct)
                }
            }
            Text("All rates are annual. The band widens the shaded range around the projected line.")
                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                .padding(.leading, Theme.Spacing.xs)
        }
    }

    private var startingSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Starting position").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    Toggle(isOn: $overrideStart.animation()) {
                        Text("Assume a starting balance").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    }
                    .tint(Theme.blue)
                    .frame(minHeight: Theme.minTouchTarget)
                    if overrideStart {
                        Divider().overlay(Theme.borderDefault)
                        CurrencyRow(label: "Cash at start", value: $startCash)
                        Divider().overlay(Theme.borderDefault)
                        CurrencyRow(label: "Investments at start", value: $startInvestments)
                    }
                }
            }
            Text(overrideStart
                 ? "Projecting from these assumed balances instead of your live accounts — e.g. the cash you expect to have when the program begins."
                 : "Using your live account balances as the t=0 starting point.")
                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                .padding(.leading, Theme.Spacing.xs)
        }
    }

    private var expensesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Monthly expenses").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    Toggle(isOn: $overrideExpenses.animation()) {
                        Text("Override auto-estimate").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    }
                    .tint(Theme.blue)
                    .frame(minHeight: Theme.minTouchTarget)
                    if overrideExpenses {
                        Divider().overlay(Theme.borderDefault)
                        CurrencyRow(label: "Amount / month", value: $expenseAmount)
                    }
                }
            }
            Text(overrideExpenses
                 ? "Using your fixed monthly figure instead of the 90-day spend average."
                 : "Auto-derived from your last 90 days of non-transfer spending.")
                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                .padding(.leading, Theme.Spacing.xs)
        }
    }

    private var cashSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Cash strategy").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    CurrencyRow(label: "Emergency cash floor", value: $floor)
                    Divider().overlay(Theme.borderDefault)
                    Toggle(isOn: $autoInvest) {
                        Text("Invest surplus above floor").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    }
                    .tint(Theme.blue)
                    .frame(minHeight: Theme.minTouchTarget)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let body = AssumptionsUpdateBody(
            annualReturnPct: returnPct,
            annualInflationPct: inflationPct,
            effectiveTaxRatePct: taxPct,
            emergencyFloor: floor ?? 0,
            autoInvestSurplus: autoInvest,
            bandSpreadPct: bandSpreadPct,
            baseMonthlyExpenses: overrideExpenses ? (expenseAmount ?? 0) : nil,
            startingCashOverride: overrideStart ? (startCash ?? 0) : nil,
            startingInvestmentsOverride: overrideStart ? (startInvestments ?? 0) : nil
        )
        if await onSave(body) { dismiss() }
    }
}

// MARK: - Income form

struct IncomeFormSheet: View {
    /// When non-nil, the form edits this stream in place instead of creating a new one.
    var existing: IncomeStreamDTO? = nil
    let onSave: (_ body: IncomeStreamCreateBody) async -> Bool
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var amount: Decimal?
    @State private var startDate: Date
    @State private var hasEnd: Bool
    @State private var endDate: Date
    @State private var growthPct: Double
    @State private var taxable: Bool
    @State private var isSaving = false

    init(existing: IncomeStreamDTO? = nil,
         onSave: @escaping (_ body: IncomeStreamCreateBody) async -> Bool) {
        self.existing = existing
        self.onSave = onSave
        _name = State(initialValue: existing?.name ?? "")
        _amount = State(initialValue: existing?.monthlyAmount)
        _startDate = State(initialValue: existing.map { PlanningDateParser.parse($0.startDate) } ?? Date())
        _hasEnd = State(initialValue: existing?.endDate != nil)
        _endDate = State(initialValue: existing?.endDate.map { PlanningDateParser.parse($0) } ?? Date())
        _growthPct = State(initialValue: existing?.growthPct ?? 0)
        _taxable = State(initialValue: existing?.taxable ?? true)
    }

    // A $0 amount is allowed on purpose — it records an unpaid / no-income period (e.g. an
    // unpaid internship or a no-income stretch of a program). Only the name is required.
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) >= 0 && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        Card {
                            VStack(spacing: 0) {
                                TextFieldRow(label: "Name", placeholder: "e.g. Salary", text: $name)
                                Divider().overlay(Theme.borderDefault)
                                CurrencyRow(label: "Amount / month", value: $amount)
                            }
                        }
                        timingSection
                        Card {
                            VStack(spacing: 0) {
                                PercentRow(label: "Annual raise", value: $growthPct)
                                Divider().overlay(Theme.borderDefault)
                                Toggle(isOn: $taxable) {
                                    Text("Taxable").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                                }
                                .tint(Theme.blue)
                                .frame(minHeight: Theme.minTouchTarget)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle(existing == nil ? "Add income" : "Edit income")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(canSave ? Theme.blue : Theme.inkGhost)
                        .disabled(!canSave)
                }
            }
        }
    }

    private var timingSection: some View {
        Card {
            VStack(spacing: 0) {
                DatePicker("Starts", selection: $startDate, displayedComponents: .date)
                    .font(.hiveBody(15)).tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                Divider().overlay(Theme.borderDefault)
                Toggle(isOn: $hasEnd.animation()) {
                    Text("Has end date").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                }
                .tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                if hasEnd {
                    Divider().overlay(Theme.borderDefault)
                    DatePicker("Ends", selection: $endDate, in: startDate..., displayedComponents: .date)
                        .font(.hiveBody(15)).tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let body = IncomeStreamCreateBody(
            name: name.trimmingCharacters(in: .whitespaces),
            kind: nil,
            monthlyAmount: amount ?? 0,
            startDate: PlanningDateParser.format(startDate),
            endDate: hasEnd ? PlanningDateParser.format(endDate) : nil,
            growthPct: growthPct,
            taxable: taxable
        )
        if await onSave(body) { dismiss() }
    }
}

// MARK: - Life-event form

struct EventFormSheet: View {
    /// When non-nil, the form edits this event in place instead of creating a new one.
    var existing: PlanEventDTO? = nil
    let onSave: (_ body: EventCreateBody) async -> Bool
    @Environment(\.dismiss) private var dismiss

    enum Direction: String, CaseIterable { case outflow = "Expense", inflow = "Income" }
    enum Target: String, CaseIterable { case cash = "Cash", investment = "Investments" }
    enum Recurrence: String, CaseIterable, Identifiable {
        case once = "One-time", monthly = "Monthly", quarterly = "Quarterly",
             semiannual = "Twice a year", annual = "Annual"
        var id: String { rawValue }
        var apiValue: String {
            switch self {
            case .once: "once"; case .monthly: "monthly"; case .quarterly: "quarterly"
            case .semiannual: "semiannual"; case .annual: "annual"
            }
        }
        init(apiValue: String) {
            switch apiValue {
            case "monthly": self = .monthly; case "quarterly": self = .quarterly
            case "semiannual": self = .semiannual; case "annual": self = .annual
            default: self = .once
            }
        }
    }

    @State private var name: String
    @State private var amount: Decimal?
    @State private var direction: Direction
    @State private var target: Target
    @State private var recurrence: Recurrence
    @State private var eventDate: Date
    @State private var hasEnd: Bool
    @State private var endDate: Date
    @State private var growthPct: Double
    @State private var isSaving = false

    init(existing: PlanEventDTO? = nil,
         onSave: @escaping (_ body: EventCreateBody) async -> Bool) {
        self.existing = existing
        self.onSave = onSave
        _name = State(initialValue: existing?.name ?? "")
        _amount = State(initialValue: existing?.amount)
        _direction = State(initialValue: existing?.kind == "inflow" ? .inflow : .outflow)
        _target = State(initialValue: existing?.target == "investment" ? .investment : .cash)
        _recurrence = State(initialValue: Recurrence(apiValue: existing?.recurrence ?? "once"))
        _eventDate = State(initialValue: existing.map { PlanningDateParser.parse($0.eventDate) } ?? Date())
        _hasEnd = State(initialValue: existing?.endDate != nil)
        _endDate = State(initialValue: existing?.endDate.map { PlanningDateParser.parse($0) } ?? Date())
        _growthPct = State(initialValue: existing?.growthPct ?? 0)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0 && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        Picker("Direction", selection: $direction) {
                            ForEach(Direction.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)

                        Card {
                            VStack(spacing: 0) {
                                TextFieldRow(label: "Name", placeholder: "e.g. Tuition", text: $name)
                                Divider().overlay(Theme.borderDefault)
                                CurrencyRow(label: "Amount", value: $amount)
                                Divider().overlay(Theme.borderDefault)
                                MenuRow(label: "Applies to", value: target.rawValue) {
                                    ForEach(Target.allCases, id: \.self) { t in
                                        Button(t.rawValue) { target = t }
                                    }
                                }
                            }
                        }
                        timingSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle(existing == nil ? "Add event" : "Edit event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(canSave ? Theme.blue : Theme.inkGhost)
                        .disabled(!canSave)
                }
            }
        }
    }

    private var timingSection: some View {
        Card {
            VStack(spacing: 0) {
                MenuRow(label: "Repeats", value: recurrence.rawValue) {
                    ForEach(Recurrence.allCases) { r in Button(r.rawValue) { recurrence = r } }
                }
                Divider().overlay(Theme.borderDefault)
                DatePicker(recurrence == .once ? "Date" : "Starts",
                           selection: $eventDate, displayedComponents: .date)
                    .font(.hiveBody(15)).tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                if recurrence != .once {
                    Divider().overlay(Theme.borderDefault)
                    Toggle(isOn: $hasEnd.animation()) {
                        Text("Has end date").font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    }
                    .tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                    if hasEnd {
                        Divider().overlay(Theme.borderDefault)
                        DatePicker("Ends", selection: $endDate, in: eventDate..., displayedComponents: .date)
                            .font(.hiveBody(15)).tint(Theme.blue).frame(minHeight: Theme.minTouchTarget)
                    }
                    Divider().overlay(Theme.borderDefault)
                    PercentRow(label: "Annual growth", value: $growthPct)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let recurring = recurrence != .once
        let body = EventCreateBody(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount ?? 0,
            eventDate: PlanningDateParser.format(eventDate),
            kind: direction == .inflow ? "inflow" : "outflow",
            target: target == .investment ? "investment" : "cash",
            recurrence: recurrence.apiValue,
            endDate: (recurring && hasEnd) ? PlanningDateParser.format(endDate) : nil,
            growthPct: recurring ? growthPct : 0,
            category: nil,
            notes: nil
        )
        if await onSave(body) { dismiss() }
    }
}

// MARK: - Shared field rows

private struct PercentRow: View {
    let label: String
    @Binding var value: Double
    var body: some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            TextField("0", value: $value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.hiveMono(16, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                .frame(maxWidth: 90)
            Text("%").font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }
}

private struct CurrencyRow: View {
    let label: String
    @Binding var value: Decimal?
    var body: some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text("$").font(.hiveMono(15, weight: .medium)).foregroundStyle(Theme.inkSecondary)
            TextField("0", value: $value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.hiveMono(16, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                .frame(maxWidth: 140)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }
}

private struct TextFieldRow: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var body: some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            TextField(placeholder, text: $text)
                .multilineTextAlignment(.trailing)
                .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                .frame(maxWidth: 200)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }
}

private struct MenuRow<Content: View>: View {
    let label: String
    let value: String
    @ViewBuilder var menu: Content
    var body: some View {
        Menu {
            menu
        } label: {
            HStack {
                Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
                Spacer()
                Text(value).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.blue).lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
            }
            .frame(minHeight: Theme.minTouchTarget)
            .contentShape(Rectangle())
        }
    }
}

