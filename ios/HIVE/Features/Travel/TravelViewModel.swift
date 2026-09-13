import Foundation
import Observation

@MainActor
@Observable
final class TravelViewModel {
    private(set) var tripsState: LoadState<[TripDTO]> = .loading
    private(set) var balances: TravelBalancesDTO?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if tripsState.value == nil { tripsState = .loading }
        async let tripsTask = api.send(.get("/api/travel/trips"), as: [TripDTO].self)
        async let balancesTask = api.send(.get("/api/travel/balances"), as: TravelBalancesDTO.self)

        // Balances are context, not the screen — a failure there must not blank the
        // trip list, so it's tolerated separately.
        balances = try? await balancesTask
        do {
            let trips = try await tripsTask
            tripsState = trips.isEmpty ? .empty : .loaded(trips)
        } catch let error as APIError {
            tripsState = .failed(error)
        } catch {
            tripsState = .failed(.network)
        }
    }

    @discardableResult
    func createTrip(name: String, destination: String?) async -> TripDTO? {
        do {
            let trip = try await api.send(
                .post("/api/travel/trips"),
                body: TripCreate(name: name, destination: destination),
                as: TripDTO.self
            )
            Haptics.success()
            await load()
            return trip
        } catch {
            Haptics.error()
            return nil
        }
    }

    func deleteTrip(_ id: String) async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/travel/trips/\(id)"))
            Haptics.success()
            await load()
        } catch {
            Haptics.error()
        }
    }
}

@MainActor
@Observable
final class TripBoardViewModel {
    private(set) var state: LoadState<TripDetailDTO> = .loading

    let tripId: String
    private let api: APIClient

    init(tripId: String, api: APIClient = .shared) {
        self.tripId = tripId
        self.api = api
    }

    func load() async {
        do {
            let detail = try await api.send(
                .get("/api/travel/trips/\(tripId)"), as: TripDetailDTO.self
            )
            state = .loaded(detail)
            await loadSpend()
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }

    func addLeg(kind: String, title: String?) async {
        do {
            try await api.send(
                .post("/api/travel/trips/\(tripId)/legs"),
                body: LegCreate(kind: kind, title: title)
            )
            Haptics.success()
            await load()
        } catch { Haptics.error() }
    }

    func deleteLeg(_ legId: String) async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/travel/legs/\(legId)"))
            await load()
        } catch { Haptics.error() }
    }

    func addOption(legId: String, _ body: OptionCreate) async -> Bool {
        do {
            try await api.send(.post("/api/travel/legs/\(legId)/options"), body: body)
            Haptics.success()
            await load()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    func selectOption(_ optionId: String) async {
        do {
            try await api.send(
                .post("/api/travel/options/\(optionId)/select"), body: EmptyTravelBody()
            )
            Haptics.success()
            await load()
        } catch { Haptics.error() }
    }

    func deleteOption(_ optionId: String) async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/travel/options/\(optionId)"))
            await load()
        } catch { Haptics.error() }
    }

    // MARK: Planned vs actual

    private(set) var spend: TripSpendDTO?
    private(set) var affordability: TripAffordabilityDTO?
    private(set) var suggested: [LinkedTransactionDTO] = []

    /// Loaded alongside the board but tolerated separately — these are context, and a
    /// failure here must not blank the comparison the screen exists for.
    func loadSpend() async {
        async let s = api.send(.get("/api/travel/trips/\(tripId)/spend"), as: TripSpendDTO.self)
        async let a = api.send(.get("/api/travel/trips/\(tripId)/affordability"), as: TripAffordabilityDTO.self)
        async let g = api.send(.get("/api/travel/trips/\(tripId)/suggested-transactions"), as: [LinkedTransactionDTO].self)
        spend = try? await s
        affordability = try? await a
        suggested = (try? await g) ?? []
    }

    func linkTransaction(_ txId: String) async {
        do {
            try await api.send(
                .post("/api/travel/trips/\(tripId)/transactions/\(txId)"), body: EmptyTravelBody()
            )
            Haptics.success()
            await loadSpend()
        } catch { Haptics.error() }
    }

    func unlinkTransaction(_ txId: String) async {
        do {
            try await api.sendVoid(Endpoint(
                method: .delete, path: "/api/travel/trips/\(tripId)/transactions/\(txId)"
            ))
            await loadSpend()
        } catch { Haptics.error() }
    }

    /// Where the points for an award could come from — direct balances, then transfers.
    func routes(program: String, points: Double) async -> [PointsRouteDTO] {
        (try? await api.send(
            .get("/api/travel/routes", query: [
                .init(name: "program", value: program),
                .init(name: "points", value: String(points)),
            ]),
            as: [PointsRouteDTO].self
        )) ?? []
    }
}

/// Empty JSON body for POSTs that take no payload.
struct EmptyTravelBody: Encodable {}
