import { GoogleGenerativeAI, FunctionCallingMode, SchemaType, type Content, type Part, type FunctionDeclaration } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SCHEMA_DDL = `
-- ─── ACCOUNTS RECEIVABLE ──────────────────────────────────────

CREATE TABLE customers_col (
  customer_id SERIAL PRIMARY KEY,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL,                   -- TENANT | PROPERTY_MANAGER
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(20),
  business_type VARCHAR(100),
  property_name VARCHAR(200),
  unit_info VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contracts_col (
  contract_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  contract_number VARCHAR(30) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL,                   -- LEASE | CONCESSION | SERVICE
  description TEXT,
  monthly_amount DECIMAL(12,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices_col (
  invoice_id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts_col(contract_id),
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_remaining DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | PARTIALLY_PAID | PAID | OVERDUE
  issued_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE incoming_payments_col (
  payment_id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices_col(invoice_id),
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_date TIMESTAMP DEFAULT NOW(),
  stripe_payment_intent_id VARCHAR(200),
  reference_number VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | CONFIRMED | FAILED
  confirmed_at TIMESTAMP
);

CREATE TABLE qr_codes_col (
  qr_id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices_col(invoice_id),
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  contract_number VARCHAR(30) NOT NULL,
  account_identifier VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  encoded_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE documents_col (
  document_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  invoice_id INTEGER REFERENCES invoices_col(invoice_id),
  payment_id INTEGER REFERENCES incoming_payments_col(payment_id),
  file_url TEXT NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  ocr_result JSONB,
  ocr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | COMPLETED | FAILED
  validation_result JSONB,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escalations_col (
  escalation_id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents_col(document_id),
  customer_id INTEGER NOT NULL REFERENCES customers_col(customer_id),
  invoice_id INTEGER REFERENCES invoices_col(invoice_id),
  type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  ai_analysis JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN | IN_REVIEW | RESOLVED
  assigned_to VARCHAR(200),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- ─── ACCOUNTS PAYABLE ─────────────────────────────────────────

CREATE TABLE suppliers_col (
  supplier_id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL,
  contact_person VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(20),
  tax_id VARCHAR(30),
  bank_details JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_orders_col (
  po_id SERIAL PRIMARY KEY,
  po_number VARCHAR(30) NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers_col(supplier_id),
  project_name VARCHAR(200) NOT NULL,
  description TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  issued_date DATE NOT NULL,
  expected_delivery DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',  -- OPEN | PARTIALLY_RECEIVED | RECEIVED | CLOSED
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE goods_receipts_col (
  receipt_id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders_col(po_id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers_col(supplier_id),
  receipt_number VARCHAR(30) NOT NULL,
  received_date DATE NOT NULL,
  received_by VARCHAR(200),
  description TEXT,
  quantity_received DECIMAL(12,2),
  unit VARCHAR(20),
  amount DECIMAL(12,2) NOT NULL,
  condition_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE supplier_invoices_col (
  supplier_invoice_id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers_col(supplier_id),
  po_id INTEGER NOT NULL REFERENCES purchase_orders_col(po_id),
  invoice_number VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  submitted_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PARTIAL | PAID
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE outgoing_payments_col (
  outgoing_payment_id SERIAL PRIMARY KEY,
  supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices_col(supplier_invoice_id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers_col(supplier_id),
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_date TIMESTAMP DEFAULT NOW(),
  reference_number VARCHAR(100),
  approved_by VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | COMPLETED | FAILED
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE three_way_matches_col (
  match_id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders_col(po_id),
  receipt_id INTEGER NOT NULL REFERENCES goods_receipts_col(receipt_id),
  supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices_col(supplier_invoice_id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers_col(supplier_id),
  match_status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',  -- MATCHED | MISMATCH | PENDING_REVIEW
  po_amount DECIMAL(12,2) NOT NULL,
  receipt_amount DECIMAL(12,2) NOT NULL,
  invoice_amount DECIMAL(12,2) NOT NULL,
  discrepancies JSONB,
  ai_notes TEXT,
  reviewed_by VARCHAR(200),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── ML OUTPUT TABLES ─────────────────────────────────────────

CREATE TABLE payer_segments_col (
  segment_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers_col(customer_id),
  segment_name VARCHAR(50) NOT NULL,   -- e.g. 'RELIABLE_PAYER', 'CHRONIC_LATE', 'ERRATIC'
  regularity_score DECIMAL(5,2) NOT NULL,
  amount_score DECIMAL(5,2) NOT NULL,
  timeliness_score DECIMAL(5,2) NOT NULL,
  cluster_id INTEGER NOT NULL,
  scored_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE delinquency_scores_col (
  delinquency_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers_col(customer_id),
  risk_score DECIMAL(5,4) NOT NULL,    -- 0.0 to 1.0
  risk_level VARCHAR(10) NOT NULL,     -- LOW | MEDIUM | HIGH | CRITICAL
  days_overdue_avg DECIMAL(6,1),
  missed_payments INTEGER DEFAULT 0,
  payment_trend VARCHAR(20),           -- IMPROVING | STABLE | WORSENING
  top_risk_factor VARCHAR(100),
  scored_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE credit_risk_scores_col (
  credit_risk_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers_col(customer_id),
  risk_score DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL,     -- LOW | MEDIUM | HIGH | CRITICAL
  outstanding_balance DECIMAL(12,2),
  credit_utilization DECIMAL(5,2),
  avg_days_overdue DECIMAL(6,1),
  payment_trend VARCHAR(20),
  scored_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE insight_cards_col (
  id SERIAL PRIMARY KEY,
  severity VARCHAR(15) NOT NULL,       -- info | warning | alert | opportunity
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  action TEXT,
  related_entity_type VARCHAR(20),
  related_entity_id INTEGER,
  related_params JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE TABLE cash_flow_forecasts_col (
  forecast_id SERIAL PRIMARY KEY,
  forecast_date DATE NOT NULL,
  predicted_inflow DECIMAL(14,2) NOT NULL,
  predicted_outflow DECIMAL(14,2) NOT NULL,
  confidence_lower DECIMAL(14,2),
  confidence_upper DECIMAL(14,2),
  based_on_period VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_patterns_col (
  pattern_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers_col(customer_id),
  avg_days_to_pay DECIMAL(6,1),
  preferred_method VARCHAR(20),
  typical_payment_day INTEGER,
  partial_payment_rate DECIMAL(5,2),
  scored_at TIMESTAMP DEFAULT NOW()
);

-- Virtual views for the AI to reference:
-- v_customer_overview: customer_id, account_number, type, name, property_name,
--   segment_name (from payer_segments_col), delinquency risk_level (from delinquency_scores_col),
--   total_receivable (SUM invoices_col.balance_remaining), overdue_amount, last_payment_date
-- v_supplier_overview: supplier_id, name, category, type,
--   total_payable (SUM supplier_invoices_col unpaid), open_pos (COUNT), blocked_invoices (COUNT mismatches)
-- v_three_way_match: match_id, po_number, supplier name, project_name,
--   po_amount, receipt_amount, invoice_amount, match_status, payment_status
`

