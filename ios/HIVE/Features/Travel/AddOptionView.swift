import SwiftUI

/// Add a quote to a leg — a cash price, an award, a Costco or portal quote.
///
/// Typed in by hand on purpose: Costco Travel and the issuer portals have no public API
/// and their terms forbid automated access. The comparison is the product, not where the
/// number came from — you were going to open those sites anyway.
struct AddOptionView: View {
    let legTitle: String
    let onSave: (OptionCreate) async -> Bool

    @Environment(\.dismiss) private var dismiss

    private enum Kind: String, CaseIterable { case cash = "Cash", award = "Points" }
    @State private var kind: Kind = .cash
    @State private var label = ""
    @State private var cashText = ""
    @State private var pointsText = ""
    @State private var program = ""
    @State private var feesText = ""
    @State private var isSaving = false

    /// A cash price is optional on an award, but without it there's no cents-per-point
    /// — so it's prompted for rather than silently skipped.
    private var canSave: Bool {
        guard !isSaving else { return false }
        switch kind {
        case .cash:  return Double(cashText) ?? 0 > 0
        case .award: return (Double(pointsText) ?? 0) > 0
            && !program.trimmingCharacters(in: .whitespaces).isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        Text(legTitle)
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.inkSecondary)
                            .padding(.horizontal, Theme.Spacing.xs)

                        Picker("Kind", selection: $kind) {
                            ForEach(Kind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)

                        Card {
                            VStack(spacing: Theme.Spacing.sm) {
                                field("Label", placeholder: labelPlaceholder, text: $label,
                                      capitalization: .words)
                                divider
                                if kind == .award {
                                    field("Program", placeholder: "e.g. Amex MR", text: $program,
                                          capitalization: .characters)
                                    divider
                                    field("Points", placeholder: "60000", text: $pointsText,
                                          keyboard: .numberPad, mono: true)
                                    divider
                                    field("Fees", placeholder: "89", text: $feesText,
                                          keyboard: .decimalPad, mono: true)
                                    divider
                                    field("Cash price it replaces", placeholder: "1479 (optional)",
                                          text: $cashText, keyboard: .decimalPad, mono: true)
                                } else {
                                    field("Price", placeholder: "1402", text: $cashText,
                                          keyboard: .decimalPad, mono: true)
                                }
                            }
                        }

                        if kind == .award {
                            Text("The cash price is what the same trip would cost in money. Without it there's no cents-per-point, so the option can't be judged against your baseline.")
                                .font(.hiveBody(12))
                                .foregroundStyle(Theme.inkTertiary)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, Theme.Spacing.xs)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Add option")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add") { Task { await save() } }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(canSave ? Theme.blue : Theme.inkGhost)
                        .disabled(!canSave)
                }
            }
        }
    }

    private var labelPlaceholder: String {
        kind == .award ? "e.g. Aeroplan" : "e.g. Costco Travel"
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderDefault).frame(height: 1)
    }

    private func field(
        _ title: String,
        placeholder: String,
        text: Binding<String>,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .never,
        mono: Bool = false
    ) -> some View {
        HStack {
            Text(title).font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            Spacer(minLength: Theme.Spacing.md)
            TextField(placeholder, text: text)
                .multilineTextAlignment(.trailing)
                .font(mono ? .hiveMono(15) : .hiveBody(15))
                .foregroundStyle(Theme.inkPrimary)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let isAward = kind == .award
        let body = OptionCreate(
            source: isAward ? "manual_award" : "manual_cash",
            label: label.trimmingCharacters(in: .whitespaces).nilIfEmpty,
            cashPrice: Double(cashText),
            pointsPrice: isAward ? Double(pointsText) : nil,
            program: isAward ? program.trimmingCharacters(in: .whitespaces).nilIfEmpty : nil,
            fees: isAward ? (Double(feesText) ?? 0) : 0,
            quotedOn: DateOnly.string(from: Date())
        )
        if await onSave(body) { dismiss() }
    }
}
