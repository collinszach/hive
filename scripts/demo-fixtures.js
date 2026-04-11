// scripts/demo-fixtures.js
// All mock API responses for the Hive demo screenshot persona: "Alex Rivera"
// Dates are relative to April 2026 (current month = 2026-04, prev month = 2026-03)

// ─── Auth ────────────────────────────────────────────────────────────────────

const AUTH_ME = { id: "demo-1", email: "alex@example.com", name: "Alex Rivera" };

// ─── Accounts ────────────────────────────────────────────────────────────────

const ACCOUNTS = [
  {
    id: "acc-1", name: "Amex Gold Card", official_name: "American Express Gold Card",
    institution: "American Express", type: "credit", subtype: "credit card",
    card_slug: "amex_gold", current_balance: 1240.55, available_balance: null,
    credit_limit: 15000, currency: "USD", mask: "4821", is_manual: false,
    is_active: true, is_excluded: false,
  },
  {
    id: "acc-2", name: "Chase Sapphire Preferred", official_name: "Chase Sapphire Preferred Card",
    institution: "Chase", type: "credit", subtype: "credit card",
    card_slug: "chase_sapphire", current_balance: 876.22, available_balance: null,
    credit_limit: 12000, currency: "USD", mask: "3947", is_manual: false,
    is_active: true, is_excluded: false,
  },
  {
    id: "acc-3", name: "Capital One Venture X", official_name: "Capital One Venture X Rewards",
    institution: "Capital One", type: "credit", subtype: "credit card",
    card_slug: "venture_x", current_balance: 412.88, available_balance: null,
    credit_limit: 20000, currency: "USD", mask: "7261", is_manual: false,
    is_active: true, is_excluded: false,
  },
  {
    id: "acc-4", name: "Bilt Blue", official_name: "Bilt Mastercard",
    institution: "Bilt", type: "credit", subtype: "credit card",
    card_slug: "bilt_blue", current_balance: 158.40, available_balance: null,
    credit_limit: 8000, currency: "USD", mask: "5512", is_manual: false,
    is_active: true, is_excluded: false,
  },
  {
    id: "acc-5", name: "Checking Account", official_name: "Chase Total Checking",
    institution: "Chase", type: "depository", subtype: "checking",
    card_slug: null, current_balance: 4218.73, available_balance: 4218.73,
    credit_limit: null, currency: "USD", mask: "0091", is_manual: false,
    is_active: true, is_excluded: false,
  },
  {
    id: "acc-6", name: "High-Yield Savings", official_name: "Marcus Online Savings",
    institution: "Marcus by Goldman Sachs", type: "depository", subtype: "savings",
    card_slug: null, current_balance: 18540.00, available_balance: 18540.00,
    credit_limit: null, currency: "USD", mask: "2244", is_manual: false,
    is_active: true, is_excluded: true,
  },
];

// ─── Budgets ─────────────────────────────────────────────────────────────────

const BUDGETS = [
  { id: "b1", category: "Food & Drink",   month: "2026-03", budget_amount: 600,  actual_spend: 487.22, pct_used: 81.2,  remaining: 112.78, has_budget: true },
  { id: "b2", category: "Groceries",      month: "2026-03", budget_amount: 400,  actual_spend: 318.55, pct_used: 79.6,  remaining: 81.45,  has_budget: true },
  { id: "b3", category: "Transportation", month: "2026-03", budget_amount: 200,  actual_spend: 94.80,  pct_used: 47.4,  remaining: 105.20, has_budget: true },
  { id: "b4", category: "Entertainment",  month: "2026-03", budget_amount: 150,  actual_spend: 178.90, pct_used: 119.3, remaining: -28.90, has_budget: true },
  { id: "b5", category: "Shopping",       month: "2026-03", budget_amount: 300,  actual_spend: 241.67, pct_used: 80.6,  remaining: 58.33,  has_budget: true },
  { id: "b6", category: "Health",         month: "2026-03", budget_amount: 120,  actual_spend: 45.00,  pct_used: 37.5,  remaining: 75.00,  has_budget: true },
];

// ─── Points ──────────────────────────────────────────────────────────────────

