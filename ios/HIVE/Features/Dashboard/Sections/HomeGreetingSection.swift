import SwiftUI

/// Home · Greeting + quick actions (Epic H7). A time-of-day greeting and a row of
/// quick actions — Add transaction · Optimize card. (Search lives in the nav bar.)
/// The actions are closures so this view stays free of sheet state, which `DashboardView`
/// owns. See `docs/ios/HOME-SCREEN-SPEC.md`.
struct HomeGreetingSection: View {
    var onAdd: () -> Void
    var onOptimize: () -> Void

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default:      return "Welcome back"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(greeting)
                .font(.hiveBody(22, weight: .semibold))
                .foregroundStyle(Theme.inkPrimary)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: Theme.Spacing.sm) {
                quickAction(icon: "plus", label: "Add", action: onAdd)
                quickAction(icon: "creditcard", label: "Optimize", action: onOptimize)
                Spacer(minLength: 0)
            }
        }
        .padding(.leading, Theme.Spacing.xs)
    }

    private func quickAction(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection(); action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(label).font(.hiveBody(13, weight: .medium))
            }
            .foregroundStyle(Theme.inkPrimary)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .background(Theme.surface, in: Capsule())
            .overlay(Capsule().stroke(Theme.borderDefault, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
