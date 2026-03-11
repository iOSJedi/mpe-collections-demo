import { GoogleGenerativeAI, FunctionCallingMode, SchemaType, type Content, type Part, type FunctionDeclaration } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SCHEMA_DDL = `
-- Core tables
CREATE TABLE branches (
  branch_id VARCHAR(10) PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  address VARCHAR(300),
  municipality VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL DEFAULT 'Batangas',
  opening_date DATE,
  floor_area_sqm INTEGER,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE products (
  product_id VARCHAR(20) PRIMARY KEY,
  product_name VARCHAR(200) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  department VARCHAR(50) NOT NULL,
  retail_price DECIMAL(8,2) NOT NULL,
  wholesale_price DECIMAL(8,2) NOT NULL,
  supplier VARCHAR(200),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE customers (
  customer_id VARCHAR(20) PRIMARY KEY,
  customer_type VARCHAR(10) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(200),
  loyalty_card_number VARCHAR(20),
  wholesale_member_id VARCHAR(20),
  business_name VARCHAR(200),
  barangay VARCHAR(100),
  municipality VARCHAR(100),
  registration_date DATE NOT NULL,
  credit_limit DECIMAL(10,2),
  credit_terms_days INTEGER,
  status VARCHAR(10) NOT NULL DEFAULT 'active'
);

CREATE TABLE transactions (
  transaction_id VARCHAR(30) PRIMARY KEY,
  customer_id VARCHAR(20) REFERENCES customers(customer_id),
  branch_id VARCHAR(10) NOT NULL REFERENCES branches(branch_id),
  transaction_date TIMESTAMP NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  payment_method VARCHAR(10) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  items_count INTEGER NOT NULL,
  loyalty_points_earned INTEGER DEFAULT 0
);

CREATE TABLE transaction_items (
  item_id BIGSERIAL PRIMARY KEY,
  transaction_id VARCHAR(30) NOT NULL REFERENCES transactions(transaction_id),
  product_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  is_wholesale_price BOOLEAN DEFAULT false
);

CREATE TABLE wholesale_payments (
  payment_id VARCHAR(20) PRIMARY KEY,
  customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  days_overdue INTEGER DEFAULT 0,
  outstanding_balance DECIMAL(10,2) NOT NULL
);

CREATE TABLE customer_segments (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  segment_name VARCHAR(50) NOT NULL,
  rfm_recency INTEGER NOT NULL,
  rfm_frequency INTEGER NOT NULL,
  rfm_monetary DECIMAL(10,2) NOT NULL,
  r_score INTEGER NOT NULL,
  f_score INTEGER NOT NULL,
  m_score INTEGER NOT NULL,
  cluster_id INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE churn_scores (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  churn_probability DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  days_since_last INTEGER NOT NULL,
  frequency_change DECIMAL(5,2),
  basket_change DECIMAL(5,2),
  top_risk_factor VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE credit_risk_scores (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  risk_score DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL,
  outstanding_balance DECIMAL(10,2),
  credit_utilization DECIMAL(5,2),
  avg_days_overdue DECIMAL(5,1),
  payment_trend VARCHAR(20),
  top_risk_factor VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_associations (
  id SERIAL PRIMARY KEY,
  product_a_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  product_b_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  support DECIMAL(6,4) NOT NULL,
  confidence_a_to_b DECIMAL(6,4) NOT NULL,
  confidence_b_to_a DECIMAL(6,4) NOT NULL,
  lift DECIMAL(8,4) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  branch_id VARCHAR(10),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demand_forecasts (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(20) REFERENCES products(product_id),
  category VARCHAR(100),
  branch_id VARCHAR(10) REFERENCES branches(branch_id),
  forecast_date DATE NOT NULL,
  predicted_quantity DECIMAL(10,2) NOT NULL,
  lower_bound DECIMAL(10,2),
  upper_bound DECIMAL(10,2),
  based_on_period VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE insight_cards (
  id SERIAL PRIMARY KEY,
  severity VARCHAR(15) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  action TEXT,
  related_intent VARCHAR(50),
  related_params JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Pre-joined summary views (USE THESE FIRST to minimize queries)

-- Product performance: pre-joins products + transaction_items + transactions
-- Columns: product_id, product_name, brand, category, department, retail_price, wholesale_price, branch_id, month, transaction_type, transaction_count, total_quantity, total_revenue, avg_unit_price
CREATE VIEW v_product_performance AS ...;

-- Branch performance: pre-joins transactions + branches
-- Columns: branch_id, branch_name, month, transaction_type, transaction_count, unique_customers, total_revenue, avg_transaction_value, total_items
CREATE VIEW v_branch_performance AS ...;

-- Customer overview: pre-joins customers + segments + churn + credit risk + transaction aggregates
-- Columns: customer_id, customer_type, full_name, business_name, municipality, registration_date, credit_limit, segment, churn_risk, churn_probability, days_since_last, churn_factor, credit_risk, credit_risk_score, credit_outstanding, payment_trend, total_spend, transaction_count, last_transaction, avg_transaction_value
CREATE VIEW v_customer_overview AS ...;
`

