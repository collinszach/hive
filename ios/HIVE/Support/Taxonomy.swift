import Foundation

/// The transaction category → subcategory taxonomy, mirrored from `CLAUDE.md`.
/// Drives the native categorize picker so the user never types a free-form category
/// (keeps the rules/points engine matching on known values).
enum Taxonomy {
    static let map: [(category: String, subcategories: [String])] = [
        ("Food & Drink",   ["Restaurant", "Fast Food", "Coffee", "Delivery", "Bar", "Groceries"]),
        ("Groceries",      ["In-Store", "Online"]),
        ("Travel",         ["Flights", "SW Flights", "Hotel", "Car Rental", "Rideshare", "Cruise"]),
        ("Transportation", ["Gas", "EV Charging", "Parking", "Tolls", "Transit", "Auto Service"]),
        ("Entertainment",  ["Streaming", "Movies", "Events", "Gaming", "Sports"]),
        ("Shopping",       ["General", "Clothing", "Electronics", "Amazon", "Home Goods"]),
        ("Health",         ["Medical", "Pharmacy", "Gym", "Dental", "Vision"]),
        ("Utilities",      ["Electric", "Internet", "Phone", "Water", "Insurance"]),
        ("Home",           ["Rent", "Mortgage", "Furniture", "Repairs", "Garden"]),
        ("Education",      ["Tuition", "Books", "Courses"]),
        ("Personal Care",  ["Haircut", "Spa", "Clothing"]),
        ("Transfers",      ["P2P", "Payment", "Refund"]),
        ("Business",       ["Office", "Software", "Advertising"]),
        ("Uncategorized",  []),
    ]

    static var categories: [String] { map.map(\.category) }

    static func subcategories(for category: String) -> [String] {
        map.first { $0.category == category }?.subcategories ?? []
    }

    /// SF Symbol per category — a quiet glyph, never color-coded (color stays semantic).
    static func icon(for category: String?) -> String {
        switch category {
        case "Food & Drink":   return "fork.knife"
        case "Groceries":      return "cart"
        case "Travel":         return "airplane"
        case "Transportation": return "car"
        case "Entertainment":  return "play.tv"
        case "Shopping":       return "bag"
        case "Health":         return "cross.case"
        case "Utilities":      return "bolt"
        case "Home":           return "house"
        case "Education":      return "book"
        case "Personal Care":  return "scissors"
        case "Transfers":      return "arrow.left.arrow.right"
        case "Business":       return "briefcase"
        default:               return "questionmark.circle"
        }
    }
}
