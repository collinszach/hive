import SwiftUI
import SafariServices
import LinkKit

/// Presents the native Plaid Link flow. Plaid draws its own full-screen modal, so we
/// don't host it in a SwiftUI sheet — we hand the SDK the top-most view controller and
/// keep a strong reference to the `Handler` for the lifetime of the flow.
@MainActor
final class PlaidLinkCoordinator {
    private var handler: Handler?

    /// `onSuccess` returns the public token + the institution name (when Plaid provides
    /// it) so the backend can label the link. `onExit` fires on cancel or error.
    func present(
        linkToken: String,
        onSuccess: @escaping (String, String?) -> Void,
        onExit: @escaping () -> Void
    ) {
        var config = LinkTokenConfiguration(token: linkToken) { success in
            onSuccess(success.publicToken, success.metadata.institution.name)
        }
        config.onExit = { _ in onExit() }

        switch Plaid.create(config) {
        case .failure:
            onExit()
        case .success(let handler):
            self.handler = handler
            guard let presenter = Self.topViewController() else { onExit(); return }
            handler.open(presentUsing: .viewController(presenter))
        }
    }

    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .first { $0.activationState == .foregroundActive } as? UIWindowScene
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

/// In-app Safari sheet (real Safari context — brokerage OAuth works here, unlike an
/// embedded WKWebView which providers block). Used for the SnapTrade connection portal.
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    var onFinish: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let vc = SFSafariViewController(url: url)
        vc.delegate = context.coordinator
        vc.preferredControlTintColor = UIColor(Theme.blue)
        return vc
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}

    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        let onFinish: () -> Void
        init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }
        func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
            onFinish()
        }
    }
}
