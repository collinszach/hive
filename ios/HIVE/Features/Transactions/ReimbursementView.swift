import SwiftUI
import Observation

/// "Who owes you" — the aggregate reimbursement overview. Pending shares grouped by
/// contact, with each person's outstanding total, and inline settle / delete. Opened
/// from the Money toolbar. Settling marks a share reimbursed; deleting removes it.
struct ReimbursementView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = ReimbursementViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        LoadStateView(
                            state: model.state,
                            emptyTitle: "All settled up",
                            emptyMessage: "When you charge someone for part of a transaction, what they owe you shows up here.",
                            emptyIcon: "checkmark.circle",
                            onRetry: { Task { await model.load() } }
                        ) { groups in
                            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                                totalHero(model.outstandingTotal).hiveEntrance(0)
                                ForEach(Array(groups.enumerated()), id: \.element.id) { i, g in
                                    contactGroup(g).hiveEntrance(min(i + 1, 6))
                                }
                            }
                        } skeleton: {
                            VStack(spacing: Theme.Spacing.md) {
                                SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
                                SkeletonList(count: 4)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Owed to you")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
            .task { await model.load() }
            .alert("Couldn't update", isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(model.errorMessage ?? "")
            }
        }
    }

    private func totalHero(_ total: Decimal) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Outstanding").hiveLabelStyle()
            MoneyHero(amount: total, size: 40)
            Text("Across \(model.contactCount) \(model.contactCount == 1 ? "person" : "people")")
                .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
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

    private func contactGroup(_ group: ReimbursementViewModel.ContactGroup) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text(group.contactName).hiveLabelStyle()
                Spacer()
                MoneyText(amount: group.total, size: 14, weight: .semibold)
            }
            .padding(.horizontal, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    ForEach(Array(group.shares.enumerated()), id: \.element.id) { i, share in
                        if i > 0 {
                            Rectangle().fill(Theme.borderSubtle).frame(height: 1)
                                .padding(.vertical, Theme.Spacing.sm)
                        }
                        shareRow(share)
                    }
                }
            }
        }
    }

    private func shareRow(_ share: ExpenseShareDTO) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(share.transactionMerchant ?? share.note ?? "Charge")
                    .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1)
                if let date = share.transactionDate {
                    Text(DateOnly.shortLabel(date))
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }
            }
            Spacer(minLength: Theme.Spacing.sm)
            MoneyText(amount: share.amount, size: 15, weight: .semibold)

            Menu {
                Button {
                    Task { await model.settle(share) }
                } label: {
                    Label("Mark settled", systemImage: "checkmark.circle")
                }
                Button(role: .destructive) {
                    Task { await model.delete(share) }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .disabled(model.busyShareId == share.id)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }
}

// MARK: - View model

@MainActor
@Observable
final class ReimbursementViewModel {
    struct ContactGroup: Identifiable {
        let contactId: String
        let contactName: String
        let shares: [ExpenseShareDTO]
        var id: String { contactId }
        var total: Decimal { shares.reduce(0) { $0 + $1.amount } }
    }

    private(set) var state: LoadState<[ContactGroup]> = .loading
    var errorMessage: String?
    var busyShareId: String?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            let pending = try await api.send(.get("/api/shares/pending"), as: [ExpenseShareDTO].self)
            let groups = Self.group(pending)
            state = groups.isEmpty ? .empty : .loaded(groups)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }

    func settle(_ share: ExpenseShareDTO) async {
        busyShareId = share.id
        defer { busyShareId = nil }
        do {
            try await api.send(
                Endpoint(method: .patch, path: "/api/shares/\(share.id)/settle"),
                body: ShareSettle()
            )
            Haptics.success()
            await load()
        } catch {
            Haptics.error()
            errorMessage = (error as? APIError)?.userMessage
                ?? "Couldn't mark that settled. Try again."
        }
    }

    func delete(_ share: ExpenseShareDTO) async {
        busyShareId = share.id
        defer { busyShareId = nil }
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/shares/\(share.id)"))
            Haptics.success()
            await load()
        } catch {
            Haptics.error()
            errorMessage = (error as? APIError)?.userMessage
                ?? "Couldn't delete that. Try again."
        }
    }

    var outstandingTotal: Decimal {
        (state.value ?? []).reduce(0) { $0 + $1.total }
    }
    var contactCount: Int { (state.value ?? []).count }

    private static func group(_ shares: [ExpenseShareDTO]) -> [ContactGroup] {
        Dictionary(grouping: shares, by: \.contactId)
            .map { id, list in
                ContactGroup(
                    contactId: id,
                    contactName: list.first?.contactName ?? "Someone",
                    shares: list.sorted { ($0.transactionDate ?? "") > ($1.transactionDate ?? "") }
                )
            }
            .sorted { $0.total > $1.total }
    }
}