const POINTS_SUMMARY = {
  programs: [
    { program: "Amex MR",           points_earned_90d: 8420,  manual_balance: 72000, estimated_value_dollars: 1440.00, redemption_threshold: 75000, above_threshold: false },
    { program: "Chase UR",          points_earned_90d: 5180,  manual_balance: 38500, estimated_value_dollars: 789.25,  redemption_threshold: 60000, above_threshold: false },
    { program: "Capital One Miles", points_earned_90d: 3940,  manual_balance: 12200, estimated_value_dollars: 225.70,  redemption_threshold: 75000, above_threshold: false },
    { program: "Bilt Points",       points_earned_90d: 1250,  manual_balance: 4800,  estimated_value_dollars: 100.80,  redemption_threshold: 50000, above_threshold: false },
  ],
  total_estimated_value_dollars: 2555.75,
};

const POINTS_LEDGER = [
  { transaction_id: "t1",  account_id: "acc-1", card_slug: "amex_gold",      program: "Amex MR",           points_earned: 420,  earn_rate: 4.0, category: "Food & Drink",    subcategory: "Restaurant", merchant: "Nobu Restaurant",    amount: 105.00, date: "2026-04-09" },
  { transaction_id: "t2",  account_id: "acc-1", card_slug: "amex_gold",      program: "Amex MR",           points_earned: 268,  earn_rate: 4.0, category: "Groceries",       subcategory: "In-Store",   merchant: "Whole Foods Market", amount: 67.00,  date: "2026-04-08" },
  { transaction_id: "t3",  account_id: "acc-2", card_slug: "chase_sapphire", program: "Chase UR",          points_earned: 315,  earn_rate: 3.0, category: "Food & Drink",    subcategory: "Restaurant", merchant: "Sweetgreen",         amount: 105.00, date: "2026-04-07" },
  { transaction_id: "t4",  account_id: "acc-3", card_slug: "venture_x",      program: "Capital One Miles", points_earned: 190,  earn_rate: 2.0, category: "Shopping",        subcategory: "Amazon",     merchant: "Amazon.com",         amount: 95.00,  date: "2026-04-06" },
  { transaction_id: "t5",  account_id: "acc-1", card_slug: "amex_gold",      program: "Amex MR",           points_earned: 960,  earn_rate: 3.0, category: "Travel",          subcategory: "Flights",    merchant: "Delta Air Lines",    amount: 320.00, date: "2026-04-05" },
  { transaction_id: "t6",  account_id: "acc-2", card_slug: "chase_sapphire", program: "Chase UR",          points_earned: 168,  earn_rate: 3.0, category: "Food & Drink",    subcategory: "Delivery",   merchant: "DoorDash",           amount: 56.00,  date: "2026-04-04" },
  { transaction_id: "t7",  account_id: "acc-1", card_slug: "amex_gold",      program: "Amex MR",           points_earned: 308,  earn_rate: 4.0, category: "Groceries",       subcategory: "In-Store",   merchant: "Trader Joe's",       amount: 77.00,  date: "2026-04-03" },
  { transaction_id: "t8",  account_id: "acc-3", card_slug: "venture_x",      program: "Capital One Miles", points_earned: 136,  earn_rate: 2.0, category: "Transportation",  subcategory: "Gas",        merchant: "Shell",              amount: 68.00,  date: "2026-04-02" },
];

const POINTS_LEAKAGE = {
  entries: [
    {
      transaction_id: "tl1", merchant: "Sweetgreen", date: "2026-04-07", amount: 105.00,
      category: "Food & Drink", subcategory: "Restaurant",
      actual_card_slug: "venture_x", actual_earn_rate: 2.0, actual_points: 210, actual_value_dollars: 3.89,
      best_card_slug: "amex_gold",   best_program: "Amex MR", best_earn_rate: 4.0, best_points: 420, best_value_dollars: 8.40,
      leakage_dollars: 4.51,
    },
    {
      transaction_id: "tl2", merchant: "Shell", date: "2026-04-02", amount: 68.00,
      category: "Transportation", subcategory: "Gas",
      actual_card_slug: "amex_gold", actual_earn_rate: 1.0, actual_points: 68, actual_value_dollars: 1.36,
      best_card_slug: "venture_x",   best_program: "Capital One Miles", best_earn_rate: 2.0, best_points: 136, best_value_dollars: 2.51,
      leakage_dollars: 1.15,
    },
  ],
  total_leakage_dollars: 5.66,
  transaction_count: 2,
  days: 90,
};

