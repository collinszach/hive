import Foundation
import Observation

@MainActor
@Observable
final class DashboardViewModel {
    private(set) var state: LoadState<DashboardSummary> = .loading

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        // Don't flash the skeleton on a pull-to-refresh of already-loaded data.
        if state.value == nil { state = .loading }
        do {
            let summary = try await api.send(
                .get("/api/dashboard/summary"),
                as: DashboardSummary.self
            )
            // The dashboard always has structure (accounts/anomaly block), so we
            // treat a successful response as loaded rather than empty.
            state = .loaded(summary)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }
}
