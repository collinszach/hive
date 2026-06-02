import Foundation
import Observation

/// Drives the Forecast screen: loads scenarios, then runs a projection for the
/// selected scenario + horizon. Scenarios and projection are tracked as separate
/// `LoadState`s so a projection error never blanks the scenario picker.
@MainActor
@Observable
final class ForecastViewModel {
    private(set) var scenariosState: LoadState<[ScenarioDTO]> = .loading
    private(set) var projectionState: LoadState<ProjectionResponse> = .loading
    private(set) var incomeState: LoadState<[IncomeStreamDTO]> = .loading
    private(set) var eventsState: LoadState<[PlanEventDTO]> = .loading

    /// Optional second scenario overlaid on the chart for what-if comparison.
    private(set) var compareProjection: ProjectionResponse?
    var compareScenarioId: String?

    var selectedScenarioId: String?
    var horizonMonths: Int = 24

    /// Horizon presets, in months: 1y, 2y, 5y.
    let horizons: [Int] = [12, 24, 60]

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    var selectedScenario: ScenarioDTO? {
        (scenariosState.value ?? []).first { $0.id == selectedScenarioId }
    }

    /// Scenarios eligible as a comparison overlay (everything but the selected one).
    var comparableScenarios: [ScenarioDTO] {
        (scenariosState.value ?? []).filter { $0.id != selectedScenarioId }
    }

    var compareScenario: ScenarioDTO? {
        (scenariosState.value ?? []).first { $0.id == compareScenarioId }
    }

    /// Current assumptions for the selected scenario, taken from the live projection.
    var currentAssumptions: AssumptionsDTO? { projectionState.value?.assumptions }

    func load() async {
        await loadScenarios()
    }

    func loadScenarios() async {
        if scenariosState.value == nil { scenariosState = .loading }
        do {
            // The backend auto-seeds a Baseline, so this is never empty in practice.
            let scenarios = try await api.send(.get("/api/planning/scenarios"), as: [ScenarioDTO].self)
            scenariosState = scenarios.isEmpty ? .empty : .loaded(scenarios)
            if selectedScenarioId == nil || !scenarios.contains(where: { $0.id == selectedScenarioId }) {
                selectedScenarioId = scenarios.first(where: \.isBaseline)?.id ?? scenarios.first?.id
            }
            // A deleted/renamed compare target must not linger.
            if let cid = compareScenarioId, !scenarios.contains(where: { $0.id == cid }) {
                compareScenarioId = nil
                compareProjection = nil
            }
            await loadProjection()
            await loadDetails()
        } catch let error as APIError {
            scenariosState = .failed(error)
        } catch {
            scenariosState = .failed(.network)
        }
    }

    private func projection(for id: String) async throws -> ProjectionResponse {
        try await api.send(
            .get("/api/planning/scenarios/\(id)/projection",
                 query: [.init(name: "months", value: String(horizonMonths))]),
            as: ProjectionResponse.self
        )
    }

    func loadProjection() async {
        guard let id = selectedScenarioId else { return }
        projectionState = .loading
        do {
            projectionState = .loaded(try await projection(for: id))
            await loadCompareProjection()
        } catch let error as APIError {
            projectionState = .failed(error)
        } catch {
            projectionState = .failed(.network)
        }
    }

    /// Load income streams and life events for the selected scenario (drives the editors).
    func loadDetails() async {
        guard let id = selectedScenarioId else { return }
        do {
            async let income = api.send(.get("/api/planning/scenarios/\(id)/income"), as: [IncomeStreamDTO].self)
            async let events = api.send(.get("/api/planning/scenarios/\(id)/events"), as: [PlanEventDTO].self)
            let (inc, evt) = try await (income, events)
            incomeState = inc.isEmpty ? .empty : .loaded(inc)
            eventsState = evt.isEmpty ? .empty : .loaded(evt)
        } catch let error as APIError {
            incomeState = .failed(error); eventsState = .failed(error)
        } catch {
            incomeState = .failed(.network); eventsState = .failed(.network)
        }
    }

    private func loadCompareProjection() async {
        guard let cid = compareScenarioId else { compareProjection = nil; return }
        compareProjection = try? await projection(for: cid)
    }

    func selectScenario(_ id: String) async {
        guard id != selectedScenarioId else { return }
        Haptics.selection()
        selectedScenarioId = id
        // Avoid comparing a scenario against itself.
        if compareScenarioId == id { compareScenarioId = nil; compareProjection = nil }
        incomeState = .loading; eventsState = .loading
        await loadProjection()
        await loadDetails()
    }

    func setCompare(_ id: String?) async {
        guard id != compareScenarioId else { return }
        Haptics.selection()
        compareScenarioId = id
        await loadCompareProjection()
    }

    func setHorizon(_ months: Int) async {
        guard months != horizonMonths else { return }
        Haptics.selection()
        horizonMonths = months
        await loadProjection()
    }

    /// Create a what-if scenario, select it, and project it.
    @discardableResult
    func createScenario(name: String) async -> Bool {
        do {
            let created = try await api.send(
                .post("/api/planning/scenarios"),
                body: ScenarioCreateBody(name: name), as: ScenarioDTO.self
            )
            Haptics.success()
            selectedScenarioId = created.id
            incomeState = .loading; eventsState = .loading
            await loadScenarios()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    /// Delete the selected scenario (baseline is protected server-side). Falls back to
    /// the baseline afterward.
    @discardableResult
    func deleteSelectedScenario() async -> Bool {
        guard let id = selectedScenarioId, selectedScenario?.isBaseline == false else { return false }
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/planning/scenarios/\(id)"))
            Haptics.success()
            selectedScenarioId = nil
            await loadScenarios()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    // MARK: Assumptions

    @discardableResult
    func saveAssumptions(_ body: AssumptionsUpdateBody) async -> Bool {
        guard let id = selectedScenarioId else { return false }
        do {
            try await api.send(Endpoint(method: .put, path: "/api/planning/scenarios/\(id)/assumptions"), body: body)
            Haptics.success()
            await loadProjection()   // re-reads assumptions + re-projects
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    // MARK: Income streams

    @discardableResult
    func addIncome(_ body: IncomeStreamCreateBody) async -> Bool {
        guard let id = selectedScenarioId else { return false }
        do {
            try await api.send(.post("/api/planning/scenarios/\(id)/income"), body: body)
            Haptics.success()
            await loadDetails(); await loadProjection()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    func deleteIncome(_ stream: IncomeStreamDTO) async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/planning/income/\(stream.id)"))
            Haptics.success()
            await loadDetails(); await loadProjection()
        } catch {
            Haptics.error()
        }
    }

    // MARK: Life events

    @discardableResult
    func addEvent(_ body: EventCreateBody) async -> Bool {
        guard let id = selectedScenarioId else { return false }
        do {
            try await api.send(.post("/api/planning/scenarios/\(id)/events"), body: body)
            Haptics.success()
            await loadDetails(); await loadProjection()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    func deleteEvent(_ event: PlanEventDTO) async {
        do {
            try await api.sendVoid(Endpoint(method: .delete, path: "/api/planning/events/\(event.id)"))
            Haptics.success()
            await loadDetails(); await loadProjection()
        } catch {
            Haptics.error()
        }
    }
}