const POINTS_OPTIMIZE = {
  category: "Food & Drink", subcategory: "Restaurant", amount: 120.00,
  cards: [
    { card_slug: "amex_gold",      account_name: "Amex Gold Card",            program: "Amex MR",           earn_rate: 4.0, points_earned: 480, dollar_value: 9.60,  is_best: true  },
    { card_slug: "chase_sapphire", account_name: "Chase Sapphire Preferred",  program: "Chase UR",          earn_rate: 3.0, points_earned: 360, dollar_value: 7.38,  is_best: false },
    { card_slug: "bilt_blue",      account_name: "Bilt Blue",                 program: "Bilt Points",       earn_rate: 3.0, points_earned: 360, dollar_value: 7.56,  is_best: false },
    { card_slug: "venture_x",      account_name: "Capital One Venture X",     program: "Capital One Miles", earn_rate: 2.0, points_earned: 240, dollar_value: 4.44,  is_best: false },
  ],
};

// ─── Transactions ─────────────────────────────────────────────────────────────

const TX_ITEMS = [
  { id: "t1",  plaid_transaction_id: "plaid-t1",  account_id: "acc-1", account_name: "Amex Gold Card",            card_slug: "amex_gold",      date: "2026-04-09", amount: 105.00,  currency: "USD", merchant: "Nobu Restaurant",      raw_description: "NOBU RESTAURANT NYC",       category: "Food & Drink",    subcategory: "Restaurant", category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "New York",    location_state: "NY",  logo_url: null },
  { id: "t2",  plaid_transaction_id: "plaid-t2",  account_id: "acc-1", account_name: "Amex Gold Card",            card_slug: "amex_gold",      date: "2026-04-08", amount: 67.00,   currency: "USD", merchant: "Whole Foods Market",   raw_description: "WHOLE FOODS MKT #10285",    category: "Groceries",       subcategory: "In-Store",   category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "Brooklyn",    location_state: "NY",  logo_url: null },
  { id: "t3",  plaid_transaction_id: "plaid-t3",  account_id: "acc-2", account_name: "Chase Sapphire Preferred", card_slug: "chase_sapphire", date: "2026-04-07", amount: 105.00,  currency: "USD", merchant: "Sweetgreen",           raw_description: "SWEETGREEN MANHATTAN",      category: "Food & Drink",    subcategory: "Restaurant", category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "New York",    location_state: "NY",  logo_url: null },
  { id: "t4",  plaid_transaction_id: "plaid-t4",  account_id: "acc-3", account_name: "Capital One Venture X",    card_slug: "venture_x",      date: "2026-04-06", amount: 95.00,   currency: "USD", merchant: "Amazon.com",           raw_description: "AMAZON.COM*2X8J9",          category: "Shopping",        subcategory: "Amazon",     category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "online",    location_city: null,          location_state: null,  logo_url: null },
  { id: "t5",  plaid_transaction_id: "plaid-t5",  account_id: "acc-1", account_name: "Amex Gold Card",            card_slug: "amex_gold",      date: "2026-04-05", amount: 320.00,  currency: "USD", merchant: "Delta Air Lines",      raw_description: "DELTA AIR 0062748219",      category: "Travel",          subcategory: "Flights",    category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "online",    location_city: null,          location_state: null,  logo_url: null },
  { id: "t6",  plaid_transaction_id: "plaid-t6",  account_id: "acc-2", account_name: "Chase Sapphire Preferred", card_slug: "chase_sapphire", date: "2026-04-04", amount: 56.00,   currency: "USD", merchant: "DoorDash",             raw_description: "DOORDASH*CHIPOTLE",         category: "Food & Drink",    subcategory: "Delivery",   category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "online",    location_city: null,          location_state: null,  logo_url: null },
  { id: "t7",  plaid_transaction_id: "plaid-t7",  account_id: "acc-1", account_name: "Amex Gold Card",            card_slug: "amex_gold",      date: "2026-04-03", amount: 77.00,   currency: "USD", merchant: "Trader Joe's",         raw_description: "TRADER JOES #542",          category: "Groceries",       subcategory: "In-Store",   category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "Brooklyn",    location_state: "NY",  logo_url: null },
  { id: "t8",  plaid_transaction_id: "plaid-t8",  account_id: "acc-3", account_name: "Capital One Venture X",    card_slug: "venture_x",      date: "2026-04-02", amount: 68.00,   currency: "USD", merchant: "Shell",                raw_description: "SHELL OIL 574291004",       category: "Transportation",  subcategory: "Gas",        category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "Jersey City", location_state: "NJ",  logo_url: null },
  { id: "t9",  plaid_transaction_id: "plaid-t9",  account_id: "acc-2", account_name: "Chase Sapphire Preferred", card_slug: "chase_sapphire", date: "2026-04-01", amount: 1650.00, currency: "USD", merchant: "Rivington Management", raw_description: "RIVINGTON MGMT RENT APR",  category: "Home",            subcategory: "Rent",       category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "online",    location_city: null,          location_state: null,  logo_url: null },
  { id: "t10", plaid_transaction_id: "plaid-t10", account_id: "acc-4", account_name: "Bilt Blue",                card_slug: "bilt_blue",      date: "2026-03-31", amount: 14.99,   currency: "USD", merchant: "Netflix",              raw_description: "NETFLIX.COM",               category: "Entertainment",   subcategory: "Streaming",  category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "online",    location_city: null,          location_state: null,  logo_url: null },
  { id: "t11", plaid_transaction_id: "plaid-t11", account_id: "acc-1", account_name: "Amex Gold Card",            card_slug: "amex_gold",      date: "2026-03-29", amount: 42.50,   currency: "USD", merchant: "Starbucks",            raw_description: "STARBUCKS #18824",          category: "Food & Drink",    subcategory: "Coffee",     category_source: "rule",    is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "New York",    location_state: "NY",  logo_url: null },
  { id: "t12", plaid_transaction_id: "plaid-t12", account_id: "acc-2", account_name: "Chase Sapphire Preferred", card_slug: "chase_sapphire", date: "2026-03-28", amount: 210.00,  currency: "USD", merchant: "REI Co-op",            raw_description: "REI #88 MANHATTAN",         category: "Shopping",        subcategory: "General",    category_source: "ollama",  is_transfer: false, is_excluded: false, pending: false, payment_channel: "in store",  location_city: "New York",    location_state: "NY",  logo_url: null },
];

