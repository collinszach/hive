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

    var selectedScenarioId: String?
    var horizonMonths: Int = 24

    /// Horizon presets, in months: 1y, 2y, 5y.
    let horizons: [Int] = [12, 24, 60]

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    var selectedScenario: ScenarioDTO? {
        (scenariosState.value ?? []).first { $0.id == selectedScenarioId }
    }

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
            await loadProjection()
        } catch let error as APIError {
            scenariosState = .failed(error)
        } catch {
            scenariosState = .failed(.network)
        }
    }

    func loadProjection() async {
        guard let id = selectedScenarioId else { return }
        projectionState = .loading
        do {
            let resp = try await api.send(
                .get("/api/planning/scenarios/\(id)/projection",
                     query: [.init(name: "months", value: String(horizonMonths))]),
                as: ProjectionResponse.self
            )
            projectionState = .loaded(resp)
        } catch let error as APIError {
            projectionState = .failed(error)
        } catch {
            projectionState = .failed(.network)
        }
    }

    func selectScenario(_ id: String) async {
        guard id != selectedScenarioId else { return }
        Haptics.selection()
        selectedScenarioId = id
        await loadProjection()
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
            await loadScenarios()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }
}
