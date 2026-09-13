import SwiftUI

/// "Did you book this with points?" — the review queue for award-fee candidates.
///
/// An award booking pays the fare in points, so nothing reaches the card except taxes
/// and fees. That small airline charge is the only trace a redemption leaves, and
/// without confirming it the displayed balance drifts upward forever. Detection can
/// see that points were probably spent; only the user knows how many.
struct RedemptionReviewView: View {
    let candidates: [RedemptionDTO]
    let programs: [String]
    let onReviewed: () async -> Void

    @Environment(\.dismiss) private var dismiss
    private let api = APIClient.shared

    @State private var editingId: String?
    @State private var program: String = ""
    @State private var pointsText: String = ""
    @State private var cashText: String = ""
    @State private var busyId: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.base.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                        explainer
                        ForEach(candidates) { c in
                            candidateCard(c)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.lg)
                    .padding(.bottom, Theme.Spacing.xxl)
                }
            }
            .navigationTitle("Review redemptions")
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

    private var explainer: some View {
        Card {
            Text("An award booking pays the fare in points, so only taxes hit the card. These small charges look like that. Until they're confirmed, your balances are overstated by whatever those tickets cost.")
                .font(.hiveBody(13))
                .foregroundStyle(Theme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func candidateCard(_ c: RedemptionDTO) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(c.merchant ?? "Unknown")
                        .font(.hiveBody(15, weight: .semibold))
                        .foregroundStyle(Theme.inkPrimary)
                    Spacer()
                    MoneyText(amount: c.feesPaid, size: 14, weight: .medium)
                }
                Text(DateOnly.shortLabel(c.redeemedOn))
                    .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                Text(c.explanation)
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)

                if editingId == c.id {
                    editor(c)
                } else if busyId == c.id {
                    ProgressView().controlSize(.small)
                } else {
                    HStack(spacing: Theme.Spacing.sm) {
                        Button("Yes, points") {
                            Haptics.selection()
                            editingId = c.id
                            program = programs.first ?? ""
                            pointsText = ""
                            cashText = ""
                        }
                        .font(.hiveBody(13, weight: .semibold))
                        .foregroundStyle(Theme.honeyBright)
                        Spacer()
                        Button("Not a redemption") { Task { await dismissCandidate(c) } }
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                }
            }
        }
    }

    @ViewBuilder
    private func editor(_ c: RedemptionDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Picker("Program", selection: $program) {
                ForEach(programs, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.menu)
            .tint(Theme.blue)

            TextField("Points spent", text: $pointsText)
                .keyboardType(.numberPad)
                .font(.hiveMono(15))
                .foregroundStyle(Theme.inkPrimary)
                .frame(minHeight: Theme.minTouchTarget)

            TextField("Cash price it replaced (optional)", text: $cashText)
                .keyboardType(.decimalPad)
                .font(.hiveMono(15))
                .foregroundStyle(Theme.inkPrimary)
                .frame(minHeight: Theme.minTouchTarget)

            HStack(spacing: Theme.Spacing.md) {
                Button("Confirm") { Task { await confirm(c) } }
                    .font(.hiveBody(14, weight: .semibold))
                    .foregroundStyle(canConfirm ? Theme.income : Theme.inkGhost)
                    .disabled(!canConfirm)
                Button("Cancel") { editingId = nil }
                    .font(.hiveBody(14))
                    .foregroundStyle(Theme.inkSecondary)
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
    }

    private var canConfirm: Bool {
        !program.isEmpty && (Double(pointsText) ?? 0) > 0
    }

    private func confirm(_ c: RedemptionDTO) async {
        guard let pts = Double(pointsText), pts > 0 else { return }
        busyId = c.id
        editingId = nil
        defer { busyId = nil }
        let body = RedemptionConfirm(
            program: program,
            pointsSpent: pts,
            cashValueAvoided: Double(cashText)
        )
        do {
            _ = try await api.send(
                .post("/api/points/redemptions/\(c.id)/confirm"),
                body: body, as: RedemptionDTO.self
            )
            Haptics.success()
            await onReviewed()
        } catch {
            Haptics.error()
        }
    }

    private func dismissCandidate(_ c: RedemptionDTO) async {
        busyId = c.id
        defer { busyId = nil }
        do {
            _ = try await api.send(
                .post("/api/points/redemptions/\(c.id)/dismiss"),
                body: EmptyBody(), as: RedemptionDTO.self
            )
            Haptics.success()
            await onReviewed()
        } catch {
            Haptics.error()
        }
    }
}

/// Empty JSON body for POSTs that take no payload.
private struct EmptyBody: Encodable {}
