import Foundation

/// Parsing + display for the bare `YYYY-MM-DD` date strings the backend returns.
/// (The `APIClient` JSON decoder is `.iso8601`, which rejects date-only strings, so
/// money/date DTOs keep these as `String` and format them here.)
enum DateOnly {
    /// Fixed-format parser — locale/timezone independent so a date never shifts a day.
    private static let parser: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parse(_ string: String) -> Date? {
        parser.date(from: String(string.prefix(10)))
    }

    /// "yyyy-MM-dd" string for a `Date` — the wire format for date-only API fields.
    static func string(from date: Date) -> String {
        parser.string(from: date)
    }

    /// "Today", "Yesterday", else "Mon, Jun 1".
    static func relativeLabel(_ string: String) -> String {
        guard let date = parse(string) else { return string }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        let f = DateFormatter()
        f.dateFormat = cal.isDate(date, equalTo: Date(), toGranularity: .year)
            ? "EEE, MMM d" : "MMM d, yyyy"
        return f.string(from: date)
    }

    /// "Jun 1" short label for a row.
    static func shortLabel(_ string: String) -> String {
        guard let date = parse(string) else { return string }
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return f.string(from: date)
    }

    nonisolated(unsafe) private static let isoParser = ISO8601DateFormatter()

    /// Relative phrasing for a full ISO-8601 *timestamp* (e.g. last-sync time):
    /// "just now", "5m ago", "3h ago", else a short date.
    static func syncLabel(_ string: String) -> String {
        guard let date = isoParser.date(from: string)
            ?? ISO8601DateFormatter.withFractional.date(from: string) else { return "recently" }
        let secs = Date().timeIntervalSince(date)
        switch secs {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(secs / 60))m ago"
        case ..<86_400: return "\(Int(secs / 3600))h ago"
        case ..<604_800: return "\(Int(secs / 86_400))d ago"
        default:
            let f = DateFormatter(); f.dateFormat = "MMM d"
            return f.string(from: date)
        }
    }
}

private extension ISO8601DateFormatter {
    /// Backend timestamps sometimes include fractional seconds.
    nonisolated(unsafe) static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}

enum MonthHelper {
    /// Current month as "YYYY-MM".
    static var current: String {
        let c = Calendar.current.dateComponents([.year, .month], from: Date())
        return String(format: "%04d-%02d", c.year ?? 2026, c.month ?? 1)
    }

    /// Parse "YYYY-MM" into (year, month); nil if malformed.
    private static func components(_ month: String) -> (Int, Int)? {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]),
              (1...12).contains(m) else { return nil }
        return (y, m)
    }

    /// "2026-06" → "2026-05".
    static func previous(_ month: String) -> String {
        guard let (y, m) = components(month) else { return month }
        return m == 1 ? String(format: "%04d-12", y - 1) : String(format: "%04d-%02d", y, m - 1)
    }

    /// "2026-06" → "2026-07".
    static func next(_ month: String) -> String {
        guard let (y, m) = components(month) else { return month }
        return m == 12 ? String(format: "%04d-01", y + 1) : String(format: "%04d-%02d", y, m + 1)
    }

    /// True when `month` is the current calendar month (used to cap forward nav).
    static func isCurrent(_ month: String) -> Bool { month == current }

    /// Compact label that drops the year when it's the current year: "May" vs "May 2025".
    static func compactLabel(_ month: String) -> String {
        guard let (y, m) = components(month) else { return month }
        let nowYear = Calendar.current.component(.year, from: Date())
        var comps = DateComponents(); comps.year = y; comps.month = m
        let date = Calendar.current.date(from: comps) ?? Date()
        return y == nowYear
            ? date.formatted(.dateTime.month(.wide))
            : date.formatted(.dateTime.month(.wide).year())
    }

    /// "2026-06" → "June 2026".
    static func longLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]),
              (1...12).contains(m) else { return month }
        var comps = DateComponents(); comps.year = y; comps.month = m
        let date = Calendar.current.date(from: comps) ?? Date()
        return date.formatted(.dateTime.month(.wide).year())
    }
}

/// card_slug → human card name, sourced from `CLAUDE.md` accounts table.
enum CardCatalog {
    static let names: [String: String] = [
        "amex_gold": "Amex Gold",
        "chase_sapphire": "Chase Sapphire Preferred",
        "chase_southwest": "Chase Southwest Plus",
        "bilt_blue": "Bilt Blue",
        "venture_x": "Capital One Venture X",
    ]
    static func name(_ slug: String?) -> String {
        guard let slug else { return "" }
        return names[slug] ?? slug.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
