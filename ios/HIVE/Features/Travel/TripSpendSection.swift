import SwiftUI

/// Whether the trip can be paid for, and how the plan is tracking against reality.
///
/// Both are cash comparisons. An award's cash cost is its fees, not the value of the
/// points it burns — charging a baseline valuation against a bank balance would
/// overstate what the trip actually costs to fund. Points are reported separately.
struct TripSpendSection: View {
    let spend: TripSpendDTO?
    let affordability: TripAffordabilityDTO?
    let suggested: [LinkedTransactionDTO]
    let onLink: (String) async -> Void
    let onUnlink: (String) async -> Void

    @State private var showSuggested = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            if let a = affordability { affordabilityCard(a) }
            if let s = spend { plannedVsActual(s) }
        }
    }

    // MARK: Affordability

    private func affordabilityCard(_ a: TripAffordabilityDTO) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Can you pay for it").hiveLabelStyle()

                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    MoneyText(amount: a.cashNeeded, size: 26, weight: .semibold)
                    Text("cash needed").font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }

                Text(a.summary)
                    .font(.hiveBody(13))
                    .foregroundStyle(a.affordable ? Theme.income : Theme.expense)
                    .fixedSize(horizontal: false, vertical: true)

                if let monthly = a.monthlyToSave {
                    Text("\(money(monthly))/month closes the gap" +
                         (a.daysUntil.map { " — \($0) days to go" } ?? "") + ".")
                        .font(.hiveBody(12))
                        .foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if !a.pointsNeeded.isEmpty {
                    divider
                    ForEach(a.pointsNeeded.sorted(by: { $0.key < $1.key }), id: \.key) { program, needed in
                        let short = a.pointsShortfalls[program]
                        HStack {
                            Text(program).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                            Spacer()
                            Text(pointsLine(needed: needed, short: short))
                                .font(.hiveMono(12))
                                .foregroundStyle(short == nil ? Theme.income : Theme.expense)
                        }
                        .frame(minHeight: 24)
                    }
                }

                Text("Measured against liquid position, not this month's safe-to-spend — a trip months out is a saving question. An award's cash cost is its fees.")
                    .font(.hiveBody(10))
                    .foregroundStyle(Theme.inkGhost)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func pointsLine(needed: Double, short: Double?) -> String {
        let n = Int(needed.rounded()).formatted(.number.grouping(.automatic))
        guard let short else { return "\(n) needed · covered" }
        return "\(n) needed · \(Int(short.rounded()).formatted(.number.grouping(.automatic))) short"
    }

    // MARK: Planned vs actual

    private func plannedVsActual(_ s: TripSpendDTO) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack {
                    Text("Planned vs actual").hiveLabelStyle()
                    Spacer()
                    if !suggested.isEmpty {
                        Button(showSuggested ? "Hide" : "\(suggested.count) to attach") {
                            Haptics.selection(); showSuggested.toggle()
                        }
                        .font(.hiveBody(12, weight: .medium))
                        .foregroundStyle(Theme.blue)
                    }
                }

                if !s.hasPlan {
                    Text("Nothing costed yet — choose an option on a leg to set the plan.")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: Theme.Spacing.xl) {
                    figure("Planned", s.plannedCash, Theme.inkSecondary)
                    figure("Actual", s.actualCash, Theme.inkPrimary)
                    if s.hasPlan && s.actualCash > 0 {
                        figure(s.variance > 0 ? "Over" : "Under",
                               abs(s.variance),
                               s.variance > 0 ? Theme.expense : Theme.income)
                    }
                }

                if showSuggested && !suggested.isEmpty {
                    divider
                    Text("Travel charges near these dates. Attach the ones that are really this trip.")
                        .font(.hiveBody(11)).foregroundStyle(Theme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(suggested) { t in
                        transactionRow(t, attached: false)
                    }
                }

                if !s.transactions.isEmpty {
                    divider
                    ForEach(s.transactions) { t in
                        transactionRow(t, attached: true)
                    }
                } else if !showSuggested {
                    Text("No transactions attached yet.")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func figure(_ label: String, _ amount: Decimal, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.hiveBody(9, weight: .semibold))
                .foregroundStyle(Theme.inkTertiary)
            Text(money(amount))
                .font(.hiveMono(16, weight: .medium))
                .foregroundStyle(color)
        }
    }

    private func transactionRow(_ t: LinkedTransactionDTO, attached: Bool) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            if attached {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.income)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(t.merchant ?? "Unknown")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkPrimary).lineLimit(1)
                Text(DateOnly.shortLabel(t.date))
                    .font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
            }
            Spacer(minLength: Theme.Spacing.xs)
            MoneyText(amount: t.amount, size: 13, weight: .medium)
            Button {
                Haptics.selection()
                Task {
                    if attached { await onUnlink(t.transactionId) }
                    else { await onLink(t.transactionId) }
                }
            } label: {
                Image(systemName: attached ? "minus.circle" : "plus.circle")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(attached ? Theme.inkGhost : Theme.blue)
            }
            .buttonStyle(.plain)
        }
        .frame(minHeight: Theme.minTouchTarget)
    }

    private var divider: some View {
        Rectangle().fill(Theme.borderDefault).frame(height: 1)
    }

    private func money(_ d: Decimal) -> String {
        d.formatted(.currency(code: "USD").precision(.fractionLength(0)))
    }
}
