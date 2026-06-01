import SwiftUI

/// HIVE typography. Body = Plus Jakarta Sans; all figures/amounts/dates render in a
/// monospaced face with **tabular figures** so columns of money align.
///
/// Bundled fonts (added in Resources/Fonts and registered via Info.plist
/// `UIAppFonts`): PlusJakartaSans + GeistMono. `Font.custom(_:size:)` falls back to
/// the system font automatically when a named face isn't bundled yet, so the build
/// and layout are correct before the .ttf files are dropped in; swapping in the real
/// faces is then purely cosmetic. Until the faces ship we render the system fonts so
/// the mono path still gets a true monospaced design.
enum HIVEFont {
    // Flip to true once the .ttf files are bundled + registered in Info.plist.
    static let useBundledFaces = false

    // PostScript family names for the bundled faces.
    static let bodyFamily = "PlusJakartaSans-Regular"
    static let bodyMediumFamily = "PlusJakartaSans-Medium"
    static let bodySemiboldFamily = "PlusJakartaSans-SemiBold"
    static let monoFamily = "GeistMono-Regular"
    static let monoMediumFamily = "GeistMono-Medium"
}

extension Font {
    /// Body text. Fixed scale (product UI at consistent DPI) but `relativeTo`
    /// keeps Dynamic Type working.
    static func hiveBody(_ size: CGFloat, weight: Font.Weight = .regular,
                         relativeTo textStyle: Font.TextStyle = .body) -> Font {
        guard HIVEFont.useBundledFaces else {
            return .system(size: size, weight: weight, design: .default)
        }
        let name: String
        switch weight {
        case .semibold, .bold: name = HIVEFont.bodySemiboldFamily
        case .medium: name = HIVEFont.bodyMediumFamily
        default: name = HIVEFont.bodyFamily
        }
        return .custom(name, size: size, relativeTo: textStyle)
    }

    /// Monospaced — use for ALL money, points, and dates. Carries tabular figures.
    static func hiveMono(_ size: CGFloat, weight: Font.Weight = .regular,
                         relativeTo textStyle: Font.TextStyle = .body) -> Font {
        guard HIVEFont.useBundledFaces else {
            return .system(size: size, weight: weight, design: .monospaced)
        }
        let name = (weight == .regular) ? HIVEFont.monoFamily : HIVEFont.monoMediumFamily
        return .custom(name, size: size, relativeTo: textStyle)
    }
}

extension View {
    /// Uppercase tracked micro-label (`.hive-label` in the web app).
    func hiveLabelStyle() -> some View {
        self.font(.hiveBody(11, weight: .semibold))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(Theme.inkTertiary)
    }
}
