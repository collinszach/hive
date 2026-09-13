import SwiftUI

/// The comparison board: every way to book each leg, ranked on one axis.
///
/// The ranking key is `trueCost` — cash out **plus** the baseline value of the points
/// burnt — which is what lets a Costco quote sit in the same list as 60,000 Amex MR and
/// $89. Points are never shown as free; treating them that way is the mistake this
/// screen exists to prevent.
struct TripBoardView: View {
    let tripId: String
    let tripName: String

    @State private var model: TripBoardViewModel
    @State private var addingLeg = false
    @State private var legKind = "flight"
    @State private var legTitle = ""
    // Live fare search needs all three; without them it can only say so.
    @State private var legOrigin = ""
    @State private var legDest = ""
    @State private var legDate = Date()
    @State private var searchTarget: SearchTarget?
    @State private var searchingLegId: String?
    @State private var optionTarget: OptionTarget?
    @State private var routeTarget: RouteTarget?

    init(tripId: String, tripName: String) {
        self.tripId = tripId
        self.tripName = tripName
        _model = State(initialValue: TripBoardViewModel(tripId: tripId))
    }

    var body: some View {
        Screen(title: tripName, refresh: { await model.load() }) {
            LoadStateView(
                state: model.state,
                emptyTitle: "Nothing planned yet",
                emptyMessage: "Add a flight or hotel, then put in the quotes you're weighing up.",
                emptyIcon: "airplane",
                onRetry: { Task { await model.load() } }
            ) { trip in
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    if let cost = trip.estimatedTrueCost {
                        totalCard(cost, legs: trip.legCount).hiveEntrance(0)
                    }
                    TripSpendSection(
                        spend: model.spend,
                        affordability: model.affordability,
                        suggested: model.suggested,
                        onLink: { await model.linkTransaction($0) },
                        onUnlink: { await model.unlinkTransaction($0) }
                    )
                    .hiveEntrance(1)

                    if addingLeg { newLegCard.hiveEntrance(1) }

                    if trip.legs.isEmpty && !addingLeg {
                        Card {
                            Text("Add a flight or hotel, then put in the quotes you're weighing up.")
                                .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .hiveEntrance(1)
                    }

                    ForEach(Array(trip.legs.enumerated()), id: \.element.id) { i, leg in
                        legSection(leg).hiveEntrance(min(i + 2, 6))
                    }
                }
                .padding(.top, Theme.Spacing.sm)
            } skeleton: {
                VStack(spacing: Theme.Spacing.md) {
                    SkeletonBlock(height: 72, cornerRadius: Theme.Radius.card)
                    SkeletonList(count: 3)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.selection()
                    addingLeg.toggle()
                    legTitle = ""
                } label: {
                    Image(systemName: addingLeg ? "xmark" : "plus")
                }
                .foregroundStyle(Theme.blue)
                .accessibilityLabel(addingLeg ? "Cancel" : "Add leg")
            }
        }
        .task { await model.load() }
        .sheet(item: $optionTarget) { target in
            AddOptionView(legTitle: target.legTitle) { body in
                await model.addOption(legId: target.legId, body)
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $searchTarget) { target in
            FlightSearchView(legTitle: target.legTitle, result: target.result) { quote in
                await model.addOptionFromQuote(legId: target.legId, quote: quote)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $routeTarget) { target in
            AwardRoutesView(option: target.option, routes: target.routes)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: Total

    private func totalCard(_ cost: Decimal, legs: Int) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Estimated all-in").hiveLabelStyle()
                MoneyText(amount: cost, size: 32, weight: .semibold)
                Text("Best or chosen option across \(legs) \(legs == 1 ? "leg" : "legs"), with points priced at what they're worth to you.")
                    .font(.hiveBody(12))
                    .foregroundStyle(Theme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: New leg

    private var newLegCard: some View {
        Card {
            VStack(spacing: Theme.Spacing.sm) {
                Picker("Kind", selection: $legKind) {
                    Text("Flight").tag("flight")
                    Text("Hotel").tag("hotel")
                    Text("Car").tag("car")
                    Text("Activity").tag("activity")
                }
                .pickerStyle(.segmented)

                TextField("e.g. LAX → LIS, Mar 14", text: $legTitle)
                    .font(.hiveBody(15)).foregroundStyle(Theme.inkPrimary)
                    .frame(minHeight: Theme.minTouchTarget)

                if legKind == "flight" {
                    HStack(spacing: Theme.Spacing.sm) {
                        TextField("LAX", text: $legOrigin)
                            .font(.hiveMono(15)).foregroundStyle(Theme.inkPrimary)
                            .textInputAutocapitalization(.characters)
                            .frame(width: 64)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11)).foregroundStyle(Theme.inkGhost)
                        TextField("LIS", text: $legDest)
                            .font(.hiveMono(15)).foregroundStyle(Theme.inkPrimary)
                            .textInputAutocapitalization(.characters)
                            .frame(width: 64)
                        Spacer()
                        DatePicker("", selection: $legDate, displayedComponents: .date)
                            .labelsHidden()
                    }
                    .frame(minHeight: Theme.minTouchTarget)
                }

                HStack {
                    Spacer()
                    Button("Add leg") {
                        Task {
                            let isFlight = legKind == "flight"
                            await model.addLeg(
                                kind: legKind,
                                title: legTitle.trimmingCharacters(in: .whitespaces).nilIfEmpty,
                                origin: isFlight ? legOrigin.trimmingCharacters(in: .whitespaces).uppercased().nilIfEmpty : nil,
                                destination: isFlight ? legDest.trimmingCharacters(in: .whitespaces).uppercased().nilIfEmpty : nil,
                                legDate: isFlight ? DateOnly.string(from: legDate) : nil
                            )
                            legOrigin = ""; legDest = ""
                            addingLeg = false
                        }
                    }
                    .font(.hiveBody(14, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                }
                .frame(minHeight: Theme.minTouchTarget)
            }
        }
    }

    // MARK: Leg

    private func legSection(_ leg: TripLegDTO) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: leg.icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.honeyBright)
                Text(leg.displayTitle)
                    .font(.hiveBody(15, weight: .semibold))
                    .foregroundStyle(Theme.inkPrimary)
                Spacer()
                if leg.kind == "flight" {
                    if searchingLegId == leg.id {
                        ProgressView().controlSize(.mini)
                    } else {
                        Button("Fares") {
                            Haptics.selection()
                            Task {
                                searchingLegId = leg.id
                                let result = await model.searchFlights(legId: leg.id)
                                searchingLegId = nil
                                if let result {
                                    searchTarget = SearchTarget(
                                        legId: leg.id, legTitle: leg.displayTitle, result: result
                                    )
                                }
                            }
                        }
                        .font(.hiveBody(13, weight: .medium))
                        .foregroundStyle(Theme.inkSecondary)
                    }
                }
                Button("Add option") {
                    Haptics.selection()
                    optionTarget = OptionTarget(legId: leg.id, legTitle: leg.displayTitle)
                }
                .font(.hiveBody(13, weight: .medium))
                .foregroundStyle(Theme.blue)
            }
            .padding(.horizontal, Theme.Spacing.xs)

            if leg.options.isEmpty {
                Card {
                    Text("No quotes yet. Add a cash price and an award to compare them.")
                        .font(.hiveBody(13)).foregroundStyle(Theme.inkSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(leg.options.enumerated()), id: \.element.id) { i, o in
                            if i > 0 { Rectangle().fill(Theme.borderDefault).frame(height: 1) }
                            optionRow(o)
                        }
                    }
                }
            }
        }
        .contextMenu {
            Button("Delete leg", role: .destructive) {
                Task { await model.deleteLeg(leg.id) }
            }
        }
    }

