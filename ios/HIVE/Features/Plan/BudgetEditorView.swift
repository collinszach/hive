import SwiftUI

/// What the budget editor sheet is doing — drives `.sheet(item:)` on Plan.
enum BudgetEditorTarget: Identifiable {
    case new
    case edit(BudgetDTO)

    var id: String {
        switch self {
        case .new: return "new"
        case .edit(let b): return b.id
        }
    }
}

/// Create or edit one category's monthly budget. New budgets pick from categories that
/// don't yet have one; editing fixes the category and lets you change the amount, toggle
/// rollover, or delete. All mutations run through `PlanViewModel` and reload the list.
struct BudgetEditorView: View {
    let target: BudgetEditorTarget
    let monthLabel: String
    let pickableCategories: [String]
    let onSave: (_ category: String, _ amount: Decimal, _ rollover: Bool) async -> Bool
    let onDelete: (_ id: String) async -> Bool

    @Environment(\.dismiss) private var dismiss

    @State private var category: String
    @State private var amount: Decimal?
    @State private var rollover: Bool
    @State private var isSaving = false
    @State private var confirmingDelete = false

    init(
        target: BudgetEditorTarget,
        monthLabel: String,
        pickableCategories: [String],
        onSave: @escaping (_ category: String, _ amount: Decimal, _ rollover: Bool) async -> Bool,
        onDelete: @escaping (_ id: String) async -> Bool
    ) {
        self.target = target
        self.monthLabel = monthLabel
        self.pickableCategories = pickableCategories
        self.onSave = onSave
        self.onDelete = onDelete
        switch target {
        case .new:
            _category = State(initialValue: pickableCategories.first ?? "Food & Drink")
            _amount = State(initialValue: nil)
            _rollover = State(initialValue: false)
        case .edit(let b):
            _category = State(initialValue: b.category)
            _amount = State(initialValue: b.budgetAmount)
            _rollover = State(initialValue: b.rollover)
        }
    }

    private var isEditing: Bool { if case .edit = target { return true }; return false }
    private var canSave: Bool { (amount ?? 0) > 0 && !category.isEmpty && !isSaving }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        categorySection
                        amountSection
                        rolloverSection
                        if isEditing { deleteButton }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle(isEditing ? "Edit budget" : "New budget")
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

    // MARK: Category

    @ViewBuilder private var categorySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Category · \(monthLabel)").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                if isEditing {
                    // Category is fixed once a budget exists — change the amount, not the row.
                    HStack {
                        Text(category).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                        Spacer()
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                } else if pickableCategories.isEmpty {
                    Text("Every category already has a budget this month.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                } else {
                    Menu {
                        ForEach(pickableCategories, id: \.self) { cat in
                            Button(cat) { category = cat }
                        }
                    } label: {
                        HStack {
                            Text(category).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.blue)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
                        }
                        .frame(minHeight: Theme.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                }
            }
        }
    }

    // MARK: Amount

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Monthly budget").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                HStack {
                    Text("$").font(.hiveMono(17, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                    TextField("0.00", value: $amount, format: .number.precision(.fractionLength(2)))
                        .keyboardType(.decimalPad)
                        .font(.hiveMono(17, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
    }

    private var rolloverSection: some View {
        Card {
            Toggle(isOn: $rollover) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Roll over underspend").font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                    Text("Add leftover from last month to this month's budget.")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }
            }
            .tint(Theme.blue)
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            confirmingDelete = true
        } label: {
            Text("Delete budget")
                .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.expense)
                .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
        }
        .buttonStyle(.plain)
        .confirmationDialog("Delete this budget?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: Actions

    private func save() async {
        guard let amt = amount, amt > 0 else { return }
        isSaving = true
        defer { isSaving = false }
        if await onSave(category, rounded(amt), rollover) { dismiss() }
    }

    private func delete() async {
        guard case .edit(let b) = target else { return }
        isSaving = true
        defer { isSaving = false }
        if await onDelete(b.id) { dismiss() }
    }

    private func rounded(_ d: Decimal) -> Decimal {
        var input = d, result = Decimal()
        NSDecimalRound(&result, &input, 2, .plain)
        return result
    }
}
