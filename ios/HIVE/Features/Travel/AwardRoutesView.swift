import SwiftUI

/// "How would I pay for this?" — where the points for an award could come from.
///
/// Direct balances rank above transfers, because a transfer is irreversible and takes
/// time. Every transfer carries that warning: moving points to chase an award that's
/// gone by the time they land is the expensive mistake this screen exists to prevent.
struct AwardRoutesView: View {
    let option: TravelOptionDTO
    let routes: [PointsRouteDTO]

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                        header
                        if routes.isEmpty {
                            Card {
                                Text("None of your balances reach \(option.program ?? "this program").")
                                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        } else {
                            ForEach(routes) { route in
                                routeCard(route)
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("How would I pay?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
            }
        }
    }

    private var header: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(option.label ?? option.program ?? "Award").hiveLabelStyle()
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    PointsText(points: pointsInt, size: 28, weight: .semibold)
                    Text(option.program ?? "")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                }
                if option.fees > 0 {
                    Text("plus \(option.fees.formatted(.currency(code: "USD").precision(.fractionLength(2)))) in fees")
                        .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var pointsInt: Int {
        Int(NSDecimalNumber(decimal: option.pointsPrice ?? 0).doubleValue.rounded())
    }

    private func routeCard(_ r: PointsRouteDTO) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.program)
                            .font(.hiveBody(15, weight: .semibold))
                            .foregroundStyle(Theme.inkPrimary)
                        if !r.direct, let partner = r.partner {
                            Text("→ \(partner)")
                                .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        } else {
                            Text("Already in this currency")
                                .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        PointsText(points: Int(r.needed.rounded()), size: 14, weight: .medium)
                        Text("needed").font(.hiveBody(10)).foregroundStyle(Theme.inkGhost)
                    }
                }

                Text(coverageLine(r))
                    .font(.hiveBody(12))
                    .foregroundStyle(r.covered ? Theme.income : Theme.warning)

                if !r.direct, let warning = r.warning {
                    HStack(alignment: .top, spacing: Theme.Spacing.xs) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.honeyBright)
                        Text(warning)
                            .font(.hiveBody(11))
                            .foregroundStyle(Theme.inkTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func coverageLine(_ r: PointsRouteDTO) -> String {
        let have = Int(r.available.rounded()).formatted(.number.grouping(.automatic))
        if r.covered {
            var line = "You have \(have) — covered."
            if r.ratio != 1 { line += " Ratio \(formatted(r.ratio)):1." }
            if r.typicalDays > 0 { line += " Usually lands in ~\(r.typicalDays)d." }
            return line
        }
        let short = Int(r.shortfall.rounded()).formatted(.number.grouping(.automatic))
        return "You have \(have) — \(short) short."
    }

    private func formatted(_ d: Double) -> String {
        d == d.rounded() ? String(Int(d)) : String(format: "%.1f", d)
    }
}
