import SwiftUI

/// HIVE color + geometry tokens, ported verbatim from `frontend/src/app/globals.css`.
///
/// Register: OLED-dark, product (not brand/marketing). Identity is carried by the
/// accent, typography, and data density — never by decoration.
///
/// Two hard rules encoded here:
///  - **blue is the only interactive accent** (links, CTAs, selection).
///  - **honey/gold is REWARDS-ONLY** — points and earn surfaces, never a generic accent.
enum Theme {

    // MARK: Surfaces (OLED dark)
    static let base     = Color(hex: 0x13151A) // app background
    static let surface  = Color(hex: 0x1A1D24) // cards
    static let elevated = Color(hex: 0x1F2229) // raised cards / sheets
    static let overlay  = Color(hex: 0x252830) // popovers / overlays

    // MARK: Interactive (blue — the ONLY generic accent)
    static let blue      = Color(hex: 0x3B82F6)
    static let blueHover = Color(hex: 0x2563EB)
    static let blueDim    = Color(hex: 0x3B82F6, alpha: 0.08)
    static let blueBorder = Color(hex: 0x3B82F6, alpha: 0.20)

    // MARK: Rewards (honey/gold — REWARDS CONTEXT ONLY)
    static let honey       = Color(hex: 0xC9920E)
    static let honeyBright = Color(hex: 0xF5B942)
    static let honeyDim    = Color(hex: 0xF5B942, alpha: 0.08)
    static let honeyBorder = Color(hex: 0xF5B942, alpha: 0.18)

    // MARK: Text ramp
    static let inkPrimary   = Color(hex: 0xF0F2F5) // primary text
    static let inkSecondary = Color(hex: 0x9CA3AF) // secondary / small body
    static let inkTertiary  = Color(hex: 0x6B7280) // large/secondary labels only — fails 4.5:1 as body on surface
    static let inkGhost     = Color(hex: 0x4B5563) // disabled / placeholder ONLY, never informational

    // MARK: Semantic
    static let income  = Color(hex: 0x22C55E) // positive / inflow
    static let expense = Color(hex: 0xEF4444) // negative / outflow
    static let warning = Color(hex: 0xF59E0B)
    static let info    = Color(hex: 0x3B82F6)

    // MARK: Borders
    static let borderDefault = Color(hex: 0x2A2D35)
    static let borderSubtle  = Color(hex: 0x22252E)
    static let borderStrong  = Color(hex: 0x3A3E4A)

    // MARK: Depth
    /// Shadow is hue-shifted toward the cool surface — never pure black — so layers
    /// read as depth, not as a hard drop-shadow cutout (Ch. 9 hue-shifted shadows).
    static let shadow = Color(hex: 0x05070C, alpha: 0.55)

    /// A whisper-thin top-edge wash that lifts a hero surface off the OLED base,
    /// giving foreground/background depth without a glow blob (Ch. 6 depth).
    static var heroLift: LinearGradient {
        LinearGradient(
            colors: [Color(hex: 0x3B82F6, alpha: 0.06), .clear],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    // MARK: Geometry
    enum Radius {
        static let card: CGFloat = 12
        static let control: CGFloat = 10
        static let pill: CGFloat = 999
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    /// Minimum interactive target (Apple HIG + audit rule).
    static let minTouchTarget: CGFloat = 44
}

extension Color {
    /// Construct from a 0xRRGGBB hex literal with optional alpha.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
