import SwiftUI

/// Auth-gated root router: a brief launch state while the Keychain is checked,
/// the sign-in screen when signed out, and the 5-tab shell when signed in.
struct RootView: View {
    @Environment(AppState.self) private var app
    @Environment(LockState.self) private var lock
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            phaseContent

            // App-lock gate — only over signed-in content, when enabled and locked.
            if app.phase == .signedIn && lock.isEnabled && lock.isLocked {
                LockScreenView()
                    .transition(.opacity)
            }

            // App-switcher privacy cover — hide signed-in content whenever inactive.
            if app.phase == .signedIn && scenePhase != .active && !lock.isLocked {
                PrivacyCover()
            }
        }
    }

    @ViewBuilder
    private var phaseContent: some View {
        switch app.phase {
        case .launching:
            ZStack { Theme.base.ignoresSafeArea() }
        case .signedOut:
            SignInView()
        case .signedIn:
            MainTabView()
        }
    }
}

#Preview {
    RootView()
        .environment(AppState())
        .environment(LockState())
        .preferredColorScheme(.dark)
}
