import SwiftUI

/// Shared helpers for Home sections. Keeps the section contract (`docs/ios/HOME-SCREEN-SPEC.md`)
/// consistent without a base class — SwiftUI views compose better than they inherit.

extension APIError {
    /// True when this failure means the session is gone and Home should bounce to sign-in.
    var isAuthExpiry: Bool {
        switch self {
        case .unauthorized, .notAuthenticated: return true
        default: return false
        }
    }
}

extension LoadState {
    /// Fire `onAuthExpired` when the section failed due to an expired/absent session, so the
    /// single global sign-out path still runs from any section.
    func reportAuthExpiry(_ onAuthExpired: () -> Void) {
        if case .failed(let error) = self, error.isAuthExpiry { onAuthExpired() }
    }
}

/// A small reusable header for Home sections: a label and an optional trailing "see all"
/// chevron-style affordance. Sections may use it or roll their own.
struct HomeSectionHeader: View {
    let title: String
    var trailing: AnyView? = nil

    var body: some View {
        HStack {
            Text(title).hiveLabelStyle()
            Spacer()
            if let trailing { trailing }
        }
        .padding(.leading, Theme.Spacing.xs)
    }
}
