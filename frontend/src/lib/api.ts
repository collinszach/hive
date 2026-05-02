const IS_SERVER = typeof window === "undefined";
const SERVER_BASE = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

function authHeader(): Record<string, string> {
  return {};
}

function handleUnauthorized(status: number): void {
  if (status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
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
  const res = await fetch(url, { cache: "no-store", headers: authHeader(), credentials: "include" });
  if (!res.ok) { handleUnauthorized(res.status); throw new Error(`GET ${path} → ${res.status}`); }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) { handleUnauthorized(res.status); throw new Error(`POST ${path} → ${res.status}`); }
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
    credentials: "include",
  });
  if (!res.ok) { handleUnauthorized(res.status); throw new Error(`DELETE ${path} → ${res.status}`); }
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
    credentials: "include",
  });
  if (!res.ok) { handleUnauthorized(res.status); throw new Error(`PATCH ${path} → ${res.status}`); }
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const base = IS_SERVER ? SERVER_BASE : "";
  const res = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) { handleUnauthorized(res.status); throw new Error(`PUT ${path} → ${res.status}`); }
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
  statement_close_day: number | null;
  payment_due_day: number | null;
  autopay: boolean;
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
  account_name: string | null;
  card_slug: string | null;
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
  notes: string | null;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  total_amount: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Budget {
  id: string;
  category: string;
  month: string;
  budget_amount: number;
  rollover: boolean;
  rollover_amount: number;
  effective_budget: number;
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
  account_name?: string | null;
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

export interface LedgerEntry {
  transaction_id: string;
  account_id: string;
  card_slug: string;
  program: string;
  points_earned: number;
  earn_rate: number;
  category: string | null;
  subcategory: string | null;
  merchant: string | null;
  amount: number;
  date: string;  // ISO date YYYY-MM-DD
}

export interface PointsBalanceResponse {
  program: string;
  balance: number;
  updated_at: string;
}

export interface LeakageEntry {
  transaction_id: string;
  merchant: string | null;
  date: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  actual_card_slug: string;
  actual_earn_rate: number;
  actual_points: number;
  actual_value_dollars: number;
  best_card_slug: string;
  best_program: string;
  best_earn_rate: number;
  best_points: number;
  best_value_dollars: number;
  leakage_dollars: number;
}

export interface LeakageResponse {
  entries: LeakageEntry[];
  total_leakage_dollars: number;
  transaction_count: number;
  days: number;
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
  model_used: string;
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

export type GoalType = "save" | "spend_under" | "pay_down";

export interface Goal {
  id: number;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  pct_complete: number;
  remaining: number;
  monthly_target: number | null;
  months_remaining: number | null;
  account_id: string | null;
  category: string | null;
  deadline: string | null;
  pinned: boolean;
  archived: boolean;
  on_track: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface GoalCreate {
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount?: number;
  account_id?: number | null;
  category?: string | null;
  deadline?: string | null;
  pinned?: boolean;
}

export interface GoalUpdate {
  name?: string;
  goal_type?: GoalType;
  target_amount?: number;
  current_amount?: number;
  account_id?: number | null;
  category?: string | null;
  deadline?: string | null;
  pinned?: boolean;
  archived?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  sort_order: number;
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

export interface PlanEvent {
  id: string;
  name: string;
  amount: number;
  event_date: string;  // ISO date
  category: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface ProjectionPoint {
  date: string;
  net_worth: number;
}

export interface ProjectionResponse {
  historical: ProjectionPoint[];
  projected: ProjectionPoint[];
  monthly_savings_avg: number;
  events: PlanEvent[];
}


export interface TrimRecommendation {
  category: string;
  subcategory: string | null;
  current_monthly: number;
  suggested_monthly: number;
  savings_per_month: number;
  rationale: string;
  goal_impact: string | null;
}

export interface FlowCategory {
  category: string;
  amount: number;
  pct: number;
}

export interface FlowData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  categories: FlowCategory[];
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

export interface SpendDelta {
  category: string;
  this_month: number;
  last_month: number;
  delta: number;
  delta_pct: number;
}

export interface MonthlyReview {
  month: string;
  net_worth_end: number | null;
  net_worth_start: number | null;
  net_worth_delta: number | null;
  total_income: number;
  total_spend: number;
  budget_categories_over: number;
  budget_categories_under: number;
  top_spend_changes: SpendDelta[];
  points_earned: { program: string; points_earned: number; estimated_value: number }[];
  uncategorized_count: number;
  transaction_count: number;
}

export interface TaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  result: unknown | null;
}

export interface UpcomingBill extends Subscription {
  days_away: number;
  status: "today" | "soon" | "upcoming";
  is_today: boolean;
  is_this_week: boolean;
}

export interface GoalProjection {
  projected_completion_date: string | null;
  monthly_savings_avg: number;
  on_track: boolean;
  required_monthly_to_hit_target: number | null;
}

export interface PaceAlert {
  category: string;
  budget_amount: number;
  actual_spend: number;
  projected_spend: number;
  days_elapsed: number;
  days_in_month: number;
  over_by: number;
  pct_projected: number;
  severity: "warning" | "danger";
}

export interface SafeToSpend {
  safe_to_spend: number;
  color: "green" | "amber" | "red";
  breakdown: {
    monthly_income: number;
    spent_this_month: number;
    upcoming_bills: number;
    goal_savings: number;
  };
  days_remaining: number;
}

export interface HealthFactor {
  name: string;
  score: number;
  description: string;
  color: "green" | "amber" | "red";
}

export interface HealthScore {
  score: number;
  grade: string;
  factors: HealthFactor[];
  has_data: boolean;
}

export interface DailySpend {
  date: string;
  total: number;
  count: number;
}

export interface WeeklyComparison {
  this_week_total: number;
  last_week_total: number;
  delta: number;
  delta_pct: number;
  days_elapsed_this_week: number;
  this_week_days: DailySpend[];
  last_week_days: DailySpend[];
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

export interface SpendByCard {
  account_id: string;
  account_name: string;
  card_slug: string | null;
  account_type: string;
  account_subtype: string | null;
  total_spend: number;
  transaction_count: number;
  avg_transaction: number;
  top_categories: { category: string; total: number }[];
}

export interface DayForecast {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface ForecastResponse {
  category: string;
  projected_total: number;
  daily_forecast: DayForecast[];
  history_days: number;
  periods: number;
}

export interface Contact {
  id: string;
  name: string;
}

export interface ExpenseShare {
  id: string;
  transaction_id: string;
  contact_id: string;
  contact_name: string;
  amount: number;
  note: string | null;
  status: "pending" | "settled";
  settled_at: string | null;
  settlement_transaction_id: string | null;
  created_at: string;
  transaction_date: string | null;
  transaction_merchant: string | null;
  transaction_amount: number | null;
}

export interface CardPaymentInfo {
  account_id: string;
  account_name: string;
  card_slug: string | null;
  statement_balance: number;
  statement_close_day: number;
  payment_due_day: number;
  due_date: string;
  days_until_due: number;
  autopay: boolean;
}

export interface SubscriptionPending {
  id: string;
  merchant_name: string;
  amount: number;
  frequency: string;
  next_expected: string | null;
}

export interface PendingReimbursement {
  share_id: string;
  contact_name: string;
  amount: number;
  note: string | null;
  transaction_date: string;
  transaction_merchant: string | null;
  days_outstanding: number;
}

export interface MonthlyPosition {
  month: string;
  income: number;
  spent: number;
  saved: number;
  remaining_to_save: number;
  subscriptions_pending: SubscriptionPending[];
  subscriptions_pending_total: number;
  card_payments: CardPaymentInfo[];
  pending_reimbursements: PendingReimbursement[];
  pending_reimbursements_total: number;
  available_to_save: number;
}

// ---- API functions ----

export const api = {
  accounts: {
    list: () => get<Account[]>("/api/accounts"),
    linked: () => get<LinkedInstitution[]>("/api/accounts/linked"),
    unlink: (item_id: string, delete_transactions = true) =>
      del<UnlinkResponse>(`/api/accounts/linked/${item_id}`, { delete_transactions }),
    updateBilling: (id: string, statement_close_day?: number | null, payment_due_day?: number | null, credit_limit?: number, autopay?: boolean) =>
      patch<Account>(`/api/accounts/${id}/billing`, { statement_close_day, payment_due_day, credit_limit, autopay }),
  },
  transactions: {
    list: (params: {
      month?: string;
      start_date?: string;
      end_date?: string;
      category?: string;
      subcategory?: string;
      account_id?: string;
      search?: string;
      search_all?: boolean;
      tag_id?: string;
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
    patch: (id: string, body: { merchant?: string; category?: string; subcategory?: string; notes?: string | null }) =>
      patch<Transaction>(`/api/transactions/${id}`, body),
    categories: () => get<{ category: string; count: number }[]>("/api/transactions/categories"),
    spendByCategory: (month?: string) =>
      get<{ category: string; spend: number }[]>("/api/transactions/spend-by-category", month ? { month } : undefined),
    bulkUpdate: (ids: string[], updates: { category?: string; subcategory?: string | null; is_excluded?: boolean }) =>
      post<{ updated: number }>("/api/transactions/bulk-update", { ids, ...updates }),
    createManual: (body: { date: string; amount: number; merchant: string; category?: string | null; subcategory?: string | null; notes?: string | null; account_id?: string | null }) =>
      post<Transaction>("/api/transactions", body),
    getById: (id: string) => get<Transaction>(`/api/transactions/${id}`),
    delete: (id: string) => del<void>(`/api/transactions/${id}`),
    exportUrl: (params: { month?: string; start_date?: string; end_date?: string; category?: string; search?: string; include_pending?: boolean; include_excluded?: boolean }) => {
      const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
      return "/api/transactions/export?" + new URLSearchParams(p).toString();
    },
  },
  budgets: {
    list: (month?: string) => get<Budget[]>("/api/budgets", month ? { month } : undefined),
    upsert: (category: string, month: string, budget_amount: number, rollover?: boolean) =>
      post<Budget>("/api/budgets", { category, month, budget_amount, rollover: rollover ?? false }),
    delete: (id: string) => del<void>(`/api/budgets/${id}`),
    suggest: (month?: string, lookback_months?: number) =>
      get<{ category: string; avg_monthly: number; suggested_budget: number; lookback_months: number }[]>(
        "/api/budgets/suggest",
        { ...(month ? { month } : {}), ...(lookback_months ? { lookback_months } : {}) }
      ),
    copy: (from_month: string, to_month: string, overwrite = false) =>
      post<{ copied: number; skipped: number; message?: string }>(
        "/api/budgets/copy",
        { from_month, to_month, overwrite }
      ),
  },
  points: {
    summary: (days?: number) =>
      get<PointsSummary>("/api/points/summary", days ? { days } : undefined),
    optimize: (params: { category?: string; subcategory?: string; amount: number }) =>
      get<OptimizerResponse>("/api/points/optimize", params as Record<string, string | number | undefined>),
    ledger: (params?: { days?: number; account_id?: string }) =>
      get<LedgerEntry[]>("/api/points/ledger", params as Record<string, string | number | undefined>),
    setBalance: (program: string, balance: number) =>
      put<PointsBalanceResponse>("/api/points/balance", { program, balance }),
    leakage: (days: number) =>
      get<LeakageResponse>("/api/points/leakage", { days }),
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
    send: (
      message: string,
      conversation_history?: Array<{ role: string; content: string }>,
      use_claude?: boolean,
    ) =>
      post<ChatResponse>("/api/chat", { message, conversation_history, use_claude: use_claude ?? false }),
  },
  insights: {
    list: (limit?: number, include_dismissed?: boolean) =>
      get<{ insights: Insight[]; unread_count: number }>("/api/insights", { limit, include_dismissed } as Record<string, number | boolean | undefined>),
    markRead: (id: string) => post<{ id: string; is_read: boolean }>(`/api/insights/${id}/read`, {}),
    dismiss: (id: string) => post<{ id: string; is_dismissed: boolean }>(`/api/insights/${id}/dismiss`, {}),
    markAllRead: () => post<{ ok: boolean }>("/api/insights/mark-all-read", {}),
    generate: () => post<{ task_id: string; status: string }>("/api/insights/generate", {}),
  },
  subscriptions: {
    list: (active_only?: boolean) =>
      get<SubscriptionSummary>("/api/subscriptions", active_only !== undefined ? { active_only } : undefined),
    create: (body: { merchant_name: string; amount: number; frequency: string; category?: string }) =>
      post<Subscription>("/api/subscriptions", body),
    update: (id: string, body: Partial<Pick<Subscription, "merchant_name" | "amount" | "frequency" | "category" | "is_active" | "is_cancelled">>) =>
      put<Subscription>(`/api/subscriptions/${id}`, body),
    delete: (id: string) => del<{ deleted: string }>(`/api/subscriptions/${id}`),
    upcoming: (days?: number) =>
      get<UpcomingBill[]>("/api/subscriptions/upcoming", days ? { days } : undefined),
    scan: () => post<{ task_id: string; status: string }>("/api/subscriptions/scan", {}),
  },
  goals: {
    list: (include_archived?: boolean) =>
      get<Goal[]>("/api/goals", include_archived ? { include_archived } : undefined),
    create: (body: GoalCreate) => post<Goal>("/api/goals", body),
    update: (id: number, body: GoalUpdate) => patch<Goal>(`/api/goals/${id}`, body),
    delete: (id: number) => del<{ deleted: number }>(`/api/goals/${id}`),
    projection: (id: number) => get<GoalProjection>(`/api/goals/${id}/projection`),
    contribute: (id: number, amount: number) =>
      post<Goal>(`/api/goals/${id}/contribute`, { amount }),
  },
  plan: {
    projection: (months?: number) =>
      get<ProjectionResponse>("/api/plan/projection", months ? { months } : undefined),
    events: () => get<PlanEvent[]>("/api/plan/events"),
    createEvent: (data: Omit<PlanEvent, "id" | "is_active">) =>
      post<PlanEvent>("/api/plan/events", data),
    updateEvent: (id: string, data: Partial<PlanEvent>) =>
      put<PlanEvent>(`/api/plan/events/${id}`, data),
    deleteEvent: (id: string) => del<void>(`/api/plan/events/${id}`),
    trimRecommendations: (goalIds?: string[]) =>
      post<TrimRecommendation[]>("/api/plan/trim-recommendations", { goal_ids: goalIds ?? [] }),
  },
  tags: {
    list: () => get<Tag[]>("/api/tags"),
    create: (name: string, color?: string) => post<Tag>("/api/tags", { name, color }),
    delete: (id: string) => del<void>(`/api/tags/${id}`),
    forTransaction: (txId: string) => get<Tag[]>(`/api/tags/transaction/${txId}`),
    add: (txId: string, tagId: string) => post<void>(`/api/tags/transaction/${txId}/${tagId}`, {}),
    remove: (txId: string, tagId: string) => del<void>(`/api/tags/transaction/${txId}/${tagId}`),
  },
  splits: {
    list: (txId: string) => get<TransactionSplit[]>(`/api/transactions/${txId}/splits`),
    set: (txId: string, splits: { amount: number; category: string | null; subcategory: string | null; notes: string | null }[]) =>
      put<TransactionSplit[]>(`/api/transactions/${txId}/splits`, { splits }),
    clear: (txId: string) => del<void>(`/api/transactions/${txId}/splits`),
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
  income: {
    summary: (month?: string) =>
      get<{ month: string; total_income: number; sources: { source: string; amount: number; count: number; pct: number }[] }>("/api/income/summary", month ? { month } : undefined),
    monthly: (months?: number) =>
      get<{ month: string; income: number; count: number }[]>("/api/income/monthly", months ? { months } : undefined),
  },
  cashFlow: {
    monthly: (months?: number) =>
      get<MonthlyCashFlow[]>("/api/cash-flow/monthly", months ? { months } : undefined),
    summary: (month?: string) => get<CashFlowSummary>("/api/cash-flow/summary", month ? { month } : undefined),
    categoryTrend: (category: string, months?: number) =>
      get<{ month: string; total: number }[]>("/api/cash-flow/category-trend", { category, ...(months ? { months } : {}) }),
    flow: (month?: string) => get<FlowData>("/api/cash-flow/flow", month ? { month } : undefined),
    daily: (month?: string) => get<{ date: string; total: number; count: number }[]>("/api/cash-flow/daily", month ? { month } : undefined),
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
    spendingByCategory: (start_date?: string, end_date?: string, account_id?: string) =>
      get<SpendByCategory[]>("/api/reports/spending-by-category", { start_date, end_date, account_id } as Record<string, string | undefined>),
    monthlySummary: (year?: number) =>
      get<{ month: string; expenses: number; income: number; net: number; expense_count: number }[]>("/api/reports/monthly-summary", year ? { year } : undefined),
    taxExport: (year?: number) =>
      get<{ date: string; amount: number; merchant: string; category: string; subcategory: string | null }[]>("/api/reports/tax-export", year ? { year } : undefined),
    yoyComparison: (category?: string) =>
      get<{ month_num: number; month: string; current_year: number; prior_year: number; delta: number }[]>("/api/reports/yoy-comparison", category ? { category } : undefined),
    spendingByWeekday: (days?: number, category?: string) =>
      get<{ dow: number; day_name: string; transaction_count: number; total: number; avg_transaction: number; days_with_spend: number }[]>(
        "/api/reports/spending-by-weekday",
        { ...(days ? { days } : {}), ...(category ? { category } : {}) },
      ),
    budgetHistory: (months?: number) =>
      get<{ month: string; category: string; budget_amount: number; actual_spend: number; pct_used: number }[]>(
        "/api/reports/budget-history",
        months ? { months } : undefined,
      ),
    dailySpend: (year?: number) =>
      get<{ date: string; total: number; count: number }[]>(
        "/api/reports/daily-spend",
        year ? { year } : undefined,
      ),
    categoryTrend: (category: string, months?: number) =>
      get<{ month: string; total: number; count: number }[]>(
        "/api/reports/category-trend",
        { category, ...(months ? { months } : {}) },
      ),
    spendingByCard: (start_date?: string, end_date?: string) =>
      get<SpendByCard[]>("/api/reports/spending-by-card", { start_date, end_date } as Record<string, string | undefined>),
    topMerchants: (start_date?: string, end_date?: string, limit?: number) =>
      get<{ merchant: string; category: string; subcategory: string | null; transaction_count: number; total_spend: number; avg_transaction: number; pct_of_total: number; last_seen: string | null }[]>(
        "/api/reports/top-merchants",
        { start_date, end_date, ...(limit ? { limit } : {}) } as Record<string, string | number | undefined>,
      ),
  },
  review: {
    monthly: (month: string) => get<MonthlyReview>(`/api/review/monthly`, { month }),
  },
  dashboard: {
    safeToSpend: () => get<SafeToSpend>("/api/dashboard/safe-to-spend"),
    paceAlerts: (month?: string) => get<PaceAlert[]>("/api/dashboard/pace-alerts", month ? { month } : undefined),
    healthScore: () => get<HealthScore>("/api/dashboard/health-score"),
    weeklyComparison: () => get<WeeklyComparison>("/api/dashboard/weekly-comparison"),
  },
  plaid: {
    applyRules: () => post<{ status: string; message: string }>("/api/plaid/apply-rules", {}),
  },
  snaptrade: {
    connect: () => post<{ redirect_url: string }>("/api/snaptrade/connect", {}),
    callback: () => get<{ accounts_added: number }>("/api/snaptrade/callback"),
  },
  forecast: {
    category: (category: string, periods = 30) =>
      get<ForecastResponse>(`/api/forecast/${encodeURIComponent(category)}`, { periods }),
  },
  contacts: {
    list: () => get<Contact[]>("/api/contacts"),
    create: (name: string) => post<Contact>("/api/contacts", { name }),
    rename: (id: string, name: string) => patch<Contact>(`/api/contacts/${id}`, { name }),
    delete: (id: string) => del<void>(`/api/contacts/${id}`),
  },
  shares: {
    list: (txId: string) => get<ExpenseShare[]>(`/api/transactions/${txId}/shares`),
    create: (txId: string, body: { contact_id: string; amount: number; note?: string }) =>
      post<ExpenseShare>(`/api/transactions/${txId}/shares`, body),
    settle: (shareId: string, settlement_transaction_id?: string) =>
      patch<ExpenseShare>(`/api/shares/${shareId}/settle`, { settlement_transaction_id: settlement_transaction_id ?? null }),
    unsettle: (shareId: string) =>
      patch<ExpenseShare>(`/api/shares/${shareId}/unsettle`, {}),
    delete: (shareId: string) => del<void>(`/api/shares/${shareId}`),
    pending: () => get<ExpenseShare[]>("/api/shares/pending"),
    settled: (limit?: number) => get<ExpenseShare[]>("/api/shares/settled", limit ? { limit } : undefined),
  },
  position: {
    monthly: (month: string) => get<MonthlyPosition>(`/api/position/monthly`, { month }),
  },
};
