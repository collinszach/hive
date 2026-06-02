import SwiftUI

/// Money tab — every transaction, searchable, filterable, and re-categorizable.
/// One dominant hero (month spend), then a date-grouped ledger in a single grouped
/// surface (Tufte: hairline rules, not N cards).
struct TransactionsView: View {
    @Environment(AppState.self) private var app
    @State private var model = TransactionsViewModel()
    @State private var selected: TransactionDTO?
    @State private var showFilters = false
    @State private var showOwed = false
    @State private var showAdd = false

    var body: some View {
        Screen(title: "Money", refresh: { await model.refreshWithSync() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                // The switcher lives above the load state so an empty month never
                // strands the user — they can always step back to a month with data.
                if !searchActive {
                    MonthSwitcher(month: $model.month) { model.reloadDebounced() }
                        .hiveEntrance(0)
                }
                LoadStateView(
                    state: model.state,
                    emptyTitle: "No transactions",
                    emptyMessage: searchActive
                        ? "No matches for “\(model.searchText)”."
                        : "Nothing recorded for \(MonthHelper.longLabel(model.month)) yet.",
                    emptyIcon: "magnifyingglass",
                    onRetry: { Task { await model.load() } }
                ) { items in
                    content(items)
                } skeleton: {
                    VStack(spacing: Theme.Spacing.md) {
                        SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
                        SkeletonList(count: 6)
                    }
                }
            }
        }
        .searchable(text: $model.searchText, prompt: "Search merchants")
        .onChange(of: model.searchText) { _, _ in model.reloadDebounced() }
        .onChange(of: model.selectedCategory) { _, _ in model.reloadDebounced() }
        .task { if model.state.value == nil { await model.load() } }
        .onChange(of: isUnauthorized) { _, expired in if expired { app.handleSessionExpired() } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Haptics.selection(); showAdd = true } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.blue)
                }
                .accessibilityLabel("Add transaction")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { Haptics.selection(); showOwed = true } label: {
                    Image(systemName: "person.2")
                        .foregroundStyle(Theme.inkSecondary)
                }
                .accessibilityLabel("Owed to you")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { Haptics.selection(); showFilters = true } label: {
                    Image(systemName: model.hasActiveFilters
                        ? "line.3.horizontal.decrease.circle.fill"
                        : "line.3.horizontal.decrease.circle")
                        .foregroundStyle(model.hasActiveFilters ? Theme.blue : Theme.inkSecondary)
                }
                .accessibilityLabel(model.hasActiveFilters ? "Filters, active" : "Filters")
            }
        }
        .sheet(isPresented: $showAdd) {
            AddTransactionView { body in await model.createManual(body) }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showOwed) {
            ReimbursementView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showFilters) {
            TransactionFiltersView(model: model) { model.reloadDebounced() }
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $selected) { tx in
            TransactionDetailView(transaction: tx) { await model.load() }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    private var searchActive: Bool {
        !model.searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }
    private var isUnauthorized: Bool {
        if case .failed(.unauthorized) = model.state { return true }
        if case .failed(.notAuthenticated) = model.state { return true }
        return false
    }

    @ViewBuilder
    private func content(_ items: [TransactionDTO]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            if !searchActive { hero.hiveEntrance(1) }
            categoryFilter.hiveEntrance(2)
            ledger(items).hiveEntrance(3)
        }
    }

    // Hero — the dominant number: this month's spend.
    private var hero: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Spent · \(MonthHelper.longLabel(model.month))").hiveLabelStyle()
            MoneyHero(amount: model.monthTotal, size: 44)
            Text("\(model.total) transaction\(model.total == 1 ? "" : "s")")
                .font(.hiveBody(13))
                .foregroundStyle(Theme.inkSecondary)
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

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                FilterChip(label: "All", isSelected: model.selectedCategory == nil) {
                    model.selectedCategory = nil
                }
                ForEach(Taxonomy.categories.filter { $0 != "Uncategorized" }, id: \.self) { cat in
                    FilterChip(label: cat, isSelected: model.selectedCategory == cat) {
                        model.selectedCategory = (model.selectedCategory == cat) ? nil : cat
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func ledger(_ items: [TransactionDTO]) -> some View {
        let groups = Dictionary(grouping: items, by: \.date)
            .sorted { $0.key > $1.key }
        return VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            ForEach(groups, id: \.key) { date, txns in
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Text(DateOnly.relativeLabel(date))
                        .hiveLabelStyle()
                        .padding(.leading, Theme.Spacing.xs)
                    GroupedCard(data: txns) { tx in
                        Button { Haptics.selection(); selected = tx } label: {
                            TransactionRow(tx: tx)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

/// One ledger row: quiet category glyph, merchant + context, signed amount in mono.
struct TransactionRow: View {
    let tx: TransactionDTO

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: Taxonomy.icon(for: tx.category))
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 34, height: 34)
                .background(Theme.elevated)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(tx.displayName)
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1)
                HStack(spacing: Theme.Spacing.xs) {
                    Text(tx.category ?? "Uncategorized")
                        .font(.hiveBody(12))
                        .foregroundStyle(Theme.inkSecondary)
                    if tx.pending {
                        Text("· Pending").font(.hiveBody(12)).foregroundStyle(Theme.warning)
                    }
                }
                .lineLimit(1)
            }
            Spacer(minLength: Theme.Spacing.sm)

            // Spend is positive in this backend; show credits green with a leading +.
            MoneyText(amount: tx.isCredit ? -tx.amount : tx.amount,
                      size: 15,
                      weight: .medium,
                      signed: tx.isCredit)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Pill filter chip — blue when active (the only interactive accent).
struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: { Haptics.selection(); action() }) {
            Text(label)
                .font(.hiveBody(13, weight: .medium))
                .foregroundStyle(isSelected ? Theme.blue : Theme.inkSecondary)
                .padding(.horizontal, Theme.Spacing.md)
                .frame(minHeight: Theme.minTouchTarget)
                .background(isSelected ? Theme.blueDim : Theme.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(
                    isSelected ? Theme.blueBorder : Theme.borderDefault, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}
