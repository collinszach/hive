import SwiftUI

/// Travel — trips, and what you have to spend on them.
///
/// Lives in the Plan tab alongside Points because it's the same question seen from the
/// other end: Points says what you hold, Travel says what it's worth spending on.
struct TravelView: View {
    @State private var model = TravelViewModel()
    @State private var addingTrip = false
    @State private var newName = ""
    @State private var newDestination = ""
    @State private var pendingDelete: TripDTO?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            if let b = model.balances, !b.programs.isEmpty {
                balancesCard(b).hiveEntrance(1)
            }

            HStack {
                Text("Trips").hiveLabelStyle()
                Spacer()
                Button(addingTrip ? "Cancel" : "New trip") {
                    Haptics.selection()
                    addingTrip.toggle()
                    newName = ""; newDestination = ""
                }
                .font(.hiveBody(13, weight: .medium))
                .foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)
            .hiveEntrance(2)

            if addingTrip { newTripCard.hiveEntrance(2) }

            LoadStateView(
                state: model.tripsState,
                emptyTitle: "No trips yet",
                emptyMessage: "Start one for somewhere you're thinking about. Add the flights and hotels, then put in the quotes you're weighing up — cash, award, Costco — and see which actually costs least once the points are priced at what they're worth to you.",
                emptyIcon: "airplane",
                emptyAction: ("New trip", { Haptics.selection(); addingTrip = true }),
                onRetry: { Task { await model.load() } }
            ) { trips in
                VStack(spacing: Theme.Spacing.md) {
                    ForEach(Array(trips.enumerated()), id: \.element.id) { i, trip in
                        NavigationLink(value: trip) {
                            tripRow(trip)
                        }
                        .buttonStyle(.plain)
                        .hiveEntrance(min(i + 3, 6))
                        .contextMenu {
                            Button("Delete trip", role: .destructive) { pendingDelete = trip }
                        }
                    }
                }
            } skeleton: {
                SkeletonList(count: 3)
            }
        }
        .task { await model.load() }
        .navigationDestination(for: TripDTO.self) { trip in
            TripBoardView(tripId: trip.id, tripName: trip.name)
        }
        .alert("Delete this trip?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("Cancel", role: .cancel) { pendingDelete = nil }
            Button("Delete", role: .destructive) {
                if let t = pendingDelete { Task { await model.deleteTrip(t.id) } }
                pendingDelete = nil
            }
        } message: {
            Text("\(pendingDelete?.name ?? "This trip") and everything in it will be removed.")
        }
    }

    // MARK: Balances

    private func balancesCard(_ b: TravelBalancesDTO) -> some View {
        RewardsCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text("What you have to spend").hiveLabelStyle()
                    Spacer()
                    Text("verified \(DateOnly.shortLabel(b.partnersVerifiedOn))")
                        .font(.hiveBody(10))
                        .foregroundStyle(Theme.inkGhost)
                }
                ForEach(b.programs) { p in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(p.program)
                                .font(.hiveBody(14, weight: .medium))
                                .foregroundStyle(Theme.inkPrimary)
                            Spacer()
                            PointsText(points: Int(p.balance.rounded()), size: 14, weight: .medium)
                        }
                        Text(p.transferable
                             ? "\(p.partnerCount) transfer partners"
                             : "No transfer partners")
                            .font(.hiveBody(11))
                            .foregroundStyle(Theme.inkSecondary)
                        // Only the non-transferable nudge is worth the space: it's the
                        // one that changes what you should do with the balance.
                        if !p.transferable, let advice = p.advice {
                            Text(advice)
                                .font(.hiveBody(11))
                                .foregroundStyle(Theme.honeyBright)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: New trip

    private var newTripCard: some View {
        Card {
            VStack(spacing: Theme.Spacing.sm) {
                TextField("Trip name", text: $newName)
                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    .textInputAutocapitalization(.words)
                    .frame(minHeight: Theme.minTouchTarget)
                Rectangle().fill(Theme.borderDefault).frame(height: 1)
                TextField("Destination (optional)", text: $newDestination)
                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    .textInputAutocapitalization(.words)
                    .frame(minHeight: Theme.minTouchTarget)
                HStack {
                    Spacer()
                    Button("Create") {
                        Task {
                            let trimmed = newName.trimmingCharacters(in: .whitespaces)
                            guard !trimmed.isEmpty else { return }
                            await model.createTrip(
                                name: trimmed,
                                destination: newDestination.trimmingCharacters(in: .whitespaces).nilIfEmpty
                            )
                            addingTrip = false
                        }
                    }
                    .font(.hiveBody(14, weight: .semibold))
                    .foregroundStyle(newName.trimmingCharacters(in: .whitespaces).isEmpty
                                     ? Theme.inkGhost : Theme.blue)
                    .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
    }

    // MARK: Row

    private func tripRow(_ trip: TripDTO) -> some View {
        Card {
            HStack(spacing: Theme.Spacing.md) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: Theme.Spacing.xs) {
                        Text(trip.name)
                            .font(.hiveBody(15, weight: .semibold))
                            .foregroundStyle(Theme.inkPrimary)
                            .lineLimit(1)
                        statusPill(trip)
                    }
                    HStack(spacing: Theme.Spacing.xs) {
                        if let d = trip.destination, !d.isEmpty {
                            Text(d).font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                            Text("·").foregroundStyle(Theme.inkGhost)
                        }
                        Text("\(trip.legCount) \(trip.legCount == 1 ? "leg" : "legs")")
                            .font(.hiveBody(12)).foregroundStyle(Theme.inkSecondary)
                    }
                    .lineLimit(1)
                }
                Spacer(minLength: Theme.Spacing.sm)
                if let cost = trip.estimatedTrueCost {
                    VStack(alignment: .trailing, spacing: 1) {
                        MoneyText(amount: cost, size: 14, weight: .medium)
                        Text("all-in").font(.hiveBody(10)).foregroundStyle(Theme.inkGhost)
                    }
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkGhost)
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
    }

    private func statusPill(_ trip: TripDTO) -> some View {
        Text(trip.statusLabel)
            .font(.hiveBody(10, weight: .semibold))
            .foregroundStyle(pillColor(trip.status))
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, 2)
            .background(Capsule().fill(pillColor(trip.status).opacity(0.14)))
    }

    private func pillColor(_ status: String) -> Color {
        switch status {
        case "planning": return Theme.honeyBright
        case "booked":   return Theme.income
        case "taken":    return Theme.inkGhost
        default:         return Theme.inkSecondary
        }
    }
}

extension String {
    /// Nil for an empty string, so optional API fields stay absent rather than "".
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
