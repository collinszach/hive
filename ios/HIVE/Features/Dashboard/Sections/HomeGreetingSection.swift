import SwiftUI

/// Home · Greeting. A time-of-day greeting above the hero. **Epic H7** extends this with a
/// quick-action row (Add transaction · Optimize card · Search). Search is wired via the
/// binding from `DashboardView`; Add/Optimize are the H7 follow-up.
struct HomeGreetingSection: View {
    @Binding var showSearch: Bool

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default:      return "Welcome back"
        }
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(greeting)
                .font(.hiveBody(22, weight: .semibold))
                .foregroundStyle(Theme.inkPrimary)
            Spacer()
        }
        .padding(.leading, Theme.Spacing.xs)
        .accessibilityAddTraits(.isHeader)
    }
}