    // MARK: Option

    private func optionRow(_ o: TravelOptionDTO) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: Theme.Spacing.xs) {
                Text(o.label ?? (o.isAward ? (o.program ?? "Award") : "Cash"))
                    .font(.hiveBody(15, weight: .medium))
                    .foregroundStyle(Theme.inkPrimary)
                    .lineLimit(1)
                if o.isSelected {
                    tag("CHOSEN", Theme.honeyBright)
                } else if o.isBest {
                    tag("BEST", Theme.income)
                }
                Spacer(minLength: Theme.Spacing.xs)
                VStack(alignment: .trailing, spacing: 1) {
                    Text(priceLabel(o))
                        .font(.hiveMono(13, weight: .medium))
                        .foregroundStyle(Theme.inkPrimary)
                    if let tc = o.trueCost {
                        Text("≈ \(money(tc)) all-in")
                            .font(.hiveBody(10)).foregroundStyle(Theme.inkGhost)
                    }
                }
            }

            Text(o.verdict)
                .font(.hiveBody(12))
                .foregroundStyle(verdictColor(o.rating))
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: Theme.Spacing.md) {
                if o.isAward, let program = o.program, let pts = o.pointsPrice {
                    Button("How would I pay?") {
                        Haptics.selection()
                        Task {
                            let routes = await model.routes(
                                program: program, points: NSDecimalNumber(decimal: pts).doubleValue
                            )
                            routeTarget = RouteTarget(option: o, routes: routes)
                        }
                    }
                    .font(.hiveBody(12, weight: .medium))
                    .foregroundStyle(Theme.blue)
                }
                Spacer()
                if !o.isSelected {
                    Button("Choose") { Task { await model.selectOption(o.id) } }
                        .font(.hiveBody(12, weight: .medium))
                        .foregroundStyle(Theme.income)
                }
            }
            .frame(minHeight: Theme.minTouchTarget)
        }
        .padding(.vertical, Theme.Spacing.xs)
        .contextMenu {
            Button("Remove option", role: .destructive) {
                Task { await model.deleteOption(o.id) }
            }
        }
    }

    private func tag(_ text: String, _ color: Color) -> some View {
        Text(text)
            .font(.hiveBody(9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(Capsule().fill(color.opacity(0.16)))
    }

    private func priceLabel(_ o: TravelOptionDTO) -> String {
        if let pts = o.pointsPrice, pts > 0 {
            let n = Int(NSDecimalNumber(decimal: pts).doubleValue.rounded())
            let base = "\(n.formatted(.number.grouping(.automatic))) pts"
            return o.fees > 0 ? "\(base) + \(money(o.fees))" : base
        }
        if let cash = o.cashPrice { return money(cash) }
        return "—"
    }

    private func money(_ d: Decimal) -> String {
        d.formatted(.currency(code: "USD").precision(.fractionLength(0)))
    }

    private func verdictColor(_ rating: String) -> Color {
        switch rating {
        case "great": return Theme.income
        case "good":  return Theme.income.opacity(0.85)
        case "poor":  return Theme.expense
        case "fair":  return Theme.inkSecondary
        default:      return Theme.inkTertiary
        }
    }
}

/// Identifiable wrappers so `.sheet(item:)` can carry context into the sheets.
struct OptionTarget: Identifiable {
    let id = UUID()
    let legId: String
    let legTitle: String
}

struct SearchTarget: Identifiable {
    let id = UUID()
    let legId: String
    let legTitle: String
    let result: FlightSearchDTO
}

struct RouteTarget: Identifiable {
    let id = UUID()
    let option: TravelOptionDTO
    let routes: [PointsRouteDTO]
}