const TRANSACTIONS_RESPONSE = { items: TX_ITEMS, total: 48, page: 1, page_size: 20, pages: 3 };
const TRANSACTIONS_RECENT   = { items: TX_ITEMS.slice(0, 10), total: 48, page: 1, page_size: 10, pages: 5 };

const SPEND_BY_CATEGORY = [
  { category: "Home",           spend: 1650.00 },
  { category: "Food & Drink",   spend: 487.22  },
  { category: "Groceries",      spend: 318.55  },
  { category: "Shopping",       spend: 241.67  },
  { category: "Travel",         spend: 320.00  },
  { category: "Transportation", spend: 94.80   },
  { category: "Entertainment",  spend: 178.90  },
];

const TRANSACTION_CATEGORIES = [
  { category: "Food & Drink",   count: 14 },
  { category: "Groceries",      count: 8  },
  { category: "Home",           count: 1  },
  { category: "Shopping",       count: 5  },
  { category: "Travel",         count: 3  },
  { category: "Transportation", count: 4  },
  { category: "Entertainment",  count: 6  },
];

// ─── Insights ─────────────────────────────────────────────────────────────────

const INSIGHTS_RESPONSE = {
  insights: [
    {
      id: "ins-1", insight_type: "spending_spike", title: "Entertainment over budget",
      body: "You've spent $178.90 on Entertainment this month — 19% over your $150 budget. Consider pausing new subscriptions until next month.",
      amount: 178.90, delta_pct: 19.3, category: "Entertainment", linked_entity_type: null, linked_entity_id: null,
      priority: "high", is_read: false, is_dismissed: false, created_at: "2026-04-10T08:00:00Z",
    },
    {
      id: "ins-2", insight_type: "tip", title: "Use Amex Gold for groceries",
      body: "You used Venture X for 3 grocery trips last month, earning 2x points. Switching to Amex Gold would earn 4x — an extra ~$8 in value.",
      amount: null, delta_pct: null, category: "Groceries", linked_entity_type: null, linked_entity_id: null,
      priority: "medium", is_read: false, is_dismissed: false, created_at: "2026-04-09T08:00:00Z",
    },
    {
      id: "ins-3", insight_type: "saving", title: "38% savings rate — great work",
      body: "Your savings rate this month is 38%, well above the recommended 20%. You're on track to hit your emergency fund goal by August.",
      amount: 3260.00, delta_pct: null, category: null, linked_entity_type: null, linked_entity_id: null,
      priority: "low", is_read: false, is_dismissed: false, created_at: "2026-04-08T08:00:00Z",
    },
  ],
  unread_count: 3,
};

