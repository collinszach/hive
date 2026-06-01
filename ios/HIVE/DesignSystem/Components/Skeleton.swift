import SwiftUI

/// A shimmering placeholder block. Compose these into a layout that mirrors the
/// real content so the screen doesn't jump when data lands. Respects reduced motion.
struct SkeletonBlock: View {
    var height: CGFloat = 16
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = 6

    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Theme.elevated)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .overlay {
                if !reduceMotion {
                    GeometryReader { geo in
                        LinearGradient(
                            colors: [.clear, Color.white.opacity(0.06), .clear],
                            startPoint: .leading, endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width * 1.6)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                }
            }
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
            .accessibilityHidden(true)
    }
}

/// A skeleton shaped like a standard card row (icon-ish block + two text lines).
struct SkeletonCardRow: View {
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                SkeletonBlock(height: 12, width: 90)
                SkeletonBlock(height: 22, width: 160)
                SkeletonBlock(height: 12)
            }
        }
    }
}

/// A vertical stack of `count` skeleton card rows — the common list-loading shape.
struct SkeletonList: View {
    var count: Int = 5
    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            ForEach(0..<count, id: \.self) { _ in SkeletonCardRow() }
        }
    }
}
