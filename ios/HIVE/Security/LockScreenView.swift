import SwiftUI

/// Full-screen gate shown over signed-in content while the app is locked. Auto-prompts
/// on appear; a manual button re-prompts after a cancel or failure (so a dismissed
/// Face ID sheet never strands the user on a blank lock screen).
struct LockScreenView: View {
    @Environment(LockState.self) private var lock

    var body: some View {
        ZStack {
            Theme.base.ignoresSafeArea()
            VStack(spacing: Theme.Spacing.xl) {
                VStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 40, weight: .light))
                        .foregroundStyle(Theme.honeyBright)
                    Text("HIVE is locked")
                        .font(.hiveBody(20, weight: .semibold))
                        .foregroundStyle(Theme.inkPrimary)
                    Text("Authenticate to view your finances.")
                        .font(.hiveBody(14))
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await lock.authenticate() }
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        if lock.isAuthenticating { ProgressView().tint(.white) }
                        Text("Unlock with \(lock.biometryLabel)")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(HivePrimaryButtonStyle())
                .disabled(lock.isAuthenticating)
                .padding(.horizontal, Theme.Spacing.xxl)
            }
            .padding(Theme.Spacing.xl)
        }
        .task {
            // First attempt fires automatically when the gate appears (cold launch or
            // return-from-background past the timeout).
            if lock.isLocked { await lock.authenticate() }
        }
    }
}

/// Opaque cover shown whenever the scene leaves the active state, so the app-switcher
/// snapshot never exposes balances. Opaque (not a blur) guarantees nothing leaks.
struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Theme.base
            VStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 36, weight: .light))
                    .foregroundStyle(Theme.honeyBright)
                Text("HIVE")
                    .font(.hiveBody(18, weight: .semibold))
                    .foregroundStyle(Theme.inkPrimary)
            }
        }
        .ignoresSafeArea()
    }
}
