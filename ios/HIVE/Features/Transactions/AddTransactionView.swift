import SwiftUI

/// Manual transaction entry (cash, reimbursement, anything Plaid won't sync). Posts
/// to `POST /api/transactions`. The amount is entered as a positive number; an
/// Expense/Income segmented control sets the backend sign (spend = positive,
/// income = negative). Category/subcategory come from `Taxonomy`; both optional.
struct AddTransactionView: View {
    /// Returns true on success so the sheet can dismiss and the ledger reloads.
    let onSave: (_ body: ManualTransactionRequest) async -> Bool

    @Environment(\.dismiss) private var dismiss

    private enum Kind: String, CaseIterable { case expense = "Expense", income = "Income" }

    @State private var kind: Kind = .expense
    @State private var amount: Decimal?
    @State private var merchant = ""
    @State private var date = Date()
    @State private var category: String?
    @State private var subcategory: String?
    @State private var notes = ""
    @State private var isSaving = false

    private var canSave: Bool {
        (amount ?? 0) > 0 && !merchant.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        kindAndAmount
                        detailsSection
                        categorySection
                        notesSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Add transaction")
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

    // MARK: Kind + amount

    private var kindAndAmount: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Picker("Type", selection: $kind) {
                ForEach(Kind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            Card {
                HStack {
                    Text("$").font(.hiveMono(20, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                    TextField("0.00", value: $amount, format: .number.precision(.fractionLength(2)))
                        .keyboardType(.decimalPad)
                        .font(.hiveMono(22, weight: .medium))
                        .foregroundStyle(kind == .income ? Theme.income : Theme.inkPrimary)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
    }

    // MARK: Details

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Details").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    HStack {
                        Text("Merchant").font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
                        Spacer()
                        TextField("Where?", text: $merchant)
                            .multilineTextAlignment(.trailing)
                            .font(.hiveBody(15, weight: .medium))
                            .foregroundStyle(Theme.inkPrimary)
                            .frame(maxWidth: 200)
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                    Divider().overlay(Theme.borderDefault)
                    DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                        .font(.hiveBody(15))
                        .tint(Theme.blue)
                        .frame(minHeight: Theme.minTouchTarget)
                }
            }
        }
    }

    // MARK: Category

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Category").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    Menu {
                        Button("None") { category = nil; subcategory = nil }
                        ForEach(Taxonomy.categories, id: \.self) { cat in
                            Button(cat) { category = cat; subcategory = nil }
                        }
                    } label: {
                        pickerRow(label: "Category", value: category ?? "None")
                    }
                    if let cat = category {
                        let subs = Taxonomy.subcategories(for: cat)
                        if !subs.isEmpty {
                            Divider().overlay(Theme.borderDefault)
                            Menu {
                                Button("None") { subcategory = nil }
                                ForEach(subs, id: \.self) { sub in
                                    Button(sub) { subcategory = sub }
                                }
                            } label: {
                                pickerRow(label: "Subcategory", value: subcategory ?? "None")
                            }
                        }
                    }
                }
            }
        }
    }

    private func pickerRow(label: String, value: String) -> some View {
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

    // MARK: Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Note (optional)").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                TextField("Add a note", text: $notes, axis: .vertical)
                    .font(.hiveBody(15))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1...4)
                    .frame(minHeight: Theme.minTouchTarget, alignment: .top)
            }
        }
    }

    // MARK: Save

    private func save() async {
        guard let amt = amount, amt > 0 else { return }
        isSaving = true
        defer { isSaving = false }

        // Backend sign convention: spend positive, income negative.
        let signed = kind == .income ? rounded(-amt) : rounded(amt)
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = ManualTransactionRequest(
            date: DateOnly.string(from: date),
            amount: signed,
            merchant: merchant.trimmingCharacters(in: .whitespaces),
            category: category,
            subcategory: subcategory,
            notes: trimmedNotes.isEmpty ? nil : trimmedNotes
        )
        if await onSave(body) {
            Haptics.success()
            dismiss()
        } else {
            Haptics.error()
        }
    }

    private func rounded(_ d: Decimal) -> Decimal {
        var input = d, result = Decimal()
        NSDecimalRound(&result, &input, 2, .plain)
        return result
    }
}
