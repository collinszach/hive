import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmt(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function fmtExact(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(yyyyMm: string): string {
  const [year, mo] = yyyyMm.split("-").map(Number);
  return new Date(year, mo - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "bg-orange-100 text-orange-800",
  "Groceries": "bg-green-100 text-green-800",
  "Travel": "bg-blue-100 text-blue-800",
  "Transportation": "bg-yellow-100 text-yellow-800",
  "Entertainment": "bg-purple-100 text-purple-800",
  "Shopping": "bg-pink-100 text-pink-800",
  "Health": "bg-red-100 text-red-800",
  "Utilities": "bg-gray-100 text-gray-700",
  "Home": "bg-teal-100 text-teal-800",
  "Education": "bg-indigo-100 text-indigo-800",
  "Transfers": "bg-gray-100 text-gray-400",
  "Uncategorized": "bg-gray-100 text-gray-500",
};

export const ALL_CATEGORIES = [
  "Food & Drink",
  "Groceries",
  "Travel",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Health",
  "Utilities",
  "Home",
  "Education",
  "Personal Care",
  "Business",
  "Transfers",
  "Uncategorized",
];

export const SUBCATEGORIES: Record<string, string[]> = {
  "Food & Drink": ["Restaurant", "Fast Food", "Coffee", "Delivery", "Bar"],
  "Groceries": ["In-Store", "Online"],
  "Travel": ["Flights", "SW Flights", "Hotel", "Car Rental", "Rideshare", "Cruise"],
  "Transportation": ["Gas", "EV Charging", "Parking", "Tolls", "Transit", "Auto Service"],
  "Entertainment": ["Streaming", "Movies", "Events", "Gaming", "Sports"],
  "Shopping": ["General", "Clothing", "Electronics", "Amazon", "Home Goods"],
  "Health": ["Medical", "Pharmacy", "Gym", "Dental", "Vision"],
  "Utilities": ["Electric", "Internet", "Phone", "Water", "Insurance"],
  "Home": ["Rent", "Mortgage", "Furniture", "Repairs", "Garden"],
  "Education": ["Tuition", "Books", "Courses"],
  "Personal Care": ["Haircut", "Spa", "Clothing"],
  "Transfers": ["P2P", "Payment", "Refund"],
  "Business": ["Office", "Software", "Advertising"],
  "Uncategorized": ["Uncategorized"],
};

// Canonical card-slug → display name. Single source of truth for every component
// that renders a card name (previously duplicated inline in several places).
export const CARD_NAMES: Record<string, string> = {
  amex_gold: "Amex Gold",
  chase_sapphire: "Chase Sapphire",
  chase_southwest: "Chase Southwest",
  bilt_blue: "Bilt Blue",
  venture_x: "Venture X",
};

/** Display name for a card slug, falling back to a humanized slug. */
export function cardName(slug: string | null | undefined): string {
  if (!slug) return "";
  return CARD_NAMES[slug] ?? slug.replace(/_/g, " ");
}

