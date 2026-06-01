import Foundation
import Observation

@MainActor
@Observable
final class SettingsViewModel {
    private(set) var state: LoadState<MeResponse> = .loading

    /// True while a delete request is in flight, so the sheet can show progress and
    /// block double-submits.
    private(set) var isDeleting = false
    /// User-facing message when a delete attempt fails (mismatched name or transport).
    var deleteError: String?

    private let api: APIClient
    init(api: APIClient = .shared) { self.api = api }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            let me = try await api.send(.get("/api/auth/me"), as: MeResponse.self)
            state = .loaded(me)
        } catch let error as APIError {
            state = .failed(error)
        } catch {
            state = .failed(.network)
        }
    }

    /// The account name the delete confirmation must match. Empty until `/me` loads.
    var username: String { state.value?.username ?? "" }

    /// Attempt account deletion through `app`. Returns true on success (the caller then
    /// lets `AppState` drop to sign-in); on failure sets `deleteError` and returns false.
    func deleteAccount(confirm: String, via app: AppState) async -> Bool {
        guard !isDeleting else { return false }
        isDeleting = true
        deleteError = nil
        defer { isDeleting = false }
        do {
            try await app.deleteAccount(confirmUsername: confirm)
            Haptics.success()
            return true
        } catch let error as APIError {
            Haptics.error()
            // A mismatched name comes back as a 400 → .server(400); give a precise hint.
            deleteError = error == .server(status: 400)
                ? "That doesn't match your account name."
                : error.userMessage
            return false
        } catch {
            Haptics.error()
            deleteError = APIError.network.userMessage
            return false
        }
    }
}
