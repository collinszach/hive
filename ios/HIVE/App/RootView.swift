import SwiftUI

/// Auth-gated root router: a brief launch state while the Keychain is checked,
/// the sign-in screen when signed out, and the 5-tab shell when signed in.
struct RootView: View {
    @Environment(AppState.self) private var app

    var body: some View {
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
        .preferredColorScheme(.dark)
}
