const IS_SERVER = typeof window === "undefined";
const SERVER_BASE = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

function authHeader(): Record<string, string> {
  if (IS_SERVER) return {};
  const token = localStorage.getItem("hive_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const searchStr = params
    ? "?" + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      )
    : "";
  const url = IS_SERVER ? `${SERVER_BASE}${path}${searchStr}` : `${path}${searchStr}`;
  const res = await fetch(url, { cache: "no-store", headers: authHeader() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function del<T>(path: string, params?: Record<string, string | boolean | undefined>): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const searchStr = params
    ? "?" + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      )
    : "";
  const res = await fetch(`${base}${path}${searchStr}`, {
    method: "DELETE",
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  // 204 No Content has no body — don't attempt to parse JSON
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const res = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const res = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
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
  is_manual: boolean;
  is_active: boolean;
  is_excluded: boolean;
}

export interface LinkedInstitution {
  item_id: string;
  institution_name: string;
  institution_id: string | null;
  accounts: Account[];
}

export interface UnlinkResponse {
  item_id: string;
  accounts_removed: number;
  transactions_deleted: number;
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
  has_budget: boolean;
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

export interface Insight {
  id: string;
  insight_type: string;
  title: string;
  body: string;
  amount: number | null;
  delta_pct: number | null;
  category: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  priority: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  merchant_name: string;
  normalized_name: string;
  amount: number;
  currency: string;
  frequency: string;
  category: string | null;
  subcategory: string | null;
  last_charged: string | null;
  next_expected: string | null;
  is_active: boolean;
  is_cancelled: boolean;
  auto_detected: boolean;
  previous_amount: number | null;
  price_changed_at: string | null;
  annual_cost: number | null;
  charge_count: number;
}

export interface SubscriptionSummary {
  subscriptions: Subscription[];
  total_monthly_cost: number;
  total_annual_cost: number;
  count: number;
}

export interface Goal {
  id: string;
  name: string;
  description: string | null;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  pct_complete: number;
  remaining: number;
  linked_account_id: string | null;
  linked_category: string | null;
  target_date: string | null;
  projected_completion_date: string | null;
  required_monthly_contribution: number | null;
  on_track: boolean | null;
  is_completed: boolean;
  is_archived: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface CategorizationRule {
  id: string;
  match_type: string;
  match_value: string;
  amount_min: number | null;
  amount_max: number | null;
  category: string;
  subcategory: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyCashFlow {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashFlowSummary {
  month: string;
  income: number;
  expenses: number;
  net_savings: number;
  savings_rate_pct: number;
}

export interface TaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  result: unknown | null;
}

export interface BulkRecategorizeResult {
  merchant: string;
  transactions_updated: number;
  task_id: string;
}

export interface MerchantSummary {
  merchant_name: string;
  transaction_count: number;
  total_spent: number;
  avg_amount: number;
  last_seen: string | null;
  category: string | null;
  subcategory: string | null;
}

export interface SpendByCategory {
  category: string;
  subcategory: string | null;
  transaction_count: number;
  total: number;
  avg_transaction: number;
}

// ---- API functions ----

export const api = {
  accounts: {
    list: () => get<Account[]>("/api/accounts"),
    linked: () => get<LinkedInstitution[]>("/api/accounts/linked"),
    unlink: (item_id: string, delete_transactions = true) =>
      del<UnlinkResponse>(`/api/accounts/linked/${item_id}`, { delete_transactions }),
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
    patch: (id: string, body: { merchant?: string; category?: string; subcategory?: string }) =>
      patch<Transaction>(`/api/transactions/${id}`, body),
    categories: () => get<{ category: string; count: number }[]>("/api/transactions/categories"),
  },
  budgets: {
    list: (month?: string) => get<Budget[]>("/api/budgets", month ? { month } : undefined),
    upsert: (category: string, month: string, budget_amount: number) =>
      post<Budget>("/api/budgets", { category, month, budget_amount }),
    delete: (id: string) => del<void>(`/api/budgets/${id}`),
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
  insights: {
    list: (limit?: number, include_dismissed?: boolean) =>
      get<Insight[]>("/api/insights", { limit, include_dismissed } as Record<string, number | boolean | undefined>),
    markRead: (id: string) => post<{ id: string; is_read: boolean }>(`/api/insights/${id}/read`, {}),
    dismiss: (id: string) => post<{ id: string; is_dismissed: boolean }>(`/api/insights/${id}/dismiss`, {}),
    markAllRead: () => post<{ ok: boolean }>("/api/insights/mark-all-read", {}),
  },
  subscriptions: {
    list: (active_only?: boolean) =>
      get<SubscriptionSummary>("/api/subscriptions", active_only !== undefined ? { active_only } : undefined),
    update: (id: string, body: Partial<Pick<Subscription, "merchant_name" | "amount" | "frequency" | "is_active" | "is_cancelled">>) =>
      put<Subscription>(`/api/subscriptions/${id}`, body),
    delete: (id: string) => del<{ deleted: string }>(`/api/subscriptions/${id}`),
  },
  goals: {
    list: (include_archived?: boolean) =>
      get<Goal[]>("/api/goals", include_archived ? { include_archived } : undefined),
    create: (body: { name: string; goal_type: string; target_amount: number; current_amount?: number; description?: string; target_date?: string; }) =>
      post<Goal>("/api/goals", body),
    update: (id: string, body: Partial<Pick<Goal, "name" | "description" | "target_amount" | "current_amount" | "target_date" | "is_completed" | "is_archived" | "sort_order">>) =>
      put<Goal>(`/api/goals/${id}`, body),
    delete: (id: string) => del<{ deleted: string }>(`/api/goals/${id}`),
  },
  rules: {
    list: (active_only?: boolean) =>
      get<CategorizationRule[]>("/api/rules", active_only ? { active_only } : undefined),
    create: (body: Omit<CategorizationRule, "id" | "is_active" | "created_at" | "updated_at">) =>
      post<CategorizationRule>("/api/rules", body),
    update: (id: string, body: Partial<CategorizationRule>) =>
      put<CategorizationRule>(`/api/rules/${id}`, body),
    delete: (id: string) => del<{ deleted: string }>(`/api/rules/${id}`),
  },
  cashFlow: {
    monthly: (months?: number) =>
      get<MonthlyCashFlow[]>("/api/cash-flow/monthly", months ? { months } : undefined),
    summary: (month?: string) => get<CashFlowSummary>("/api/cash-flow/summary", month ? { month } : undefined),
    categoryTrend: (category: string, months?: number) =>
      get<{ month: string; total: number }[]>("/api/cash-flow/category-trend", { category, ...(months ? { months } : {}) }),
  },
  merchants: {
    list: (params?: { days?: number; limit?: number; category?: string }) =>
      get<MerchantSummary[]>("/api/merchants", params as Record<string, string | number | undefined>),
    history: (merchant_name: string, months?: number) =>
      get<{ merchant_name: string; total_spent: number; transaction_count: number; monthly: { month: string; total: number; count: number }[]; transactions: { id: string; date: string; amount: number; category: string | null; subcategory: string | null; }[]; }>(`/api/merchants/${encodeURIComponent(merchant_name)}/history`, months ? { months } : undefined),
    bulkRecategorize: (name: string, category: string | null, subcategory: string | null) =>
      post<BulkRecategorizeResult>(
        `/api/merchants/${encodeURIComponent(name)}/bulk-recategorize`,
        { category, subcategory }
      ),
  },
  tasks: {
    status: (taskId: string) => get<TaskStatus>(`/api/merchants/tasks/${taskId}/status`),
  },
  reports: {
    spendingByCategory: (start_date?: string, end_date?: string) =>
      get<SpendByCategory[]>("/api/reports/spending-by-category", { start_date, end_date } as Record<string, string | undefined>),
    monthlySummary: (year?: number) =>
      get<{ month: string; expenses: number; income: number; net: number; expense_count: number }[]>("/api/reports/monthly-summary", year ? { year } : undefined),
    taxExport: (year?: number) =>
      get<{ date: string; amount: number; merchant: string; category: string; subcategory: string | null }[]>("/api/reports/tax-export", year ? { year } : undefined),
  },
};
