import SwiftUI
import GoogleSignIn

@main
struct HIVEApp: App {
    @State private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .preferredColorScheme(.dark)
                .tint(Theme.blue) // interactive accent = blue, app-wide
                .task { app.bootstrap() }
                .onOpenURL { url in
                    // Let the Google SDK complete the OAuth redirect.
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
