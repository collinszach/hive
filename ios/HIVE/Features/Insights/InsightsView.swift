import SwiftUI
import Charts

/// Insights tab — three independent feeds stacked top-to-bottom: a net-worth trend
/// (the dominant hero + chart), the anomaly review queue (act-on-it cards), and the
/// points leakage report (rewards left on the table, the only honey on this screen).
struct InsightsView: View {
    @Environment(AppState.self) private var app
    @State private var model = InsightsViewModel()
    @State private var showNetWorthDetail = false
    @State private var selectedAnomaly: AnomalyDTO?
    @State private var showLeakageDetail = false
    @State private var showChat = false

    var body: some View {
        Screen(title: "Insights", refresh: { await model.loadAll() }) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                assistantBanner.hiveEntrance(0)
                netWorthSection.hiveEntrance(1)
                anomaliesSection.hiveEntrance(2)
                leakageSection.hiveEntrance(3)
            }
            .padding(.top, Theme.Spacing.sm)
        }
        .navigationDestination(isPresented: $showChat) { ChatView() }
        .task { if model.netWorthState.value == nil { await model.loadAll() } }
        .sheet(isPresented: $showNetWorthDetail) {
            if let snaps = model.netWorthState.value {
                NetWorthDetailView(
                    snapshots: snaps,
                    organicChange: model.netWorthChange,
                    trendDays: model.trendDays
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
        .sheet(item: $selectedAnomaly) { anomaly in
            AnomalyDetailView(
                anomaly: anomaly,
                isReviewing: model.reviewingIds.contains(anomaly.id),
                onReview: { status in Task { await model.review(anomaly, status: status) } }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showLeakageDetail) {
            if let resp = model.leakageState.value {
                LeakageDetailView(response: resp)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    // MARK: AI assistant entry

    private var assistantBanner: some View {
        Button { Haptics.selection(); showChat = true } label: {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: "sparkles")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                    .frame(width: 40, height: 40)
                    .background(Theme.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ask the assistant")
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                    Text("Spending, budgets, points — in plain English.")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary).lineLimit(1)
                }
                Spacer(minLength: Theme.Spacing.sm)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.inkTertiary)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Net worth trend

    @ViewBuilder private var netWorthSection: some View {
        switch model.netWorthState {
        case .loading:
            SkeletonBlock(height: 220, cornerRadius: Theme.Radius.card)
        case .empty:
            sectionCard(title: "Net worth") {
                Text("No snapshots yet — balances are captured daily once accounts are linked.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }
        case .failed:
            sectionCard(title: "Net worth") { failedNote { Task { await model.loadNetWorth() } } }
        case .loaded(let snaps):
            Button { Haptics.selection(); showNetWorthDetail = true } label: {
                netWorthHero(snaps)
            }
            .buttonStyle(.plain)
        }
    }

    private func netWorthHero(_ snaps: [NetWorthSnapshot]) -> some View {
        let change = model.netWorthChange
        let up = change >= 0
        return VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Net worth").hiveLabelStyle()
                MoneyHero(amount: model.currentNetWorth, size: 40)
                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 12, weight: .bold))
                    Text(abs(change).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                        .font(.hiveMono(13, weight: .medium))
                    Text("· \(model.trendDays)d").font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                }
                .foregroundStyle(up ? Theme.income : Theme.expense)
            }

            trendChart(snaps)
                .frame(height: 140)
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

    private func trendChart(_ snaps: [NetWorthSnapshot]) -> some View {
        let points = snaps.compactMap { snap -> (Date, Double)? in
            guard let d = snap.date else { return nil }
            return (d, (snap.netWorth as NSDecimalNumber).doubleValue)
        }
        return Chart(points, id: \.0) { point in
            AreaMark(x: .value("Date", point.0), y: .value("Net worth", point.1))
                .foregroundStyle(.linearGradient(
                    colors: [Theme.blue.opacity(0.22), Theme.blue.opacity(0.0)],
                    startPoint: .top, endPoint: .bottom))
                .interpolationMethod(.monotone)
            LineMark(x: .value("Date", point.0), y: .value("Net worth", point.1))
                .foregroundStyle(Theme.blue)
                .lineStyle(StrokeStyle(lineWidth: 2))
                .interpolationMethod(.monotone)
        }
        .chartXAxis {
            AxisMarks(preset: .aligned, values: .automatic(desiredCount: 3)) { _ in
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(.hiveBody(10)).foregroundStyle(Theme.inkTertiary)
            }
        }
        .chartYAxis {
            AxisMarks(preset: .aligned, position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(Decimal(v).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                            .font(.hiveMono(9)).foregroundStyle(Theme.inkTertiary)
                    }
                }
            }
        }
    }

    // MARK: Anomaly review queue

    @ViewBuilder private var anomaliesSection: some View {
        switch model.anomaliesState {
        case .loading:
            SkeletonList(count: 2)
        case .empty:
            sectionCard(title: "To review") {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(Theme.income)
                    Text("Nothing flagged — your spending looks normal.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                }
            }
        case .failed:
            sectionCard(title: "To review") { failedNote { Task { await model.loadAnomalies() } } }
        case .loaded(let items):
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                sectionHeader("To review", trailing: "\(items.count)")
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(items) { anomaly in
                        AnomalyCard(
                            anomaly: anomaly,
                            isReviewing: model.reviewingIds.contains(anomaly.id),
                            onOK: { Task { await model.review(anomaly, status: "ok") } },
                            onConfirm: { Task { await model.review(anomaly, status: "confirmed") } },
                            onTap: { Haptics.selection(); selectedAnomaly = anomaly }
                        )
                    }
                }
            }
        }
    }

    // MARK: Points leakage

    @ViewBuilder private var leakageSection: some View {
        switch model.leakageState {
        case .loading:
            SkeletonBlock(height: 96, cornerRadius: Theme.Radius.card)
        case .empty:
            sectionCard(title: "Rewards on the table") {
                Text("You used the best card on every purchase. Nice.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }
        case .failed:
            sectionCard(title: "Rewards on the table") { failedNote { Task { await model.loadLeakage() } } }
        case .loaded(let resp):
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                sectionHeader("Rewards on the table", trailing: nil)
                Button { Haptics.selection(); showLeakageDetail = true } label: {
                    leakageHero(resp)
                }
                .buttonStyle(.plain)
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(resp.entries.prefix(6)) { LeakageRow(entry: $0) }
                }
                Button { Haptics.selection(); showLeakageDetail = true } label: {
                    HStack(spacing: Theme.Spacing.xs) {
                        Text("See what to do differently")
                            .font(.hiveBody(13, weight: .medium))
                        Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(Theme.honeyBright)
                    .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func leakageHero(_ resp: LeakageResponse) -> some View {
        RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Missed value · \(resp.days)d").hiveLabelStyle()
                MoneyHero(amount: resp.totalLeakageDollars, size: 32)
                Text("Across \(resp.transactionCount) purchase\(resp.transactionCount == 1 ? "" : "s") on a non-optimal card")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Section chrome

    private func sectionHeader(_ title: String, trailing: String?) -> some View {
        HStack {
            Text(title).hiveLabelStyle()
            Spacer()
            if let trailing {
                Text(trailing).font(.hiveMono(12, weight: .medium)).foregroundStyle(Theme.inkSecondary)
            }
        }
        .padding(.leading, Theme.Spacing.xs)
    }

    private func sectionCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            sectionHeader(title, trailing: nil)
            Card { content().frame(maxWidth: .infinity, alignment: .leading) }
        }
    }

    private func failedNote(retry: @escaping () -> Void) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Text("Couldn’t load.").font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
            Button("Retry", action: retry)
                .font(.hiveBody(13, weight: .medium)).foregroundStyle(Theme.blue)
        }
    }
}

// MARK: - Anomaly card

struct AnomalyCard: View {
    let anomaly: AnomalyDTO
    let isReviewing: Bool
    let onOK: () -> Void
    let onConfirm: () -> Void
    var onTap: (() -> Void)? = nil

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(anomaly.transaction?.displayName ?? "Transaction")
                        .font(.hiveBody(15, weight: .semibold)).foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    Spacer()
                    if let amount = anomaly.transaction?.amount {
                        MoneyText(amount: amount, size: 16, weight: .semibold)
                    }
                    if onTap != nil {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.inkTertiary)
                    }
                }
                Text(anomaly.reason)
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(2)

                HStack(spacing: Theme.Spacing.sm) {
                    if isReviewing {
                        ProgressView().controlSize(.small).frame(maxWidth: .infinity)
                    } else {
                        Button(action: onOK) {
                            Text("Looks fine").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(HiveSecondaryButtonStyle())

                        Button(action: onConfirm) {
                            Label("Flag", systemImage: "flag.fill").frame(maxWidth: .infinity)
                        }
                        .environment(\.tintColor, Theme.expense)
                        .buttonStyle(HiveSecondaryButtonStyle())
                    }
                }
                .padding(.top, Theme.Spacing.xs)
            }
            .contentShape(Rectangle())
            .onTapGesture { onTap?() }
        }
    }
}

// MARK: - Leakage row

struct LeakageRow: View {
    let entry: LeakageEntry

    var body: some View {
        Card {
            HStack(spacing: Theme.Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.merchant ?? "Purchase")
                        .font(.hiveBody(15, weight: .medium)).foregroundStyle(Theme.inkPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Spacing.xs) {
                        Text(CardCatalog.name(entry.actualCardSlug))
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.inkTertiary)
                        Text(CardCatalog.name(entry.bestCardSlug))
                            .font(.hiveBody(12, weight: .medium)).foregroundStyle(Theme.honeyBright)
                    }
                    .lineLimit(1)
                }
                Spacer(minLength: Theme.Spacing.sm)
                Text("+\(entry.leakageDollars.formatted(.currency(code: "USD")))")
                    .font(.hiveMono(14, weight: .medium)).foregroundStyle(Theme.honeyBright)
            }
        }
    }
}
