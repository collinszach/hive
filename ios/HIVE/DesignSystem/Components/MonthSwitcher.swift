import SwiftUI

/// Compact month navigator: ‹ June › . Forward is capped at the current calendar
/// month (you can't browse the future). Used by Money, Plan, and Home so a fresh
/// month never strands the user on an empty screen — they can step back to data.
struct MonthSwitcher: View {
    @Binding var month: String
    /// Called after the month changes so the owner can re-query.
    var onChange: () -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            stepButton(system: "chevron.left", disabled: false, label: "Previous month") {
                month = MonthHelper.previous(month)
                Haptics.selection()
                onChange()
            }

            Text(MonthHelper.compactLabel(month))
                .font(.hiveBody(15, weight: .semibold))
                .foregroundStyle(Theme.inkPrimary)
                .frame(minWidth: 120)
                .contentTransition(.numericText())

            let atCurrent = MonthHelper.isCurrent(month)
            stepButton(system: "chevron.right", disabled: atCurrent, label: "Next month") {
                month = MonthHelper.next(month)
                Haptics.selection()
                onChange()
            }
        }
        .frame(maxWidth: .infinity)
        .animation(.easeOut(duration: 0.2), value: month)
    }

    private func stepButton(system: String, disabled: Bool, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(disabled ? Theme.inkGhost : Theme.blue)
                .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(label)
    }
}
