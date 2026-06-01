import SwiftUI
import GoogleSignIn

@main
struct HIVEApp: App {
    @State private var app = AppState()
    @State private var lock = LockState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(lock)
                .preferredColorScheme(.dark)
                .tint(Theme.blue) // interactive accent = blue, app-wide
                .task { app.bootstrap() }
                .onOpenURL { url in
                    // Let the Google SDK complete the OAuth redirect.
                    GIDSignIn.sharedInstance.handle(url)
                }
                .onChange(of: scenePhase) { _, phase in lock.handleScenePhase(phase) }
        }
    }
}
