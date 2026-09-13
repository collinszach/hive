import SwiftUI

/// Live cash fares for a leg — the benchmark an award gets judged against.
///
/// Missing credentials are a missing capability, not a failure: the manual lane still
/// works, so this says so plainly rather than showing an error. Test-host data is
/// flagged, because a cached fare must never masquerade as a live one.
struct FlightSearchView: View {
    let legTitle: String
    let result: FlightSearchDTO
    let onAdd: (FlightQuoteDTO) async -> Void

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
                        if result.isTestData && !result.quotes.isEmpty { testDataNote }

                        if result.configured, result.error == nil, result.quotes.isEmpty {
                            Card {
                                Text("No fares returned for this route and date.")
                                    .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }

                        if !result.quotes.isEmpty {
                            Card {
                                VStack(spacing: 0) {
                                    ForEach(Array(result.quotes.enumerated()), id: \.element.id) { i, q in
                                        if i > 0 {
                                            Rectangle().fill(Theme.borderDefault).frame(height: 1)
                                        }
                                        quoteRow(q)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Cash fares")
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
                Text("Live search isn't set up").hiveLabelStyle()
                Text("No Amadeus credentials are configured, so fares have to be typed in. Everything else on the board works without them.")
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

    private var testDataNote: some View {
        Card {
            HStack(alignment: .top, spacing: Theme.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.honeyBright)
                Text("Amadeus test data — cached and illustrative, not live pricing. Judging a redemption against these numbers will mislead you.")
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func quoteRow(_ q: FlightQuoteDTO) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(q.label)
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1)
                if let d = q.readableDuration {
                    Text(d).font(.hiveBody(11)).foregroundStyle(Theme.inkSecondary)
                }
            }
            Spacer(minLength: Theme.Spacing.xs)
            Text(q.price.formatted(.currency(code: q.currency).precision(.fractionLength(0))))
                .font(.hiveMono(14, weight: .medium))
                .foregroundStyle(Theme.inkPrimary)
            if addingId == q.id {
                ProgressView().controlSize(.mini)
            } else {
                Button("Add") {
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
}
