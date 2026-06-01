import SwiftUI

/// Split a single charge across multiple categories. The backend requires ≥2 legs,
/// each amount > 0, summing to the transaction's amount (±0.02). We enforce that here
/// so Save is only enabled when the legs balance — the user always sees the remainder.
struct SplitEditorView: View {
    let transaction: TransactionDTO
    let existing: [SplitDTO]
    let onSave: ([SplitInput]) async -> Void
    let onClear: () async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var legs: [Leg]
    @State private var isSaving = false
    @State private var isClearing = false

    /// One editable split leg. Amount is optional so an empty field reads as "unset"
    /// rather than 0 (which would otherwise look balanced/valid prematurely).
    private struct Leg: Identifiable {
        let id = UUID()
        var category: String
        var subcategory: String
        var amount: Decimal?
    }

    init(transaction: TransactionDTO,
         existing: [SplitDTO],
         onSave: @escaping ([SplitInput]) async -> Void,
         onClear: @escaping () async -> Void) {
        self.transaction = transaction
        self.existing = existing
        self.onSave = onSave
        self.onClear = onClear

        if existing.count >= 2 {
            _legs = State(initialValue: existing.map {
                Leg(category: $0.category ?? "Uncategorized",
                    subcategory: $0.subcategory ?? "",
                    amount: $0.amount)
            })
        } else {
            // Seed two legs: the first inherits the current category and the full amount,
            // the second is empty for the user to fill — the common "carve one piece off" flow.
            let cat = transaction.category ?? "Uncategorized"
            let sub = transaction.subcategory ?? ""
            _legs = State(initialValue: [
                Leg(category: cat, subcategory: sub, amount: abs(transaction.amount)),
                Leg(category: "Uncategorized", subcategory: "", amount: nil),
            ])
        }
    }

    /// The charge total the legs must sum to (always positive for the editor's math).
    private var target: Decimal { abs(transaction.amount) }

    private var allocated: Decimal {
        legs.reduce(0) { $0 + ($1.amount ?? 0) }
    }
    private var remaining: Decimal { target - allocated }

    /// Balanced within the backend's ±0.02 tolerance, with every leg positive.
    private var isBalanced: Bool {
        guard legs.count >= 2 else { return false }
        guard legs.allSatisfy({ ($0.amount ?? 0) > 0 }) else { return false }
        return abs(remaining) <= Decimal(0.02)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        balanceHeader
                        legsList
                        addButton
                        if !existing.isEmpty { removeSplitButton }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Split")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(isBalanced ? Theme.blue : Theme.inkGhost)
                        .disabled(!isBalanced || isSaving)
                }
            }
        }
    }

    // MARK: Balance header — the running total the legs must hit.

    private var balanceHeader: some View {
        Card {
            VStack(spacing: Theme.Spacing.sm) {
                row("Charge total", MoneyText(amount: target, size: 15, weight: .semibold))
                divider
                row("Allocated", MoneyText(amount: allocated, size: 15, weight: .medium))
                divider
                HStack {
                    Text(remainderLabel)
                        .font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    MoneyText(amount: abs(remaining), size: 15, weight: .semibold,
                              signed: false, currencyCode: transaction.currency)
                        .foregroundStyle(isBalanced ? Theme.income : Theme.warning)
                }
            }
        }
    }

    private var remainderLabel: String {
        if isBalanced { return "Balanced" }
        return remaining > 0 ? "Remaining" : "Over by"
    }

    private func row<V: View>(_ label: String, _ value: V) -> some View {
        HStack {
            Text(label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            value
        }
    }

    // MARK: Legs

    private var legsList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Categories").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            VStack(spacing: Theme.Spacing.md) {
                ForEach($legs) { $leg in
                    legCard($leg)
                }
            }
        }
    }

    private func legCard(_ leg: Binding<Leg>) -> some View {
        Card {
            VStack(spacing: 0) {
                Menu {
                    ForEach(Taxonomy.categories, id: \.self) { cat in
                        Button(cat) {
                            leg.wrappedValue.category = cat
                            leg.wrappedValue.subcategory = Taxonomy.subcategories(for: cat).first ?? ""
                        }
                    }
                } label: { pickerRow("Category", leg.wrappedValue.category) }

                let subs = Taxonomy.subcategories(for: leg.wrappedValue.category)
                if !subs.isEmpty {
                    divider
                    Menu {
                        ForEach(subs, id: \.self) { sub in
                            Button(sub) { leg.wrappedValue.subcategory = sub }
                        }
                    } label: {
                        pickerRow("Subcategory",
                                  leg.wrappedValue.subcategory.isEmpty ? "Choose…" : leg.wrappedValue.subcategory)
                    }
                }

                divider
                HStack {
                    Text("Amount").font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    TextField("0.00", value: leg.amount, format: .number.precision(.fractionLength(2)))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .font(.hiveMono(15, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                        .frame(maxWidth: 120)
                    if legs.count > 2 {
                        Button {
                            Haptics.selection()
                            legs.removeAll { $0.id == leg.wrappedValue.id }
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .font(.system(size: 18))
                                .foregroundStyle(Theme.inkTertiary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
    }

    private var addButton: some View {
        Button {
            Haptics.selection()
            // Pre-fill the new leg with whatever's left to allocate, so the common
            // 3-way split lands balanced in one tap.
            let seed = remaining > 0 ? remaining : nil
            legs.append(Leg(category: "Uncategorized", subcategory: "", amount: seed))
        } label: {
            Label("Add category", systemImage: "plus")
                .font(.hiveBody(14, weight: .medium))
                .foregroundStyle(Theme.blue)
                .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
        }
        .buttonStyle(.plain)
    }

    private var removeSplitButton: some View {
        Button(role: .destructive) {
            Task { await clear() }
        } label: {
            HStack {
                if isClearing { ProgressView().controlSize(.mini) }
                Text(isClearing ? "Removing…" : "Remove split")
            }
            .font(.hiveBody(15, weight: .medium))
            .foregroundStyle(Theme.expense)
            .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
        }
        .buttonStyle(.plain)
        .disabled(isClearing)
    }

    // MARK: Actions

    private func save() async {
        guard isBalanced else { return }
        isSaving = true
        defer { isSaving = false }
        let inputs = legs.map {
            SplitInput(amount: $0.amount ?? 0,
                       category: $0.category,
                       subcategory: $0.subcategory.isEmpty ? nil : $0.subcategory,
                       notes: nil)
        }
        await onSave(inputs)
        dismiss()
    }

    private func clear() async {
        isClearing = true
        defer { isClearing = false }
        await onClear()
        dismiss()
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderSubtle).frame(height: 1)
            .padding(.vertical, Theme.Spacing.sm)
    }

    private func pickerRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text(value).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.blue)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.inkTertiary)
        }
        .frame(minHeight: Theme.minTouchTarget)
        .contentShape(Rectangle())
    }
}
