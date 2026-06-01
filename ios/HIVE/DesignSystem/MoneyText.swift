import SwiftUI

/// The single source of truth for rendering money on screen.
///
/// Money is `Decimal` end-to-end — never `Double` — and always rendered in the
/// monospaced face with tabular figures so columns align. Sign coloring uses the
/// income/expense semantic tokens, never honey (which is rewards-only).
struct MoneyText: View {
    let amount: Decimal
    var size: CGFloat = 17
    var weight: Font.Weight = .medium
    /// When true, positive shows green / negative shows red. When false, neutral ink.
    var signed: Bool = false
    var currencyCode: String = "USD"

    var body: some View {
        Text(formatted)
            .font(.hiveMono(size, weight: weight))
            .monospacedDigit()
            .foregroundStyle(color)
    }

    private var color: Color {
        guard signed else { return Theme.inkPrimary }
        if amount > 0 { return Theme.income }
        if amount < 0 { return Theme.expense }
        return Theme.inkSecondary
    }

    private var formatted: String {
        let style = Decimal.FormatStyle.Currency(code: currencyCode)
            .precision(.fractionLength(2))
        // Show an explicit leading + for positive signed amounts (inflow clarity).
        if signed && amount > 0 {
            return "+" + amount.formatted(style)
        }
        return amount.formatted(style)
    }
}

/// The dominant number on a screen. Renders the whole-dollar part large and the
/// cents smaller + dimmer, so a single value can anchor the composition without a
/// wall of equal-weight digits. Tabular mono throughout. `Decimal` end-to-end.
struct MoneyHero: View {
    let amount: Decimal
    var size: CGFloat = 44
    var currencyCode: String = "USD"

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 1) {
            Text(wholePart)
                .font(.hiveMono(size, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.inkPrimary)
            Text(fractionPart)
                .font(.hiveMono(size * 0.5, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.inkSecondary)
                .baselineOffset(size * 0.06)
        }
    }

    // "$1,234" + ".56" — split on the locale decimal separator after formatting.
    private var formatted: String {
        amount.formatted(.currency(code: currencyCode).precision(.fractionLength(2)))
    }
    private var separator: String {
        Locale.current.decimalSeparator ?? "."
    }
    private var wholePart: String {
        guard let r = formatted.range(of: separator) else { return formatted }
        return String(formatted[..<r.lowerBound])
    }
    private var fractionPart: String {
        guard let r = formatted.range(of: separator) else { return "" }
        return separator + String(formatted[r.upperBound...])
    }
}

/// Integer points / miles. Never fractional. Honey coloring is appropriate here
/// because points ARE the reward context.
struct PointsText: View {
    let points: Int
    var size: CGFloat = 17
    var weight: Font.Weight = .medium
    var tinted: Bool = true

    var body: some View {
        Text(points.formatted(.number.grouping(.automatic)))
            .font(.hiveMono(size, weight: weight))
            .monospacedDigit()
            .foregroundStyle(tinted ? Theme.honeyBright : Theme.inkPrimary)
    }
}
