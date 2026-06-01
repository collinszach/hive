import SwiftUI

/// HIVE motion language. One rule: motion communicates a state change — where a
/// thing came from, what just happened — never decoration.
///
/// Curves are the SwiftUI port of the web tokens used across the design system:
///  - entry  → exponential ease-out `cubic-bezier(0.16, 1, 0.3, 1)` (arrives, decelerates)
///  - exit   → exponential ease-in  `cubic-bezier(0.7, 0, 0.84, 0)`  (leaves, accelerates)
///  - toggle → ease-in-out          `cubic-bezier(0.65, 0, 0.35, 1)`
///
/// Durations follow the 100 / 300 / 500 rule (micro / standard / orchestration).
enum Motion {
    static let micro: Double = 0.10
    static let standard: Double = 0.30
    static let orchestration: Double = 0.50

    /// Stagger increment between siblings in a reveal (50–80ms band).
    static let stagger: Double = 0.06

    static let entry = Animation.timingCurve(0.16, 1, 0.3, 1, duration: standard)
    static let exit = Animation.timingCurve(0.7, 0, 0.84, 0, duration: standard)
    static let toggle = Animation.timingCurve(0.65, 0, 0.35, 1, duration: standard)
    static let press = Animation.timingCurve(0.16, 1, 0.3, 1, duration: micro)
}

/// Staggered fade + translate-up entrance. Index drives the cascade so the eye is
/// guided down the screen in reading order. Respects Reduce Motion (snaps in).
private struct EntranceModifier: ViewModifier {
    let index: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 14)
            .onAppear {
                guard !shown else { return }
                if reduceMotion {
                    shown = true
                } else {
                    withAnimation(Motion.entry.delay(Double(index) * Motion.stagger)) {
                        shown = true
                    }
                }
            }
    }
}

extension View {
    /// Reveal this element with the HIVE staggered entrance. `index` orders the cascade.
    func hiveEntrance(_ index: Int = 0) -> some View {
        modifier(EntranceModifier(index: index))
    }
}