const SYSTEM_PROMPT = `You are the Ayala Land Collections & Payments Portal AI assistant. You help financial analysts explore and understand accounts receivable, accounts payable, and collections data.

## Database Schema
${SCHEMA_DDL}

## Tools

You have a \`run_sql\` tool that executes a read-only SQL SELECT query against the database and returns the result rows. You can call it multiple times per turn (up to 5 calls) to answer complex questions.

## Data Context

The database contains:
- ACCOUNTS RECEIVABLE: 50 customers (30 tenants, 20 property managers) across Ayala Land properties. Each has contracts, monthly invoices (Oct 2025–Mar 2026), and payment records.
- ACCOUNTS PAYABLE: 20 suppliers providing construction, engineering, and building materials for Ayala Land development projects. Each has purchase orders, goods receipts, and supplier invoices with 3-way matching (GR/IR reconciliation).
- COLLECTIONS: Document verification with OCR, AI validation, and escalation workflow.
- ML INSIGHTS: Payer segmentation, delinquency scores, credit risk scores, payment patterns, cash flow forecasts, and AI-generated insight cards.

Currency: Philippine Peso (PHP, ₱). Format amounts with ₱ prefix.
Date range: October 2025 through March 2026.

## Rules

1. **Only generate SELECT queries** (no INSERT, UPDATE, DELETE).
2. **Always include LIMIT clauses** (default 20, max 50).
3. **When asked about customers**, include their property/business context.
4. **When asked about risk**, join with delinquency_scores and credit_risk_scores.
5. **For receivables analysis**, aggregate from invoices (balance_remaining).
6. **For payables analysis**, aggregate from supplier_invoices (amount - amount_paid).
7. **For 3-way matching**, show PO amount vs receipt amount vs invoice amount.
8. **Explain your findings in business context** — write for financial analysts, not developers.
9. **Currency is Philippine Peso (₱)**. Format amounts with ₱ and commas.
10. **ALWAYS query data first.** Never ask for clarification when you can provide a useful default answer.
11. **ALWAYS use the run_sql tool.** Every response should be backed by at least one SQL query.

## Response Format

After you have all the data you need, respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON. No markdown fences, no explanations outside the JSON — ONLY the JSON object:
{
  "answer_text": "Your analyst-friendly response (2-4 sentences with specific numbers)",
  "chart_config": null or chart object,
  "follow_up_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

CRITICAL: Your final response must be a single JSON object and nothing else. All conversational text goes INSIDE the "answer_text" field.

## Chart Configuration

Include chart_config ONLY when data has 3+ data points and is meaningfully visualizable.

**Choosing the right chart type:**
- **pie**: Use for composition/share breakdowns (e.g., risk level distribution, segment distribution, payment method split).
- **bar**: Use for comparing magnitudes across categories (e.g., top overdue customers, payables by supplier).
- **line**: Use for trends over time (e.g., monthly collections, cash flow forecast).
- **area**: Use for cumulative or volume trends (e.g., cumulative receivables, inflow vs outflow over time).

Chart object structure:
{
  "type": "bar" | "line" | "pie" | "area",
  "title": "Short descriptive title",
  "data": [{ "xValue": "Label", "metric1": 100 }, ...],
  "xKey": "xValue",
  "yKeys": [{ "key": "metric1", "color": "#3b82f6", "name": "Display Name" }],
  "interpretation": "One sentence about what the chart shows."
}

Color palette: #3b82f6 (blue), #10b981 (green), #f59e0b (orange), #ef4444 (red), #8b5cf6 (purple), #ec4899 (pink), #06b6d4 (cyan), #6366f1 (indigo).

Keep chart data to 12 data points max. Sort logically (chronological or descending for rankings).

## Follow-up Suggestions

Always provide 2-3 follow-up questions a financial analyst might ask next. Conversational tone, relevant to current topic.`

