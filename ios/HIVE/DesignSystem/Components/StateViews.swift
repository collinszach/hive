import SwiftUI

/// Purposeful empty state — icon, title, optional message, optional CTA. Centered.
struct EmptyStateView: View {
    var icon: String = "tray"
    let title: String
    var message: String = ""
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.inkTertiary)
            Text(title)
                .font(.hiveBody(17, weight: .semibold))
                .foregroundStyle(Theme.inkPrimary)
            if !message.isEmpty {
                Text(message)
                    .font(.hiveBody(14))
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(HivePrimaryButtonStyle())
                    .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Error state — safe message + retry (when the failure is retryable).
struct ErrorStateView: View {
    let error: APIError
    var onRetry: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.warning)
            Text(error.userMessage)
                .font(.hiveBody(15))
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
            if let onRetry {
                Button("Try again", action: onRetry)
                    .buttonStyle(HivePrimaryButtonStyle())
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Primary button style: blue fill, 44pt min target, press scale + haptic.
struct HivePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.hiveBody(16, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Spacing.lg)
            .frame(minHeight: Theme.minTouchTarget)
            .background(Theme.blue)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Secondary button style: hairline-outlined, tinted label on the surface. Reads as
/// a quiet alternative to the blue primary; `.tint(...)` overrides the label color.
struct HiveSecondaryButtonStyle: ButtonStyle {
    @Environment(\.tintColor) private var tint

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.hiveBody(15, weight: .medium))
            .foregroundStyle(tint)
            .padding(.horizontal, Theme.Spacing.md)
            .frame(minHeight: Theme.minTouchTarget)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.control, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// A tint value the secondary button style can read (SwiftUI's `.tint` doesn't
/// propagate into a custom `ButtonStyle` label color), defaulting to HIVE blue.
private struct TintColorKey: EnvironmentKey {
    static let defaultValue: Color = Theme.blue
}
extension EnvironmentValues {
    var tintColor: Color {
        get { self[TintColorKey.self] }
        set { self[TintColorKey.self] = newValue }
    }
}
