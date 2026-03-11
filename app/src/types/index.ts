export type NavView = 'dashboard' | 'chat' | 'customers' | 'wholesale' | 'branches' | 'analytics'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chartConfig?: ChartConfig | null
  followUpSuggestions?: string[]
  timestamp: number
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed'
  title: string
  data: Record<string, unknown>[]
  xKey: string
  yKeys: { key: string; color: string; name: string }[]
  interpretation?: string
}

export interface InsightCard {
  id: number
  severity: 'info' | 'warning' | 'alert' | 'opportunity'
  title: string
  body: string
  action: string | null
  related_intent: string | null
  related_params: Record<string, unknown> | null
  created_at: string
}

export interface CustomerSummary {
  customer_id: string
  customer_type: 'retail' | 'wholesale' | 'both'
  first_name: string
  last_name: string
  business_name: string | null
  segment_name: string | null
  churn_risk: string | null
  total_spend: number
  transaction_count: number
  last_transaction_date: string | null
}

export interface CustomerProfile extends CustomerSummary {
  phone: string | null
  email: string | null
  loyalty_card_number: string | null
  wholesale_member_id: string | null
  barangay: string | null
  municipality: string | null
  registration_date: string
  credit_limit: number | null
  credit_terms_days: number | null
  status: string
  rfm_recency: number | null
  rfm_frequency: number | null
  rfm_monetary: number | null
  churn_probability: number | null
  top_risk_factor: string | null
  credit_risk_level: string | null
  credit_utilization: number | null
  outstanding_balance: number | null
  top_categories: { category: string; total: number }[]
  top_brands: { brand: string; count: number }[]
  monthly_spend: { month: string; total: number }[]
  recent_transactions: {
    transaction_id: string
    date: string
    branch_name: string
    transaction_type: string
    total_amount: number
    items_count: number
  }[]
  recommended_products: { product_name: string; confidence: number }[]
}

export interface WholesaleBuyer {
  customer_id: string
  first_name: string
  last_name: string
  business_name: string
  branch_name: string
  risk_score: number
  risk_level: string
  outstanding_balance: number
  credit_limit: number
  credit_utilization: number
  avg_days_overdue: number
  payment_trend: string
  order_frequency_trend: number
  basket_size_trend: number
  last_order_date: string
  top_risk_factor: string | null
  monthly_totals: { month: string; total: number }[]
}

export interface BranchData {
  branch_id: string
  branch_name: string
  municipality: string
  province: string
  revenue_this_month: number
  revenue_last_month: number
  revenue_change: number
  transaction_count: number
  avg_basket_size: number
  retail_revenue: number
  wholesale_revenue: number
  top_categories: { category: string; total: number }[]
}

export interface AnalysisTask {
  id: string
  name: string
  description: string
  last_run: string | null
  last_summary: string | null
  parameters: { key: string; label: string; type: 'select' | 'date'; options?: { value: string; label: string }[] }[]
}
