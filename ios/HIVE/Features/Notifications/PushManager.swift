import SwiftUI
import Observation
import UserNotifications
import UIKit

/// Owns the push-notification lifecycle: permission state, APNs registration, and
/// syncing the device token to the backend. A shared singleton so the app delegate
/// (which receives the raw token from the system) can hand it back here.
///
/// PII discipline: the device token is opaque (not financial data); we send only it,
/// over HTTPS with the Keychain Bearer token. Nothing is logged.
@MainActor
@Observable
final class PushManager {
    static let shared = PushManager()

    /// Last known system permission state, refreshed on appear / scene activation.
    private(set) var status: UNAuthorizationStatus = .notDetermined
    /// True once we've successfully posted a token to the backend this session.
    private(set) var isRegistered = false

    /// The most recent hex token from APNs, retained so we can re-POST after sign-in
    /// or unregister on sign-out.
    private var currentToken: String?

    private let api: APIClient

    private init(api: APIClient = .shared) {
        self.api = api
    }

    /// Sandbox for debug/dev builds (aps-environment=development), production otherwise.
    private var isSandbox: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// Refresh `status` from the system. Cheap; call on appear.
    func refreshStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        status = settings.authorizationStatus
    }

    /// Ask the system for permission (first time) and register with APNs on grant.
    /// Returns true if authorized. Safe to call repeatedly.
    @discardableResult
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        await refreshStatus()
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }

    /// If already authorized, (re)register with APNs so we get a fresh token. Call at
    /// launch for users who previously opted in.
    func registerIfAuthorized() async {
        await refreshStatus()
        if status == .authorized {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Called by the app delegate with the raw APNs token data. Hex-encodes and POSTs it.
    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        currentToken = hex
        Task { await sync(token: hex) }
    }

    private func sync(token: String) async {
        let body = DeviceTokenRequest(token: token, isSandbox: isSandbox)
        do {
            try await api.send(.post("/api/notifications/device-token"), body: body)
            isRegistered = true
        } catch {
            isRegistered = false
        }
    }

    /// Remove this device's token on sign-out so a signed-out device stops receiving pushes.
    func unregister() async {
        guard let token = currentToken else { return }
        let body = DeviceTokenRequest(token: token, isSandbox: isSandbox)
        let ep = Endpoint(method: .delete, path: "/api/notifications/device-token")
        try? await api.send(ep, body: body)
        isRegistered = false
    }
}
