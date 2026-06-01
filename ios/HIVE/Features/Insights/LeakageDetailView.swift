import SwiftUI

/// "Rewards on the table", in full. Opened from the Insights leakage section. Answers
/// two questions: *what should I have done?* (aggregated guidance — which card to put
/// each category on) and *how much did I lose?* (total points + dollars, then the
/// per-transaction breakdown). Rewards context → honey treatment throughout.
struct LeakageDetailView: View {
    let response: LeakageResponse

    @Environment(\.dismiss) private var dismiss

    private var totalPointsLost: Double {
        response.entries.reduce(0) { $0 + $1.pointsLost }
    }

    /// Aggregated, actionable guidance: group missed purchases by category + the card
    /// that would've been best, summed by impact. This is the "what to do" list.
    private var guidance: [Guidance] {
        let grouped: [Guidance.Key: [LeakageEntry]] = Dictionary(grouping: response.entries) { entry in
            Guidance.Key(category: entry.category ?? "Other", cardSlug: entry.bestCardSlug, program: entry.bestProgram)
        }
        let items: [Guidance] = grouped.map { (key: Guidance.Key, entries: [LeakageEntry]) -> Guidance in
            let pts: Double = entries.reduce(0.0) { $0 + $1.pointsLost }
            let dollars: Decimal = entries.reduce(Decimal(0)) { $0 + $1.leakageDollars }
            return Guidance(key: key, pointsLost: pts, dollarsLost: dollars, count: entries.count)
        }
        return items.sorted { $0.dollarsLost > $1.dollarsLost }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        hero.hiveEntrance(0)
                        guidanceSection.hiveEntrance(1)
                        transactionsSection.hiveEntrance(2)
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Rewards on the table")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    // MARK: Hero — the cost, in points and dollars

    private var hero: some View {
        RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Points left on the table · \(response.days)d").hiveLabelStyle()
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    PointsText(points: Int(totalPointsLost.rounded()), size: 40, weight: .medium)
                    Text("pts").font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
                }
                Text("Worth \(response.totalLeakageDollars.formatted(.currency(code: "USD"))) — across \(response.transactionCount) purchase\(response.transactionCount == 1 ? "" : "s") where another card you own would've earned more.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Guidance — what you should've done

    private var guidanceSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("What to do differently").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            VStack(spacing: Theme.Spacing.md) {
                ForEach(guidance) { g in
                    Card {
                        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(g.key.category)
                                    .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                                Spacer()
                                Text("+\(Int(g.pointsLost.rounded())) pts")
                                    .font(.hiveMono(14, weight: .semibold)).foregroundStyle(Theme.honeyBright)
                            }
                            HStack(spacing: Theme.Spacing.xs) {
                                Image(systemName: "creditcard").font(.system(size: 12))
                                    .foregroundStyle(Theme.inkTertiary)
                                Text("Use").font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                Text(CardCatalog.name(g.key.cardSlug))
                                    .font(.hiveBody(13, weight: .semibold)).foregroundStyle(Theme.honeyBright)
                                Text("for \(g.key.category.lowercased())")
                                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                    .lineLimit(1)
                            }
                            Text("\(g.count) purchase\(g.count == 1 ? "" : "s") · \(g.dollarsLost.formatted(.currency(code: "USD"))) in missed value")
                                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                        }
                    }
                }
            }
        }
    }

    // MARK: Per-transaction breakdown

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Every missed purchase").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            VStack(spacing: Theme.Spacing.md) {
                ForEach(response.entries) { entry in
                    LeakageDetailRow(entry: entry)
                }
            }
        }
    }

    // MARK: Grouping model

    struct Guidance: Identifiable {
        struct Key: Hashable {
            let category: String
            let cardSlug: String
            let program: String
        }
        let key: Key
        let pointsLost: Double
        let dollarsLost: Decimal
        let count: Int
        var id: String { "\(key.category)-\(key.cardSlug)" }
    }
}

// MARK: - Detail row (used vs. best)

private struct LeakageDetailRow: View {
    let entry: LeakageEntry

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(entry.merchant ?? entry.category ?? "Purchase")
                        .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text(entry.amount.formatted(.currency(code: "USD")))
                        .font(.hiveMono(14, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                }
                Text(DateOnly.shortLabel(entry.date))
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)

                Rectangle().fill(Theme.borderSubtle).frame(height: 1)
                    .padding(.vertical, 2)

                comparisonRow(
                    label: "You used",
                    card: entry.actualCardSlug,
                    rate: entry.actualEarnRate,
                    points: entry.actualPoints,
                    emphasized: false
                )
                comparisonRow(
                    label: "Best card",
                    card: entry.bestCardSlug,
                    rate: entry.bestEarnRate,
                    points: entry.bestPoints,
                    emphasized: true
                )

                HStack {
                    Text("Lost").font(.hiveBody(12, weight: .medium)).foregroundStyle(Theme.inkSecondary)
                    Spacer()
                    Text("+\(Int(entry.pointsLost.rounded())) pts · \(entry.leakageDollars.formatted(.currency(code: "USD")))")
                        .font(.hiveMono(13, weight: .semibold)).foregroundStyle(Theme.honeyBright)
                }
                .padding(.top, 2)
            }
        }
    }

    private func comparisonRow(label: String, card: String, rate: Double, points: Double, emphasized: Bool) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Text(label)
                .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                .frame(width: 64, alignment: .leading)
            Text(CardCatalog.name(card))
                .font(.hiveBody(13, weight: emphasized ? .semibold : .regular))
                .foregroundStyle(emphasized ? Theme.honeyBright : Theme.inkPrimary)
                .lineLimit(1)
            Spacer()
            Text("\(rateLabel(rate))× · \(Int(points.rounded())) pts")
                .font(.hiveMono(12))
                .foregroundStyle(emphasized ? Theme.inkPrimary : Theme.inkSecondary)
        }
    }

    private func rateLabel(_ r: Double) -> String {
        r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }
}
