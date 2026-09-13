import SwiftUI

/// Award space on a route, annotated with whether your points actually cover it.
///
/// The annotation is the whole point: an award priced in a programme you can't reach
/// is trivia. "No transfer data" is deliberately distinct from "nothing you hold
/// reaches this" — the first is a gap in curated data and must never be shown as a
/// fact about the user's points.
struct AwardSearchView: View {
    let legTitle: String
    let result: AwardSearchDTO
    let onAdd: (AwardQuoteDTO) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var addingId: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                        Text(legTitle)
                            .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                            .padding(.horizontal, Theme.Spacing.xs)

                        if !result.configured { notConfigured }
                        if let error = result.error { errorCard(error) }

                        if result.configured, result.error == nil, result.quotes.isEmpty {
                            Card {
                                Text("No award space found for this route and date.")
                                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }

                        ForEach(result.quotes) { q in
                            quoteCard(q)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Award space")
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

    private var notConfigured: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Award search isn't set up").hiveLabelStyle()
                Text("No seats.aero key is configured, so award prices have to be typed in. Everything else on the board works without it.")
                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func errorCard(_ message: String) -> some View {
        Card {
            Text(message)
                .font(.hiveBody(13)).foregroundStyle(Theme.expense)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func quoteCard(_ q: AwardQuoteDTO) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(q.label)
                            .font(.hiveBody(15, weight: .medium))
                            .foregroundStyle(Theme.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        if let airlines = q.airlines, !airlines.isEmpty {
                            Text(airlines)
                                .font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: Theme.Spacing.sm)
                    VStack(alignment: .trailing, spacing: 1) {
                        PointsText(points: Int(q.miles.rounded()), size: 15, weight: .medium)
                        if q.taxes > 0 {
                            Text("+ \(q.taxes.formatted(.currency(code: q.taxesCurrency).precision(.fractionLength(0))))")
                                .font(.hiveBody(10)).foregroundStyle(Theme.inkGhost)
                        }
                    }
                }

                HStack(spacing: Theme.Spacing.xs) {
                    Text(q.coverageLabel)
                        .font(.hiveBody(12, weight: .medium))
                        .foregroundStyle(coverageColor(q.coverage))
                        .fixedSize(horizontal: false, vertical: true)
                    if let seats = q.seats, seats > 0 {
                        Text("· \(seats) seat\(seats == 1 ? "" : "s")")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    }
                }

                HStack {
                    Spacer()
                    if addingId == q.id {
                        ProgressView().controlSize(.mini)
                    } else {
                        Button("Add to board") {
                            Haptics.selection()
                            Task {
                                addingId = q.id
                                await onAdd(q)
                                addingId = nil
                                dismiss()
                            }
                        }
                        .font(.hiveBody(13, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                    }
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func coverageColor(_ coverage: String) -> Color {
        switch coverage {
        case "covered":  return Theme.income
        case "short":    return Theme.expense
        case "unknown":  return Theme.honeyBright
        default:         return Theme.inkTertiary
        }
    }
}