// ─── Cash Flow ────────────────────────────────────────────────────────────────

const CASH_FLOW_MONTHLY = [
  { month: "2025-05", income: 8500, expenses: 3680, net:  4820 },
  { month: "2025-06", income: 8500, expenses: 4120, net:  4380 },
  { month: "2025-07", income: 8500, expenses: 3290, net:  5210 },
  { month: "2025-08", income: 8500, expenses: 3810, net:  4690 },
  { month: "2025-09", income: 8500, expenses: 4450, net:  4050 },
  { month: "2025-10", income: 8500, expenses: 3140, net:  5360 },
  { month: "2025-11", income: 8500, expenses: 3920, net:  4580 },
  { month: "2025-12", income: 8500, expenses: 5240, net:  3260 },
  { month: "2026-01", income: 8500, expenses: 3310, net:  5190 },
  { month: "2026-02", income: 8500, expenses: 3580, net:  4920 },
  { month: "2026-03", income: 8500, expenses: 3240, net:  5260 },
  { month: "2026-04", income: 8500, expenses: 1890, net:  6610 },
];

const CASH_FLOW_SUMMARY = {
  month: "2026-03", income: 8500, expenses: 3240, net_savings: 5260, savings_rate_pct: 61.9,
};

const CASH_FLOW_SUMMARY_APR = {
  month: "2026-04", income: 8500, expenses: 1890, net_savings: 6610, savings_rate_pct: 77.8,
};

const CASH_FLOW_FLOW = {
  month: "2026-03", income: 8500, expenses: 3240, savings: 5260,
  categories: [
    { category: "Home",           amount: 1650, pct: 50.9 },
    { category: "Food & Drink",   amount: 487,  pct: 15.0 },
    { category: "Groceries",      amount: 319,  pct: 9.8  },
    { category: "Shopping",       amount: 242,  pct: 7.5  },
    { category: "Entertainment",  amount: 179,  pct: 5.5  },
    { category: "Travel",         amount: 168,  pct: 5.2  },
    { category: "Transportation", amount: 95,   pct: 2.9  },
    { category: "Health",         amount: 45,   pct: 1.4  },
    { category: "Utilities",      amount: 55,   pct: 1.7  },
  ],
};

// ─── Net Worth ────────────────────────────────────────────────────────────────

function netWorthHistory() {
  const snapshots = [];
  const start = new Date("2025-07-01");
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().split("T")[0];
    const trend = i * 140;
    const noise = (Math.sin(i * 0.3) * 800);
    const nw = 162000 + trend + noise;
    snapshots.push({
      snapshot_date: date, total_assets: nw + 2688, total_liabilities: 2688,
      net_worth: Math.round(nw),
      breakdown: { "Amex Gold Card": -1241, "Chase Sapphire Preferred": -876, "Capital One Venture X": -413, "Bilt Blue": -158, "Checking Account": 4219, "High-Yield Savings": 18540, brokerage: nw - 20000 },
    });
  }
  return snapshots;
}

const NET_WORTH_HISTORY = netWorthHistory();

// ─── Anomalies ────────────────────────────────────────────────────────────────

const ANOMALIES = [
  {
    id: "an-1", transaction_id: "t-anm-1", anomaly_score: -0.82, status: "unreviewed",
    reason: "Transaction amount ($847) is 6.2x your average spend at this merchant ($137). Unusual time of day.",
    features: { amount_zscore: 3.4, hour_of_day: 2, merchant_avg: 137 },
    flagged_at: "2026-04-08T09:15:00Z",
    transaction: { id: "t-anm-1", date: "2026-04-07", amount: 847.00, merchant: "Apple Store",     raw_description: "APPLE STORE #R329",       category: "Shopping",      subcategory: "Electronics" },
  },
  {
    id: "an-2", transaction_id: "t-anm-2", anomaly_score: -0.74, status: "unreviewed",
    reason: "First-ever transaction at this merchant. Category Travel > Flights is rare for your history.",
    features: { is_new_merchant: true, category_frequency: 0.02 },
    flagged_at: "2026-04-06T11:00:00Z",
    transaction: { id: "t-anm-2", date: "2026-04-05", amount: 320.00, merchant: "Delta Air Lines", raw_description: "DELTA AIR 0062748219",    category: "Travel",        subcategory: "Flights"    },
  },
  {
    id: "an-3", transaction_id: "t-anm-3", anomaly_score: -0.68, status: "unreviewed",
    reason: "Duplicate-amount pattern detected: three $14.99 charges from Netflix within 7 days.",
    features: { duplicate_amount_count: 3, days_window: 7 },
    flagged_at: "2026-04-04T14:30:00Z",
    transaction: { id: "t-anm-3", date: "2026-04-03", amount: 14.99,  merchant: "Netflix",          raw_description: "NETFLIX.COM",             category: "Entertainment", subcategory: "Streaming"  },
  },
];

