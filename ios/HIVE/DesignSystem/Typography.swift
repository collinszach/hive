import SwiftUI
import UIKit

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
    /// Body text. Fixed scale (product UI at consistent DPI) but kept Dynamic-Type
    /// responsive: the bundled-face path uses `relativeTo`; the system fallback scales
    /// the point size through `UIFontMetrics` so text still grows with the user's
    /// preferred content size even before the .ttf faces ship.
    static func hiveBody(_ size: CGFloat, weight: Font.Weight = .regular,
                         relativeTo textStyle: Font.TextStyle = .body) -> Font {
        guard HIVEFont.useBundledFaces else {
            return .system(size: HIVEFont.scaled(size, textStyle), weight: weight, design: .default)
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
            return .system(size: HIVEFont.scaled(size, textStyle), weight: weight, design: .monospaced)
        }
        let name = (weight == .regular) ? HIVEFont.monoFamily : HIVEFont.monoMediumFamily
        return .custom(name, size: size, relativeTo: textStyle)
    }
}

extension HIVEFont {
    /// Scale a fixed design point size for the current Dynamic Type setting, anchored
    /// to the matching text style. Used by the system-font fallback so accessibility
    /// text sizes are honored before the bundled faces (which use SwiftUI `relativeTo`)
    /// are enabled. Evaluated during SwiftUI body eval, so `UITraitCollection.current`
    /// reflects the active environment.
    static func scaled(_ size: CGFloat, _ textStyle: Font.TextStyle) -> CGFloat {
        UIFontMetrics(forTextStyle: uiTextStyle(textStyle)).scaledValue(for: size)
    }

    private static func uiTextStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
        switch style {
        case .largeTitle: return .largeTitle
        case .title: return .title1
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .subheadline: return .subheadline
        case .callout: return .callout
        case .footnote: return .footnote
        case .caption: return .caption1
        case .caption2: return .caption2
        case .body: return .body
        @unknown default: return .body
        }
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
