import SwiftUI

/// "Charge someone for this" — assign part of a charge to a person and track it for
/// reimbursement. Pick an existing contact (or add one inline), enter the amount they
/// owe, optional note. On save the parent POSTs the share and refreshes.
struct ShareEditorView: View {
    let transaction: TransactionDTO
    /// Already-assigned amount on this charge, so we can suggest "what's left".
    let alreadyShared: Decimal
    let onSave: (ShareCreate) async -> Void

    @Environment(\.dismiss) private var dismiss
    private let api = APIClient.shared

    @State private var contacts: [ContactDTO] = []
    @State private var selectedContactId: String?
    @State private var newContactName = ""
    @State private var addingContact = false
    @State private var amount: Decimal?
    @State private var note = ""
    @State private var isSaving = false

    private var charge: Decimal { abs(transaction.amount) }
    private var remaining: Decimal { max(0, charge - alreadyShared) }

    private var canSave: Bool {
        selectedContactId != nil && (amount ?? 0) > 0 && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        contextHeader
                        contactSection
                        amountSection
                        noteSection
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Charge someone")
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
            .task { await loadContacts() }
        }
    }

    private var contextHeader: some View {
        Card {
            VStack(spacing: Theme.Spacing.sm) {
                detailRow("Charge", MoneyText(amount: charge, size: 15, weight: .semibold))
                if alreadyShared > 0 {
                    divider
                    detailRow("Already assigned", MoneyText(amount: alreadyShared, size: 15, weight: .medium))
                    divider
                    detailRow("Left", MoneyText(amount: remaining, size: 15, weight: .semibold))
                }
            }
        }
    }

    // MARK: Contact

    private var contactSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Who owes you").hiveLabelStyle()
                Spacer()
                Button(addingContact ? "Pick existing" : "New contact") {
                    Haptics.selection()
                    addingContact.toggle()
                }
                .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)

            if addingContact || contacts.isEmpty {
                Card {
                    HStack {
                        TextField("Name", text: $newContactName)
                            .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                            .textInputAutocapitalization(.words)
                            .onSubmit { Task { await createContact() } }
                        Button("Add") { Task { await createContact() } }
                            .font(.hiveBody(14, weight: .semibold))
                            .foregroundStyle(newContactName.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.inkGhost : Theme.blue)
                            .disabled(newContactName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                }
            } else {
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(contacts.enumerated()), id: \.element.id) { i, c in
                            if i > 0 { divider }
                            Button {
                                Haptics.selection()
                                selectedContactId = (selectedContactId == c.id) ? nil : c.id
                            } label: {
                                HStack {
                                    Text(c.name).font(.hiveBody(15, weight: .medium))
                                        .foregroundStyle(Theme.inkPrimary)
                                    Spacer()
                                    if selectedContactId == c.id {
                                        Image(systemName: "checkmark").font(.system(size: 13, weight: .bold))
                                            .foregroundStyle(Theme.blue)
                                    }
                                }
                                .frame(minHeight: Theme.minTouchTarget)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: Amount

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Amount they owe").hiveLabelStyle()
                Spacer()
                Button("Half") { Haptics.selection(); amount = rounded(charge / 2) }
                    .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
                Button("Full") { Haptics.selection(); amount = remaining > 0 ? remaining : charge }
                    .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)
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

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Note").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                TextField("e.g. dinner share", text: $note, axis: .vertical)
                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1...3)
            }
        }
    }

    // MARK: Actions

    private func loadContacts() async {
        if let list = try? await api.send(.get("/api/contacts"), as: [ContactDTO].self) {
            contacts = list
            addingContact = list.isEmpty
        }
    }

    private func createContact() async {
        let name = newContactName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            let created = try await api.send(
                .post("/api/contacts"), body: ContactCreate(name: name), as: ContactDTO.self
            )
            contacts.append(created)
            contacts.sort { $0.name < $1.name }
            selectedContactId = created.id
            newContactName = ""
            addingContact = false
            Haptics.success()
        } catch {
            Haptics.error()
        }
    }

    private func save() async {
        guard let cid = selectedContactId, let amt = amount, amt > 0 else { return }
        isSaving = true
        defer { isSaving = false }
        await onSave(ShareCreate(
            contactId: cid,
            amount: rounded(amt),
            note: note.trimmingCharacters(in: .whitespaces).isEmpty ? nil : note.trimmingCharacters(in: .whitespaces)
        ))
        dismiss()
    }

    private func rounded(_ d: Decimal) -> Decimal {
        var input = d
        var result = Decimal()
        NSDecimalRound(&result, &input, 2, .plain)
        return result
    }

    private func detailRow<V: View>(_ label: String, _ value: V) -> some View {
        HStack {
            Text(label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            value
        }
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderSubtle).frame(height: 1)
            .padding(.vertical, Theme.Spacing.sm)
    }
}
