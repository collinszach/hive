import SwiftUI

// MARK: - Net worth detail

/// Tapping the net-worth hero opens this: the per-account breakdown behind the number,
/// plus an explanation of why the headline change can differ from the raw delta
/// (newly-linked accounts are excluded from "organic" growth).
struct NetWorthDetailView: View {
    let snapshots: [NetWorthSnapshot]
    let organicChange: Decimal
    let trendDays: Int

    @Environment(\.dismiss) private var dismiss

    private var current: NetWorthSnapshot? { snapshots.last }
    private var first: NetWorthSnapshot? { snapshots.first }

    /// Raw delta (everything, including accounts linked mid-window).
    private var rawChange: Decimal {
        guard let f = first, let l = current else { return 0 }
        return l.netWorth - f.netWorth
    }

    /// Accounts present in the latest snapshot but not the first — i.e. linked during
    /// the window, which inflate the raw delta but not the organic change.
    private var newlyLinked: [BreakdownLine] {
        guard let l = current?.breakdown else { return [] }
        let fKeys = Set(first?.breakdown?.keys ?? [:].keys)
        return l.filter { !fKeys.contains($0.key) }
            .map { BreakdownLine(rawKey: $0.key, amount: $0.value) }
            .sorted { $0.amount > $1.amount }
    }

    private var lines: [BreakdownLine] {
        (current?.breakdown ?? [:])
            .map { BreakdownLine(rawKey: $0.key, amount: $0.value) }
            .sorted { $0.amount > $1.amount }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        hero.hiveEntrance(0)
                        if rawChange != organicChange, !newlyLinked.isEmpty {
                            organicNote.hiveEntrance(1)
                        }
                        breakdownSection.hiveEntrance(2)
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Net worth")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private var hero: some View {
        let up = organicChange >= 0
        return VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Net worth").hiveLabelStyle()
            MoneyHero(amount: current?.netWorth ?? 0, size: 40)
            HStack(spacing: Theme.Spacing.xs) {
                Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                    .font(.system(size: 12, weight: .bold))
                Text(abs(organicChange).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                    .font(.hiveMono(13, weight: .medium))
                Text("· \(trendDays)d organic").font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
            }
            .foregroundStyle(up ? Theme.income : Theme.expense)
            statRow
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

    private var statRow: some View {
        HStack(spacing: Theme.Spacing.xl) {
            stat("Assets", current?.totalAssets ?? 0, Theme.income)
            stat("Liabilities", current?.totalLiabilities ?? 0, Theme.expense)
        }
        .padding(.top, Theme.Spacing.sm)
    }

    private func stat(_ label: String, _ amount: Decimal, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
            Text(amount.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                .font(.hiveMono(15, weight: .medium)).foregroundStyle(color)
        }
    }

    private var organicNote: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: "info.circle").font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.blue)
                    Text("Why not \(rawChange.formatted(.currency(code: "USD").precision(.fractionLength(0))))?")
                        .font(.hiveBody(14, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                }
                Text("The headline change counts only accounts linked for the whole \(trendDays) days, so newly-connected accounts don't read as growth. These were added during the window:")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(spacing: Theme.Spacing.xs) {
                    ForEach(newlyLinked) { line in
                        HStack {
                            Text(line.name).font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                            Spacer()
                            Text(line.amount.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                                .font(.hiveMono(13)).foregroundStyle(Theme.inkSecondary)
                        }
                    }
                }
            }
        }
    }

    private var breakdownSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("By account").hiveLabelStyle().padding(.leading, Theme.Spacing.xs)
            Card {
                VStack(spacing: 0) {
                    ForEach(Array(lines.enumerated()), id: \.element.id) { i, line in
                        if i > 0 {
                            Rectangle().fill(Theme.borderSubtle).frame(height: 1)
                                .padding(.vertical, Theme.Spacing.sm)
                        }
                        HStack {
                            Image(systemName: line.isLiability ? "creditcard" : "building.columns")
                                .font(.system(size: 13)).foregroundStyle(Theme.inkTertiary)
                                .frame(width: 22)
                            Text(line.name).font(.hiveBody(14, weight: .medium))
                                .foregroundStyle(Theme.inkPrimary).lineLimit(1)
                            Spacer()
                            Text(line.amount.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                                .font(.hiveMono(14, weight: .medium))
                                .foregroundStyle(line.isLiability ? Theme.expense : Theme.inkPrimary)
                        }
                        .frame(minHeight: 32)
                    }
                }
            }
        }
    }
}

/// One parsed breakdown entry. Keys arrive as `"<Account> (asset)"` / `"(liability)"`.
private struct BreakdownLine: Identifiable {
    let rawKey: String
    let amount: Decimal
    var id: String { rawKey }
    var isLiability: Bool { rawKey.hasSuffix("(liability)") }
    var name: String {
        rawKey
            .replacingOccurrences(of: " (asset)", with: "")
            .replacingOccurrences(of: " (liability)", with: "")
    }
}

// MARK: - Anomaly detail

/// Tapping an anomaly card opens the full picture: the flagged transaction's details,
/// the ML reason and score, and the same review actions as the card.
struct AnomalyDetailView: View {
    let anomaly: AnomalyDTO
    let isReviewing: Bool
    let onReview: (_ status: String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        amountHero.hiveEntrance(0)
                        reasonCard.hiveEntrance(1)
                        if anomaly.transaction != nil { detailsCard.hiveEntrance(2) }
                        actions.hiveEntrance(3)
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Flagged")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    private var amountHero: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(anomaly.transaction?.displayName ?? "Transaction").hiveLabelStyle()
            if let amount = anomaly.transaction?.amount {
                MoneyHero(amount: amount, size: 40)
            }
            if let date = anomaly.transaction?.date {
                Text(DateOnly.relativeLabel(date))
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }
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

    private var reasonCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: "sparkle.magnifyingglass").font(.system(size: 13))
                        .foregroundStyle(Theme.warning)
                    Text("Why this was flagged").hiveLabelStyle()
                }
                Text(anomaly.reason)
                    .font(.hiveBody(14)).foregroundStyle(Theme.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Anomaly score \(String(format: "%.2f", anomaly.anomalyScore))")
                    .font(.hiveMono(12)).foregroundStyle(Theme.inkTertiary)
            }
        }
    }

    private var detailsCard: some View {
        Card {
            VStack(spacing: 0) {
                if let cat = anomaly.transaction?.category {
                    row("Category", cat)
                }
                if let sub = anomaly.transaction?.subcategory {
                    divider; row("Subcategory", sub)
                }
                if let raw = anomaly.transaction?.rawDescription, !raw.isEmpty {
                    divider; row("Description", raw)
                }
            }
        }
    }

    private var actions: some View {
        Group {
            if isReviewing {
                ProgressView().controlSize(.small).frame(maxWidth: .infinity)
            } else {
                HStack(spacing: Theme.Spacing.sm) {
                    Button { onReview("ok"); dismiss() } label: {
                        Text("Looks fine").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(HiveSecondaryButtonStyle())
                    Button { onReview("confirmed"); dismiss() } label: {
                        Label("Flag", systemImage: "flag.fill").frame(maxWidth: .infinity)
                    }
                    .environment(\.tintColor, Theme.expense)
                    .buttonStyle(HiveSecondaryButtonStyle())
                }
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).font(.hiveBody(14)).foregroundStyle(Theme.inkSecondary)
            Spacer(minLength: Theme.Spacing.md)
            Text(value).font(.hiveBody(14, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                .multilineTextAlignment(.trailing)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderSubtle).frame(height: 1)
    }
}
