import SwiftUI

/// Transaction detail. The amount is the hero; below it the user can re-categorize,
/// add a note, and split the charge across categories. All mutations hit the backend
/// directly and call `onChange` so the ledger behind the sheet re-queries.
struct TransactionDetailView: View {
    let transaction: TransactionDTO
    /// Called after any server mutation so the list refreshes.
    let onChange: () async -> Void

    @Environment(\.dismiss) private var dismiss
    private let api = APIClient.shared

    @State private var category: String
    @State private var subcategory: String
    @State private var notes: String
    @State private var splits: [SplitDTO] = []
    @State private var shares: [ExpenseShareDTO] = []
    @State private var isSaving = false
    @State private var savingNotes = false
    @State private var showSplitEditor = false
    @State private var showAddShare = false
    @State private var busyShareId: String?
    /// Non-nil shows an error alert. We surface the real failure instead of only a
    /// haptic so a failed save is visible (and reportable), not silent.
    @State private var errorMessage: String?

    init(transaction: TransactionDTO, onChange: @escaping () async -> Void) {
        self.transaction = transaction
        self.onChange = onChange
        _category = State(initialValue: transaction.category ?? "Uncategorized")
        _subcategory = State(initialValue: transaction.subcategory ?? "")
        _notes = State(initialValue: transaction.notes ?? "")
    }

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    header
                    detailsCard
                    if splits.isEmpty { categorizeCard }
                    splitCard
                    if !transaction.isCredit { shareCard }
                    notesCard
                    if isDirty && splits.isEmpty { saveButton }
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.xl)
                .padding(.bottom, Theme.Spacing.xxl)
            }
        }
        .task { await loadSplits() }
        .task { await loadShares() }
        .sheet(isPresented: $showSplitEditor) {
            SplitEditorView(transaction: transaction, existing: splits) { newSplits in
                await saveSplits(newSplits)
            } onClear: {
                await clearSplits()
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showAddShare) {
            ShareEditorView(transaction: transaction, alreadyShared: sharedTotal) { create in
                await createShare(create)
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .alert("Couldn't save", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(transaction.displayName)
                .font(.hiveBody(20, weight: .semibold))
                .foregroundStyle(Theme.inkPrimary)
            MoneyText(amount: transaction.isCredit ? -transaction.amount : transaction.amount,
                      size: 34, weight: .semibold, signed: transaction.isCredit)
            Text(DateOnly.relativeLabel(transaction.date))
                .font(.hiveBody(13))
                .foregroundStyle(Theme.inkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var detailsCard: some View {
        Card {
            VStack(spacing: 0) {
                detailRow("Account", transaction.accountName ?? "—")
                if let slug = transaction.cardSlug {
                    divider; detailRow("Card", CardCatalog.name(slug))
                }
                if let channel = transaction.paymentChannel {
                    divider; detailRow("Channel", channel.capitalized)
                }
                if let city = transaction.locationCity {
                    divider
                    detailRow("Location", [city, transaction.locationState].compactMap { $0 }.joined(separator: ", "))
                }
                divider; detailRow("Source", transaction.categorySource.capitalized)
                if transaction.rawDescription != transaction.displayName {
                    divider; detailRow("Statement", transaction.rawDescription)
                }
            }
        }
    }

    private var categorizeCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Category").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    Menu {
                        ForEach(Taxonomy.categories, id: \.self) { cat in
                            Button(cat) {
                                category = cat
                                subcategory = Taxonomy.subcategories(for: cat).first ?? ""
                            }
                        }
                    } label: { pickerRow("Category", category) }

                    let subs = Taxonomy.subcategories(for: category)
                    if !subs.isEmpty {
                        divider
                        Menu {
                            ForEach(subs, id: \.self) { sub in
                                Button(sub) { subcategory = sub }
                            }
                        } label: { pickerRow("Subcategory", subcategory.isEmpty ? "Choose…" : subcategory) }
                    }
                }
            }
        }
    }

    // MARK: Splits

    private var splitCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Split by category").hiveLabelStyle()
                Spacer()
                Button(splits.isEmpty ? "Split transaction" : "Edit split") {
                    Haptics.selection(); showSplitEditor = true
                }
                .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)

            if splits.isEmpty {
                Card {
                    Text("Split this charge across multiple categories (e.g. a Costco run that's part Groceries, part Home).")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(splits.enumerated()), id: \.element.id) { i, s in
                            if i > 0 { divider }
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.category ?? "Uncategorized")
                                        .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                                    if let sub = s.subcategory, !sub.isEmpty {
                                        Text(sub).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                                    }
                                }
                                Spacer()
                                MoneyText(amount: s.amount, size: 15, weight: .medium)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: Reimbursement (charge someone)

    /// Sum already assigned to people, so "what's left" is accurate.
    private var sharedTotal: Decimal { shares.reduce(0) { $0 + $1.amount } }

    private var shareCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Charge someone").hiveLabelStyle()
                Spacer()
                Button("Charge someone") {
                    Haptics.selection(); showAddShare = true
                }
                .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)

            if shares.isEmpty {
                Card {
                    Text("Assign part of this charge to someone who owes you, and track it until they pay you back.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(shares.enumerated()), id: \.element.id) { i, s in
                            if i > 0 { divider }
                            shareRow(s)
                        }
                    }
                }
            }
        }
    }

    private func shareRow(_ s: ExpenseShareDTO) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            VStack(alignment: .leading, spacing: 3) {
                Text(s.contactName)
                    .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                HStack(spacing: Theme.Spacing.xs) {
                    statusPill(s)
                    if let note = s.note, !note.isEmpty {
                        Text(note).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: Theme.Spacing.sm)
            MoneyText(amount: s.amount, size: 15, weight: .medium)
            shareMenu(s)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private func statusPill(_ s: ExpenseShareDTO) -> some View {
        Text(s.isSettled ? "Settled" : "Pending")
            .font(.hiveBody(11, weight: .semibold))
            .foregroundStyle(s.isSettled ? Theme.income : Theme.warning)
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, 2)
            .background(
                Capsule().fill((s.isSettled ? Theme.income : Theme.warning).opacity(0.14))
            )
    }

    @ViewBuilder
    private func shareMenu(_ s: ExpenseShareDTO) -> some View {
        if busyShareId == s.id {
            ProgressView().controlSize(.mini)
        } else {
            Menu {
                if s.isSettled {
                    Button("Mark as pending") { Task { await unsettleShare(s) } }
                } else {
                    Button("Mark as paid back") { Task { await settleShare(s) } }
                }
                Button("Delete", role: .destructive) { Task { await deleteShare(s) } }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.inkTertiary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
        }
    }

    // MARK: Notes

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Note").hiveLabelStyle()
                Spacer()
                if savingNotes { ProgressView().controlSize(.mini) }
            }
            .padding(.horizontal, Theme.Spacing.xs)
            Card {
                TextField("Add a note", text: $notes, axis: .vertical)
                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1...4)
                    .onSubmit { Task { await saveNotes() } }
                Group {
                    if notes.trimmingCharacters(in: .whitespaces) != (transaction.notes ?? "") {
                        Button("Save note") { Task { await saveNotes() } }
                            .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
                            .padding(.top, Theme.Spacing.sm)
                    }
                }
            }
        }
    }

    private var saveButton: some View {
        Button {
            Task { await saveCategory() }
        } label: {
            HStack {
                if isSaving { ProgressView().tint(.white) }
                Text(isSaving ? "Saving…" : "Save category")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(HivePrimaryButtonStyle())
        .disabled(isSaving)
    }

    // MARK: Mutations

    private func loadSplits() async {
        if let s = try? await api.send(.get("/api/transactions/\(transaction.id)/splits"), as: [SplitDTO].self) {
            splits = s
        }
    }

    private func saveCategory() async {
        isSaving = true
        defer { isSaving = false }
        do {
            // Discard the echoed body — decoding it was an extra failure mode that
            // could make a successful save look like an error.
            try await api.send(
                Endpoint(method: .put, path: "/api/transactions/\(transaction.id)/category"),
                body: CategoryUpdate(category: category, subcategory: subcategory)
            )
            Haptics.success()
            await onChange()
            dismiss()
        } catch {
            Haptics.error()
            errorMessage = (error as? APIError)?.userMessage
                ?? "The category change didn't save. Check your connection and try again."
        }
    }

    private func saveNotes() async {
        savingNotes = true
        defer { savingNotes = false }
        let trimmed = notes.trimmingCharacters(in: .whitespaces)
        do {
            try await api.send(
                Endpoint(method: .patch, path: "/api/transactions/\(transaction.id)"),
                body: TransactionPatch(notes: trimmed)
            )
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func saveSplits(_ legs: [SplitInput]) async {
        do {
            let saved = try await api.send(
                Endpoint(method: .put, path: "/api/transactions/\(transaction.id)/splits"),
                body: SetSplitsRequest(splits: legs),
                as: [SplitDTO].self
            )
            splits = saved
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func clearSplits() async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/transactions/\(transaction.id)/splits"))
            splits = []
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    // MARK: Reimbursement mutations

    private func loadShares() async {
        if let s = try? await api.send(
            .get("/api/transactions/\(transaction.id)/shares"), as: [ExpenseShareDTO].self
        ) {
            shares = s
        }
    }

    private func createShare(_ create: ShareCreate) async {
        do {
            let created = try await api.send(
                .post("/api/transactions/\(transaction.id)/shares"),
                body: create, as: ExpenseShareDTO.self
            )
            shares.append(created)
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func settleShare(_ s: ExpenseShareDTO) async {
        busyShareId = s.id
        defer { busyShareId = nil }
        do {
            let updated = try await api.send(
                Endpoint(method: .patch, path: "/api/shares/\(s.id)/settle"),
                body: ShareSettle(), as: ExpenseShareDTO.self
            )
            replaceShare(updated)
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func unsettleShare(_ s: ExpenseShareDTO) async {
        busyShareId = s.id
        defer { busyShareId = nil }
        do {
            let updated = try await api.send(
                Endpoint(method: .patch, path: "/api/shares/\(s.id)/unsettle"),
                as: ExpenseShareDTO.self
            )
            replaceShare(updated)
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func deleteShare(_ s: ExpenseShareDTO) async {
        busyShareId = s.id
        defer { busyShareId = nil }
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/shares/\(s.id)"))
            shares.removeAll { $0.id == s.id }
            Haptics.success()
            await onChange()
        } catch {
            Haptics.error()
        }
    }

    private func replaceShare(_ updated: ExpenseShareDTO) {
        if let idx = shares.firstIndex(where: { $0.id == updated.id }) {
            shares[idx] = updated
        }
    }

    private var isDirty: Bool {
        category != (transaction.category ?? "Uncategorized")
            || subcategory != (transaction.subcategory ?? "")
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderSubtle).frame(height: 1)
            .padding(.vertical, Theme.Spacing.sm)
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
            Spacer(minLength: Theme.Spacing.lg)
            Text(value).font(.hiveBody(14, weight: .medium))
                .foregroundStyle(Theme.inkPrimary)
                .multilineTextAlignment(.trailing)
        }
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
