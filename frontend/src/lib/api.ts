const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, "http://localhost");
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.pathname + url.search, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json();
}

// ---- Types ----

export interface Account {
  id: string;
  name: string;
  official_name: string | null;
  institution: string;
  type: string;
  subtype: string | null;
  card_slug: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  currency: string;
  mask: string | null;
  is_active: boolean;
  is_excluded: boolean;
}

export interface Transaction {
  id: string;
  plaid_transaction_id: string | null;
  account_id: string;
  date: string;
  amount: number;
  currency: string;
  merchant: string | null;
  raw_description: string;
  category: string | null;
  subcategory: string | null;
  category_source: string;
  is_transfer: boolean;
  is_excluded: boolean;
  pending: boolean;
  payment_channel: string | null;
  location_city: string | null;
  location_state: string | null;
  logo_url: string | null;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Budget {
  id: string;
  category: string;
  month: string;
  budget_amount: number;
  actual_spend: number;
  pct_used: number;
  remaining: number;
}

export interface ProgramSummary {
  program: string;
  points_earned_90d: number;
  manual_balance: number | null;
  estimated_value_dollars: number;
  redemption_threshold: number | null;
  above_threshold: boolean;
}

export interface PointsSummary {
  programs: ProgramSummary[];
  total_estimated_value_dollars: number;
}

export interface CardOption {
  card_slug: string;
  program: string;
  earn_rate: number;
  points_earned: number;
  dollar_value: number;
  is_best: boolean;
}

export interface OptimizerResponse {
  category: string | null;
  subcategory: string | null;
  amount: number;
  cards: CardOption[];
}

export interface NetWorthSnapshot {
  snapshot_date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  breakdown: Record<string, number>;
}

export interface AnomalyTransaction {
  id: string;
  date: string;
  amount: number;
  merchant: string | null;
  raw_description: string;
  category: string | null;
  subcategory: string | null;
}

export interface Anomaly {
  id: string;
  transaction_id: string;
  anomaly_score: number;
  reason: string;
  features: Record<string, unknown> | null;
  status: string;
  flagged_at: string;
  transaction: AnomalyTransaction | null;
}

export interface ChatResponse {
  response: string;
  input_tokens: number;
  output_tokens: number;
}

// ---- API functions ----

export const api = {
  accounts: {
    list: () => get<Account[]>("/api/accounts"),
  },
  transactions: {
    list: (params: {
      month?: string;
      category?: string;
      account_id?: string;
      search?: string;
      include_pending?: boolean;
      include_excluded?: boolean;
      page?: number;
      page_size?: number;
    }) => get<TransactionListResponse>("/api/transactions", params as Record<string, string | number | boolean | undefined>),
    updateCategory: (id: string, category: string, subcategory: string) =>
      put<{ id: string; category: string; subcategory: string }>(
        `/api/transactions/${id}/category`,
        { category, subcategory }
      ),
  },
  budgets: {
    list: (month?: string) => get<Budget[]>("/api/budgets", month ? { month } : undefined),
    upsert: (category: string, month: string, budget_amount: number) =>
      post<Budget>("/api/budgets", { category, month, budget_amount }),
  },
  points: {
    summary: () => get<PointsSummary>("/api/points/summary"),
    optimize: (params: { category?: string; subcategory?: string; amount: number }) =>
      get<OptimizerResponse>("/api/points/optimize", params as Record<string, string | number | undefined>),
  },
  netWorth: {
    history: (days?: number) => get<NetWorthSnapshot[]>("/api/net-worth/history", days ? { days } : undefined),
  },
  anomalies: {
    list: (status?: string) => get<Anomaly[]>("/api/anomalies", status ? { status } : undefined),
    review: (id: string, status: "ok" | "confirmed") =>
      post<Anomaly>(`/api/anomalies/${id}/review`, { status }),
  },
  chat: {
    send: (message: string, conversation_history?: Array<{ role: string; content: string }>) =>
      post<ChatResponse>("/api/chat", { message, conversation_history }),
  },
};
