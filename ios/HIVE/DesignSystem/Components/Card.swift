import SwiftUI

/// Standard surface card: `surface` fill, hairline border, 12pt radius. The
/// workhorse container that every list row / metric block sits in.
struct Card<Content: View>: View {
    var padding: CGFloat = Theme.Spacing.lg
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                    .stroke(Theme.borderDefault, lineWidth: 1)
            )
    }
}

/// A single surface holding a vertical list of rows separated by hairline dividers
/// — not N free-floating cards. Applies Tufte's 1+1=3: white space + one inset rule
/// does the separating work, so related rows read as one group (Ch. 7). Use for
/// accounts, settings lists, any homogeneous row collection.
struct GroupedCard<Data: RandomAccessCollection, Row: View>: View where Data.Element: Identifiable {
    let data: Data
    var rowPadding: CGFloat = Theme.Spacing.md
    @ViewBuilder var row: (Data.Element) -> Row

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(data.enumerated()), id: \.element.id) { index, element in
                if index > 0 {
                    Rectangle()
                        .fill(Theme.borderSubtle)
                        .frame(height: 1)
                        .padding(.leading, rowPadding)
                }
                row(element)
                    .padding(.horizontal, rowPadding)
                    .padding(.vertical, rowPadding)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                .stroke(Theme.borderDefault, lineWidth: 1)
        )
    }
}

extension View {
    /// Soft, hue-shifted depth — lifts a surface off the OLED base. Use sparingly,
    /// on the dominant element only, so depth signals importance (Ch. 6).
    func hiveCardShadow() -> some View {
        shadow(color: Theme.shadow, radius: 18, x: 0, y: 8)
    }
}

/// Rewards card variant — honey-tinted border/fill. Use ONLY for points/earn surfaces.
struct RewardsCard<Content: View>: View {
    var padding: CGFloat = Theme.Spacing.lg
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.honeyDim)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.card, style: .continuous)
                    .stroke(Theme.honeyBorder, lineWidth: 1)
            )
    }
}
