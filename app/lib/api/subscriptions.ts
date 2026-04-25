import { apiFetch } from "./client"

// Mirrors backend/app/schemas/subscription.py.

export interface PlanFeaturesResponse {
  max_watchlists: number
  max_watchlist_items: number
  max_strategies: number
  max_active_bots: number
  max_alerts: number
  max_portfolios: number
  screener_max_filters: number
  screener_max_results: number
  price_history_days: number
  all_indicators: boolean
  custom_indicators: boolean
  signals_enabled: boolean
  backtesting_enabled: boolean
  export_enabled: boolean
}

export interface PlanResponse {
  id: number
  name: string // "free" | "pro" | "pro_plus"
  display_name: string
  price_pkr: number
  interval: string // "month" | "year"
  features: PlanFeaturesResponse
  sort_order: number
}

export interface PlanListResponse {
  plans: PlanResponse[]
}

export async function getPlans(): Promise<PlanListResponse> {
  // Public endpoint — no JWT. ISR for 1h: prices change rarely.
  return apiFetch<PlanListResponse>("/subscriptions/plans", {
    next: { revalidate: 3600 },
  })
}