// ─── Subscriptions ────────────────────────────────────────────────────────────

const SUBSCRIPTIONS_DATA = {
  subscriptions: [
    { id: "sub-1", merchant_name: "Netflix",        normalized_name: "netflix",        amount: 15.49, currency: "USD", frequency: "monthly", category: "Entertainment", subcategory: "Streaming", last_charged: "2026-04-01", next_expected: "2026-05-01", is_active: true, is_cancelled: false, auto_detected: true, previous_amount: 13.99, price_changed_at: "2026-01-15", annual_cost: 185.88, charge_count: 24 },
    { id: "sub-2", merchant_name: "Spotify",        normalized_name: "spotify",        amount: 11.99, currency: "USD", frequency: "monthly", category: "Entertainment", subcategory: "Streaming", last_charged: "2026-04-03", next_expected: "2026-05-03", is_active: true, is_cancelled: false, auto_detected: true, previous_amount: null,  price_changed_at: null,         annual_cost: 143.88, charge_count: 18 },
    { id: "sub-3", merchant_name: "Planet Fitness", normalized_name: "planet fitness", amount: 25.00, currency: "USD", frequency: "monthly", category: "Health",        subcategory: "Gym",       last_charged: "2026-03-28", next_expected: "2026-04-28", is_active: true, is_cancelled: false, auto_detected: true, previous_amount: null,  price_changed_at: null,         annual_cost: 300.00, charge_count: 12 },
    { id: "sub-4", merchant_name: "Adobe Creative", normalized_name: "adobe",          amount: 54.99, currency: "USD", frequency: "monthly", category: "Business",      subcategory: "Software",  last_charged: "2026-04-05", next_expected: "2026-05-05", is_active: true, is_cancelled: false, auto_detected: true, previous_amount: 52.99, price_changed_at: "2026-02-01", annual_cost: 659.88, charge_count: 8  },
    { id: "sub-5", merchant_name: "iCloud Storage", normalized_name: "icloud",         amount: 2.99,  currency: "USD", frequency: "monthly", category: "Utilities",     subcategory: "Phone",     last_charged: "2026-04-02", next_expected: "2026-05-02", is_active: true, is_cancelled: false, auto_detected: true, previous_amount: null,  price_changed_at: null,         annual_cost: 35.88,  charge_count: 30 },
  ],
  total_monthly_cost: 110.46,
  total_annual_cost: 1325.52,
  count: 5,
};

// ─── Goals ───────────────────────────────────────────────────────────────────

const GOALS = [
  {
    id: "g1", name: "Emergency Fund", description: "6 months of expenses (~$19,500)",
    goal_type: "savings", target_amount: 19500, current_amount: 18540, pct_complete: 95.1,
    remaining: 960, linked_account_id: "acc-6", linked_category: null,
    target_date: "2026-08-01", projected_completion_date: "2026-06-15",
    required_monthly_contribution: 320, on_track: true, is_completed: false, is_archived: false,
    completed_at: null, sort_order: 0, created_at: "2025-10-01T00:00:00Z",
  },
  {
    id: "g2", name: "Japan Trip", description: "Two weeks in Tokyo and Kyoto",
    goal_type: "purchase", target_amount: 5000, current_amount: 2200, pct_complete: 44.0,
    remaining: 2800, linked_account_id: null, linked_category: "Travel",
    target_date: "2026-11-01", projected_completion_date: "2026-10-20",
    required_monthly_contribution: 467, on_track: true, is_completed: false, is_archived: false,
    completed_at: null, sort_order: 1, created_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "g3", name: "Pay Off Venture X", description: "Clear the travel card balance",
    goal_type: "debt", target_amount: 412.88, current_amount: 0, pct_complete: 0,
    remaining: 412.88, linked_account_id: "acc-3", linked_category: null,
    target_date: "2026-05-15", projected_completion_date: "2026-05-10",
    required_monthly_contribution: 206, on_track: true, is_completed: false, is_archived: false,
    completed_at: null, sort_order: 2, created_at: "2026-03-01T00:00:00Z",
  },
];

