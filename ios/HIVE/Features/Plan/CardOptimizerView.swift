import SwiftUI

/// "Which card at checkout?" — pick a category (and optional subcategory), enter an
/// amount, and get cards ranked by how much each earns. Opened from the Plan → Points
/// toolbar. Rewards context, so honey/gold is allowed; results lead with points and
/// earn rate, never a dollar valuation.
struct CardOptimizerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = CardOptimizerViewModel()
    @FocusState private var amountFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        inputs.hiveEntrance(0)
                        results.hiveEntrance(1)
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Best card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
        .task { await model.optimize() }
    }

    // MARK: Inputs

    private var inputs: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Purchase").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    categoryRow
                    Divider().overlay(Theme.borderDefault)
                    subcategoryRow
                    Divider().overlay(Theme.borderDefault)
                    amountRow
                }
            }
            findButton
        }
    }

    private var categoryRow: some View {
        Menu {
            ForEach(Taxonomy.categories, id: \.self) { cat in
                Button(cat) { model.selectCategory(cat); refresh() }
            }
        } label: {
            pickerRow(label: "Category", value: model.category)
        }
    }

    @ViewBuilder private var subcategoryRow: some View {
        let options = model.subcategoryOptions
        Menu {
            Button("Any") { model.subcategory = nil; refresh() }
            ForEach(options, id: \.self) { sub in
                Button(sub) { model.subcategory = sub; refresh() }
            }
        } label: {
            pickerRow(label: "Subcategory", value: model.subcategory ?? "Any")
        }
        .disabled(options.isEmpty)
        .opacity(options.isEmpty ? 0.5 : 1)
    }

    private var amountRow: some View {
        HStack {
            Text("Amount").font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text("$").font(.hiveMono(15, weight: .medium)).foregroundStyle(Theme.inkSecondary)
            TextField("0", value: $model.amount, format: .number.precision(.fractionLength(0)))
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 110)
                .font(.hiveMono(15, weight: .medium))
                .foregroundStyle(Theme.inkPrimary)
                .focused($amountFocused)
                .onSubmit { refresh() }
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private func pickerRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(.hiveBody(15)).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text(value).font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.blue)
                .lineLimit(1)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
        }
        .frame(minHeight: Theme.minTouchTarget)
        .contentShape(Rectangle())
    }

    private var findButton: some View {
        Button {
            amountFocused = false
            Haptics.selection()
            Task { await model.optimize() }
        } label: {
            Text("Find best card").frame(maxWidth: .infinity)
        }
        .buttonStyle(HivePrimaryButtonStyle())
    }

    // MARK: Results

    @ViewBuilder private var results: some View {
        LoadStateView(
            state: model.state,
            emptyTitle: "No card match",
            emptyMessage: "No linked card has an earn rule for this purchase yet.",
            emptyIcon: "creditcard",
            onRetry: { Task { await model.optimize() } }
        ) { cards in
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                ForEach(Array(cards.enumerated()), id: \.element.id) { i, card in
                    CardOptionRow(option: card, amount: model.amount)
                        .hiveEntrance(min(i + 2, 6))
                }
                Text("Ranked by redemption value across programs.")
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                    .padding(.leading, Theme.Spacing.xs)
                    .padding(.top, Theme.Spacing.xs)
            }
        } skeleton: {
            SkeletonList(count: 4)
        }
    }

    /// Re-run when a picker changes — keeps the answer live without a tap.
    private func refresh() { Task { await model.optimize() } }
}

// MARK: - Result row

private struct CardOptionRow: View {
    let option: CardOption
    let amount: Decimal

    private var pointsLabel: Int { Int(option.pointsEarned.rounded()) }
    private var rateLabel: String {
        let r = option.earnRate
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }

    var body: some View {
        Group {
            if option.isBest {
                RewardsCard { content }
            } else {
                Card { content }
            }
        }
    }

    private var content: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: Theme.Spacing.xs) {
                    Text(cardName)
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    if option.isBest {
                        Text("Best")
                            .font(.hiveBody(10, weight: .bold))
                            .foregroundStyle(Theme.base)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.honeyBright, in: Capsule())
                    }
                }
                Text(option.program)
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                PointsText(points: pointsLabel, size: 18, weight: .semibold)
                Text("\(rateLabel)× points")
                    .font(.hiveMono(12)).foregroundStyle(Theme.honeyBright)
            }
        }
    }

    private var cardName: String {
        if let name = option.accountName, !name.isEmpty { return name }
        return CardCatalog.name(option.cardSlug)
    }
}