const SYSTEM_PROMPT = `You are a business analytics assistant for JC Supermarket, a grocery chain in Batangas, Philippines. You help store owners and managers understand their data by querying the database and presenting insights.

## Database Schema
${SCHEMA_DDL}

## Tools

You have a \`run_sql\` tool that executes a read-only SQL SELECT query against the database and returns the result rows. You can call it multiple times per turn (up to 5 calls) to answer complex questions — for example, first finding the top branches, then querying details for those branches.

## Data Date Range

The transaction data spans from September 2025 to February 2026. If the user asks about "this month" or a period with no data, query for the most recent available period instead and note the date range in your response.

## Rules

1. **Only write SELECT queries.** Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or TRUNCATE.
2. **Always use table and column names exactly as shown in the schema.** Column names use snake_case.
3. **Prefer summary views.** Use `v_product_performance`, `v_branch_performance`, and `v_customer_overview` instead of manually joining base tables. These views already have the joins done — one query is usually enough. Only query base tables when you need data not in the views (e.g., product_associations, demand_forecasts, wholesale_payments).
4. **Minimize queries.** Aim for 1-2 queries per answer, max 3. Combine filters (WHERE + GROUP BY) in a single query rather than running separate queries. The views make this easy.
5. **Limit results.** Use LIMIT (default 20, max 50) to avoid huge result sets unless the user asks for everything.
6. **Use aggregation wisely.** For "top N" questions use ORDER BY ... DESC LIMIT N.
7. **Currency is Philippine Peso (₱).** Format amounts with ₱ and commas in your text response.
8. **Be conversational.** Write like you're talking to a non-technical store owner. Never mention SQL, queries, tables, or technical details.
9. **Use the conversation history** to understand follow-up questions. If the user says "compare that for the top 2 branches", look at what "that" refers to in the previous messages.
10. **ALWAYS query data first.** Never ask for clarification when you can provide a useful default answer. If the user doesn't specify a branch, query across ALL branches. If they don't specify retail/wholesale, query BOTH. If they don't specify a date range, use the most recent available data. Always show results first — the user can refine later.
11. **ALWAYS use the run_sql tool.** Every response should be backed by at least one SQL query. Never give a generic response without querying the database first.

## Handling What-If and Simulation Questions

When a user asks "what if I do X" (discounts, promotions, pricing changes, etc.), follow this approach in a SINGLE query:

1. **Query the current data** for the product/brand/category in question from `v_product_performance` — get total_revenue, total_quantity, avg_unit_price, and transaction_count.
2. **Calculate the impact in your response** (not in SQL). For example: "10% discount on Century Tuna → current monthly revenue ₱X, discount reduces per-unit price by ₱Y, direct revenue impact = -₱Z at current volume."
3. **Add context** from the same query: which branches sell the most, monthly trend, retail vs wholesale split.
4. **Check product_associations** (optional, second query) to suggest bundle opportunities: "Century Tuna buyers also frequently buy [product], consider a combo promotion."
5. **Present a range**: conservative (volume stays flat → net loss) and optimistic (volume increases 15-25% from promotion → potential net gain).

This should take 1-2 queries, not 4-5.

## Response Format

After you have all the data you need, respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON. No markdown fences, no explanations outside the JSON — ONLY the JSON object:
{
  "answer_text": "Your business-friendly response (2-4 sentences with specific numbers)",
  "chart_config": null or chart object,
  "follow_up_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

CRITICAL: Your final response must be a single JSON object and nothing else. All conversational text goes INSIDE the "answer_text" field.

## Chart Configuration

Include chart_config ONLY when data has 3+ data points and is meaningfully visualizable.

**Choosing the right chart type:**
- **pie**: Use for composition/share breakdowns where parts make up a whole (e.g., revenue share by category, customer segment distribution, retail vs wholesale split, payment method breakdown, branch share of total revenue). Best with 3-7 slices. Use a single yKey.
- **bar**: Use for comparing magnitudes across categories or rankings (e.g., top 10 products by revenue, branch revenue comparison, side-by-side metrics). Best when the focus is "which is bigger" rather than "what share".
- **line**: Use for trends over time (e.g., monthly revenue, weekly transaction counts, spending trends). Requires chronological xKey.
- **area**: Use for cumulative or volume trends over time (e.g., cumulative sales, demand forecasts with ranges). Similar to line but emphasizes volume.

**Rule of thumb:** If the question is about proportions, shares, or "what percentage", use **pie**. If about rankings or comparison, use **bar**. If about change over time, use **line** or **area**.

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

Always provide 2-3 follow-up questions a store owner might ask next. Conversational tone, relevant to current topic.`

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
    model: 'gemini-3.1-pro-preview',
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
