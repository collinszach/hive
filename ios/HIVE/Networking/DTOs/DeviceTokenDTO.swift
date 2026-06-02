import Foundation

/// Body for `POST /api/notifications/device-token` (and DELETE). The token is the
/// hex-encoded APNs device token. `isSandbox` tells the backend which APNs host to
/// use — sandbox for dev/debug builds, production for TestFlight/App Store.
struct DeviceTokenRequest: Encodable {
    let token: String
    let isSandbox: Bool
    let platform: String

    init(token: String, isSandbox: Bool, platform: String = "ios") {
        self.token = token
        self.isSandbox = isSandbox
        self.platform = platform
    }
}