// ─── Reports ─────────────────────────────────────────────────────────────────

const SPEND_BY_CATEGORY_REPORT = [
  { category: "Home",           subcategory: "Rent",        transaction_count: 3,  total: 4950.00, avg_transaction: 1650.00 },
  { category: "Food & Drink",   subcategory: "Restaurant",  transaction_count: 18, total: 1842.50, avg_transaction: 102.36  },
  { category: "Groceries",      subcategory: "In-Store",    transaction_count: 12, total: 948.80,  avg_transaction: 79.07   },
  { category: "Shopping",       subcategory: "Amazon",      transaction_count: 8,  total: 724.60,  avg_transaction: 90.58   },
  { category: "Travel",         subcategory: "Flights",     transaction_count: 2,  total: 640.00,  avg_transaction: 320.00  },
  { category: "Entertainment",  subcategory: "Streaming",   transaction_count: 9,  total: 536.70,  avg_transaction: 59.63   },
  { category: "Food & Drink",   subcategory: "Delivery",    transaction_count: 11, total: 492.30,  avg_transaction: 44.75   },
  { category: "Transportation", subcategory: "Gas",         transaction_count: 6,  total: 408.00,  avg_transaction: 68.00   },
  { category: "Health",         subcategory: "Gym",         transaction_count: 3,  total: 300.00,  avg_transaction: 100.00  },
  { category: "Food & Drink",   subcategory: "Coffee",      transaction_count: 14, total: 284.20,  avg_transaction: 20.30   },
  { category: "Utilities",      subcategory: "Phone",       transaction_count: 6,  total: 241.80,  avg_transaction: 40.30   },
  { category: "Transportation", subcategory: "Transit",     transaction_count: 10, total: 198.50,  avg_transaction: 19.85   },
];

const MONTHLY_SUMMARY = [
  { month: "2026-01", expenses: 3310, income: 8500, net:  5190, expense_count: 38 },
  { month: "2026-02", expenses: 3580, income: 8500, net:  4920, expense_count: 41 },
  { month: "2026-03", expenses: 3240, income: 8500, net:  5260, expense_count: 36 },
  { month: "2026-04", expenses: 1890, income: 8500, net:  6610, expense_count: 22 },
];

const TAX_EXPORT = TX_ITEMS.slice(0, 8).map(t => ({
  date: t.date, amount: t.amount, merchant: t.merchant ?? t.raw_description,
  category: t.category, subcategory: t.subcategory,
}));

// ─── Merchants ────────────────────────────────────────────────────────────────

const MERCHANTS_LIST = [
  { merchant_name: "Rivington Management", transaction_count: 3,  total_spent: 4950.00, avg_amount: 1650.00, last_seen: "2026-04-01", category: "Home",         subcategory: "Rent"       },
  { merchant_name: "Nobu Restaurant",      transaction_count: 2,  total_spent: 284.00,  avg_amount: 142.00,  last_seen: "2026-04-09", category: "Food & Drink", subcategory: "Restaurant" },
  { merchant_name: "Whole Foods Market",   transaction_count: 5,  total_spent: 412.80,  avg_amount: 82.56,   last_seen: "2026-04-08", category: "Groceries",    subcategory: "In-Store"   },
  { merchant_name: "Amazon.com",           transaction_count: 4,  total_spent: 324.60,  avg_amount: 81.15,   last_seen: "2026-04-06", category: "Shopping",     subcategory: "Amazon"     },
  { merchant_name: "Sweetgreen",           transaction_count: 6,  total_spent: 418.50,  avg_amount: 69.75,   last_seen: "2026-04-07", category: "Food & Drink", subcategory: "Restaurant" },
  { merchant_name: "Delta Air Lines",      transaction_count: 2,  total_spent: 640.00,  avg_amount: 320.00,  last_seen: "2026-04-05", category: "Travel",       subcategory: "Flights"    },
  { merchant_name: "DoorDash",             transaction_count: 8,  total_spent: 396.80,  avg_amount: 49.60,   last_seen: "2026-04-04", category: "Food & Drink", subcategory: "Delivery"   },
  { merchant_name: "Trader Joe's",         transaction_count: 4,  total_spent: 298.40,  avg_amount: 74.60,   last_seen: "2026-04-03", category: "Groceries",    subcategory: "In-Store"   },
];

