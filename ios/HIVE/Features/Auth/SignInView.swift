import SwiftUI

/// First screen for a signed-out user. Single action: continue with Google.
struct SignInView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            // Single cool wash from the top edge — depth without a glow blob (anti-tell).
            Theme.heroLift.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Spacer()

                // Dominant, left-anchored wordmark — not centered (breaks the
                // everything-centered AI tell; gives a clear entry point top-left).
                VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text("HIVE")
                            .font(.hiveBody(52, weight: .bold))
                            .foregroundStyle(Theme.inkPrimary)
                        // The one honey mark is admissible here as the brand glyph,
                        // not a generic accent — and never repeats as interactive color.
                        Text(".")
                            .font(.hiveBody(52, weight: .bold))
                            .foregroundStyle(Theme.honeyBright)
                    }
                    .hiveEntrance(0)

                    Text("Your money, in focus.")
                        .font(.hiveBody(17))
                        .foregroundStyle(Theme.inkSecondary)
                        .hiveEntrance(1)
                }

                Spacer()

                VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                    Button {
                        Task { await app.signIn() }
                    } label: {
                        HStack(spacing: Theme.Spacing.sm) {
                            if app.isSigningIn {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: "g.circle.fill")
                            }
                            Text(app.isSigningIn ? "Signing in…" : "Continue with Google")
                                .font(.hiveBody(16, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: Theme.minTouchTarget)
                        .foregroundStyle(.white)
                        .background(Theme.blue)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
                    }
                    .disabled(app.isSigningIn)

                    if let error = app.signInError {
                        Text(error)
                            .font(.hiveBody(13))
                            .foregroundStyle(Theme.expense)
                            .transition(.opacity)
                    } else {
                        Text("Private by design · self-hosted")
                            .font(.hiveBody(12))
                            .foregroundStyle(Theme.inkTertiary)
                    }
                }
                .hiveEntrance(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.bottom, Theme.Spacing.xxl)
        }
        .animation(.easeOut(duration: 0.2), value: app.signInError)
    }
}