const MAX_TOOL_CALLS = 5

const runSqlDeclaration: FunctionDeclaration = {
  name: 'run_sql',
  description: 'Execute a read-only SQL SELECT query against the PostgreSQL database and return the result rows.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'A SELECT SQL query to execute. Must be read-only.',
      },
    },
    required: ['query'],
  },
}

async function executeSql(query: string): Promise<unknown[]> {
  const response = await fetch(process.env.SUPABASE_SQL_PROXY_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.SUPABASE_SQL_PROXY_KEY!,
    },
    body: JSON.stringify({ sql: query, params: [], method: 'all' }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`SQL error: ${body}`)
  }
  const { rows } = await response.json()
  return rows
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  messages: ChatMessage[],
  currentDate: string
): Promise<{
  answer_text: string
  chart_config?: {
    type: 'bar' | 'line' | 'pie' | 'area'
    title: string
    data: Record<string, unknown>[]
    xKey: string
    yKeys: { key: string; color: string; name: string }[]
    interpretation?: string
  }
  follow_up_suggestions: string[]
}> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro-preview-05-06',
    tools: [{ functionDeclarations: [runSqlDeclaration] }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    generationConfig: { temperature: 0.2 },
    systemInstruction: SYSTEM_PROMPT,
  })

  // Build conversation contents for Gemini, filtering empty messages
  const contents: Content[] = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.role === 'user' ? `[${currentDate}] ${m.content}` : m.content }],
    }))

  let result = await model.generateContent({ contents })
  let response = result.response
  let toolCalls = 0

  // Tool-calling loop
  while (toolCalls < MAX_TOOL_CALLS) {
    const candidate = response.candidates?.[0]
    if (!candidate) break

    const functionCall = candidate.content.parts.find(
      (p: Part) => 'functionCall' in p
    )

    if (!functionCall || !('functionCall' in functionCall)) break

    toolCalls++
    const args = functionCall.functionCall!.args as Record<string, unknown> | undefined
    const query = (args?.query ?? '') as string

    let rows: unknown[]
    try {
      rows = await executeSql(query)
    } catch (e) {
      rows = [{ error: (e as Error).message }]
    }

    // Feed the result back to Gemini
    contents.push(
      { role: 'model', parts: candidate.content.parts },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            name: 'run_sql',
            response: { rows: rows.slice(0, 100) },
          },
        }],
      }
    )

    result = await model.generateContent({ contents })
    response = result.response
  }

  // If we exhausted tool calls and the last response is still a function call,
  // ask Gemini to answer with the data it has gathered so far
  const lastCandidate = response.candidates?.[0]
  if (lastCandidate?.content.parts.some((p: Part) => 'functionCall' in p)) {
    contents.push(
      { role: 'model', parts: lastCandidate.content.parts },
      {
        role: 'user',
        parts: [{ text: 'You have reached the query limit. Please answer now using the data you have already gathered.' }],
      }
    )
    result = await model.generateContent({ contents })
    response = result.response
  }

  // Parse the final text response — extract JSON even if Gemini wraps it with extra text
  let text = ''
  try {
    text = response.text()
  } catch {
    // response.text() throws if there are no text parts
  }

  if (text.trim()) {
    try {
      const parsed = JSON.parse(text)
      if (parsed.answer_text) return parsed
    } catch {
      // Try to extract a JSON object from the text
      const jsonMatch = text.match(/\{[\s\S]*"answer_text"[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.answer_text) return parsed
        } catch { /* fall through */ }
      }
      // Use the raw text as answer if it's not empty
      if (text.trim()) {
        return {
          answer_text: text.replace(/\{[\s\S]*"answer_text"[\s\S]*\}/, '').trim(),
          follow_up_suggestions: [],
        }
      }
    }
  }

  return {
    answer_text: 'I wasn\'t able to generate a complete answer for that question. Could you try rephrasing it?',
    follow_up_suggestions: [],
  }
}