const MERCHANT_HISTORY = {
  merchant_name: "Sweetgreen",
  total_spent: 418.50,
  transaction_count: 6,
  monthly: [
    { month: "2025-11", total: 48.50,  count: 1 },
    { month: "2025-12", total: 62.25,  count: 1 },
    { month: "2026-01", total: 94.50,  count: 2 },
    { month: "2026-02", total: 108.25, count: 2 },
    { month: "2026-03", total: 105.00, count: 1 },
  ],
  transactions: [
    { id: "t3",  date: "2026-04-07", amount: 105.00, category: "Food & Drink", subcategory: "Restaurant" },
    { id: "t3b", date: "2026-03-14", amount: 94.50,  category: "Food & Drink", subcategory: "Restaurant" },
  ],
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function getFixture(pathname, searchParams) {
  if (pathname === "/api/auth/me") return AUTH_ME;

  if (pathname === "/api/accounts") return ACCOUNTS;
  if (pathname === "/api/accounts/linked") return [];

  if (pathname === "/api/budgets") return BUDGETS;

  if (pathname === "/api/points/leakage")  return POINTS_LEAKAGE;
  if (pathname === "/api/points/optimize") return POINTS_OPTIMIZE;
  if (pathname === "/api/points/ledger")   return POINTS_LEDGER;
  if (pathname === "/api/points/summary")  return POINTS_SUMMARY;
  if (pathname === "/api/points/balance")  return {};

  if (pathname === "/api/transactions/spend-by-category") return SPEND_BY_CATEGORY;
  if (pathname === "/api/transactions/categories")        return TRANSACTION_CATEGORIES;
  if (pathname === "/api/transactions") return TRANSACTIONS_RESPONSE;

  if (pathname === "/api/insights") return INSIGHTS_RESPONSE;
  if (pathname.startsWith("/api/insights/")) return { ok: true };

  if (pathname === "/api/cash-flow/monthly")        return CASH_FLOW_MONTHLY;
  if (pathname === "/api/cash-flow/flow")           return CASH_FLOW_FLOW;
  if (pathname === "/api/cash-flow/category-trend") return [];
  if (pathname === "/api/cash-flow/summary") {
    const month = searchParams.get("month");
    return month === "2026-04" ? CASH_FLOW_SUMMARY_APR : CASH_FLOW_SUMMARY;
  }

  if (pathname === "/api/net-worth/history") return NET_WORTH_HISTORY;

  if (pathname === "/api/anomalies") return ANOMALIES;
  if (pathname.match(/\/api\/anomalies\/.+\/review/)) return { ...ANOMALIES[0], status: "ok" };

  if (pathname === "/api/subscriptions") return SUBSCRIPTIONS_DATA;

  if (pathname.match(/\/api\/goals\/[^/]+\/projection/)) {
    return { goal_id: "g1", current_amount: 18540, target_amount: 19500, gap: 960, monthly_savings_avg: 5100, months_to_completion: 1, projected_completion_date: "2026-06-15", required_monthly_to_hit_target: 320, months_until_target: 4, on_track: true };
  }
  if (pathname === "/api/goals") return GOALS;

  if (pathname === "/api/reports/spending-by-category") return SPEND_BY_CATEGORY_REPORT;
  if (pathname === "/api/reports/monthly-summary")      return MONTHLY_SUMMARY;
  if (pathname === "/api/reports/tax-export")           return TAX_EXPORT;

  const merchantHistoryMatch = pathname.match(/^\/api\/merchants\/(.+)\/history$/);
  if (merchantHistoryMatch) return MERCHANT_HISTORY;
  if (pathname === "/api/merchants") return MERCHANTS_LIST;

  if (pathname === "/api/chat") {
    return {
      response: "Based on your March spending, you're in great shape! Your savings rate was 61.9% — well above the 20% benchmark. Your top categories were Home ($1,650 rent), Food & Drink ($487), and Groceries ($319). You're on pace to fully fund your emergency fund by June. One tip: switching to your Amex Gold for grocery runs would earn you an extra ~$8/month in Membership Rewards.",
      input_tokens: 1240, output_tokens: 98, model_used: "claude-sonnet-4-6",
    };
  }

  if (pathname === "/api/rules") return [];
  if (pathname === "/api/plan/projection") return { historical: [], projected: [], monthly_savings_avg: 5100, events: [] };
  if (pathname === "/api/plan/events")     return [];

  return null;
}

module.exports = { getFixture };
