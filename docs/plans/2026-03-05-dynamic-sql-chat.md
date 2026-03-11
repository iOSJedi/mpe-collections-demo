# Dynamic SQL Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the deterministic intent-routing chat with a dynamic SQL-generating AI that can handle complex, multi-step questions with conversation memory.

**Architecture:** Single Gemini 2.0 Flash call with function calling. The model receives the full DB schema + conversation history and has a `run_sql` tool it can call 1-5 times per turn. Each SQL call is wrapped in a read-only transaction. The response format (`answer_text`, `chart_config`, `follow_up_suggestions`) is unchanged.

**Tech Stack:** Gemini 2.0 Flash (function calling), `@google/generative-ai@0.24.1`, Drizzle ORM raw SQL, existing Recharts frontend

---

### Task 1: Create the new `gemini.ts` with tool-calling loop

**Files:**
- Rewrite: `app/src/lib/gemini.ts`

**Step 1: Write the new gemini.ts**

Replace the entire contents of `app/src/lib/gemini.ts` with:

```typescript
import { GoogleGenerativeAI, FunctionCallingMode, type Content, type Part } from '@google/generative-ai'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

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
  customer_type VARCHAR(10) NOT NULL, -- 'retail' or 'wholesale'
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
  transaction_type VARCHAR(10) NOT NULL, -- 'retail' or 'wholesale'
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

-- ML output tables
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
  risk_level VARCHAR(10) NOT NULL, -- 'low', 'medium', 'high'
  days_since_last INTEGER NOT NULL,
  frequency_change DECIMAL(5,2),
  basket_change DECIMAL(5,2),
  top_risk_factor VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE credit_risk_scores (
  customer_id VARCHAR(20) PRIMARY KEY REFERENCES customers(customer_id),
  risk_score DECIMAL(5,4) NOT NULL,
  risk_level VARCHAR(10) NOT NULL, -- 'low', 'medium', 'high'
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
`

const SYSTEM_PROMPT = `You are a business analytics assistant for JC Supermarket, a grocery chain in Batangas, Philippines. You help store owners and managers understand their data by querying the database and presenting insights.

## Database Schema
${SCHEMA_DDL}

## Tools

You have a \`run_sql\` tool that executes a read-only SQL query against the database and returns the rows. You can call it multiple times per turn (up to 5 calls) to answer complex questions — for example, first finding the top branches, then querying details for those branches.

## Rules

1. **Only write SELECT queries.** Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or TRUNCATE.
2. **Always use table and column names exactly as shown in the schema.** Column names use snake_case.
3. **Limit results.** Use LIMIT (default 20, max 50) to avoid huge result sets unless the user asks for everything.
4. **Use aggregation wisely.** For "top N" questions use ORDER BY ... DESC LIMIT N.
5. **Multiple queries are fine.** If the user asks something that requires multiple steps (e.g., "compare basket analysis for the 2 highest-revenue branches"), run a query to find the branches first, then query associations for each.
6. **Currency is Philippine Peso (₱).** Format amounts with ₱ and commas in your text response.
7. **Be conversational.** Write like you're talking to a non-technical store owner. Never mention SQL, queries, tables, or technical details.
8. **Use the conversation history** to understand follow-up questions. If the user says "compare that for the top 2 branches", look at what "that" refers to in the previous messages.

## Response Format

After you have all the data you need, respond with a JSON object (no markdown fences):
{
  "answer_text": "Your business-friendly response (2-4 sentences with specific numbers)",
  "chart_config": null or chart object,
  "follow_up_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

## Chart Configuration

Include chart_config ONLY when data has 3+ data points and is meaningfully visualizable.

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

const runSqlDeclaration = {
  name: 'run_sql',
  description: 'Execute a read-only SQL SELECT query against the PostgreSQL database and return the result rows.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'A SELECT SQL query to execute. Must be read-only.',
      },
    },
    required: ['query'],
  },
}

async function executeSql(query: string): Promise<unknown[]> {
  const result = await db.execute(sql.raw(`BEGIN TRANSACTION READ ONLY; ${query}; COMMIT;`))
  return Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []
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
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations: [runSqlDeclaration] }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    generationConfig: { temperature: 0.2 },
    systemInstruction: SYSTEM_PROMPT,
  })

  // Build conversation contents for Gemini
  const contents: Content[] = messages.map((m) => ({
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
    const query = functionCall.functionCall.args?.query as string

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

  // Parse the final text response
  const text = response.text()
  try {
    return JSON.parse(text)
  } catch {
    // If Gemini didn't return valid JSON, wrap the text
    return {
      answer_text: text,
      follow_up_suggestions: [],
    }
  }
}
```

**Step 2: Verify it compiles**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization/app && npx next build
```

If there are import errors for `FunctionCallingMode` or `Content` or `Part`, check the installed `@google/generative-ai` version — these types exist in v0.24.1. If `sql.raw` doesn't exist in Drizzle's pg-proxy driver, try using the db callback directly (see troubleshooting in Step 3).

**Step 3: Troubleshooting — if `sql.raw` doesn't work with pg-proxy**

The pg-proxy driver may not support `db.execute(sql.raw(...))`. If so, replace the `executeSql` function with a direct fetch to the Edge Function:

```typescript
async function executeSql(query: string): Promise<unknown[]> {
  const wrappedQuery = `BEGIN TRANSACTION READ ONLY; ${query}; COMMIT;`
  const response = await fetch(process.env.SUPABASE_SQL_PROXY_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.SUPABASE_SQL_PROXY_KEY!,
    },
    body: JSON.stringify({ sql: wrappedQuery, params: [], method: 'all' }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`SQL error: ${body}`)
  }
  const { rows } = await response.json()
  return rows
}
```

This bypasses Drizzle entirely and talks directly to the Edge Function. Remove the `db` and `sql` imports if using this approach.

**Step 4: Commit**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
git add app/src/lib/gemini.ts
git commit -m "feat: rewrite gemini.ts with dynamic SQL tool calling"
```

---

### Task 2: Update the chat API route

**Files:**
- Rewrite: `app/src/app/api/chat/route.ts`

**Step 1: Write the new route**

Replace the entire contents of `app/src/app/api/chat/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { chat, type ChatMessage } from '@/lib/gemini'

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const { question, messages: clientMessages } = await request.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const currentDate = new Date().toISOString().split('T')[0]

    // Build conversation history from client messages + current question
    const history: ChatMessage[] = (clientMessages || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )
    // Add current question
    history.push({ role: 'user', content: question })

    const result = await chat(history, currentDate)

    return NextResponse.json({
      answer_text: result.answer_text,
      chart_config: result.chart_config || null,
      follow_up_suggestions: result.follow_up_suggestions || [],
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        answer_text:
          'Sorry, I encountered an error processing your question. Please try again.',
        chart_config: null,
        follow_up_suggestions: [
          'What are the top selling products?',
          'Show me branch performance',
        ],
      },
      { status: 200 }
    )
  }
})
```

**Step 2: Commit**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
git add app/src/app/api/chat/route.ts
git commit -m "feat: update chat route to pass conversation history"
```

---

### Task 3: Send conversation history from the frontend

**Files:**
- Modify: `app/src/app/chat/page.tsx`

**Step 1: Update `useSendQuestion` to pass messages**

In `app/src/app/chat/page.tsx`, modify the `useSendQuestion` hook. The only change is in the `apiFetch` call — add `messages` to the request body. The messages should be the current Redux messages array (before adding the new user message), mapped to `{ role, content }`.

Replace the `useSendQuestion` function (lines 24-77) with:

```typescript
function useSendQuestion() {
  const dispatch = useAppDispatch()
  const messagesRef = useRef<{ role: string; content: string }[]>([])

  // Keep a ref of messages for the closure
  const messages = useAppSelector((state) => state.chat.messages)
  useEffect(() => {
    messagesRef.current = messages.map((m) => ({ role: m.role, content: m.content }))
  }, [messages])

  return useCallback(
    async (question: string) => {
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: question,
        timestamp: Date.now(),
      }
      dispatch(addMessage(userMsg))
      dispatch(setLoading(true))
      dispatch(setFollowUpSuggestions([]))

      try {
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            messages: messagesRef.current,
          }),
        })

        if (!res.ok) throw new Error('Chat request failed')

        const data = await res.json()

        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: data.answer_text ?? 'I could not generate a response. Please try again.',
          chartConfig: data.chart_config ?? null,
          followUpSuggestions: data.follow_up_suggestions ?? [],
          timestamp: Date.now(),
        }
        dispatch(addMessage(assistantMsg))
        dispatch(setCurrentChart(data.chart_config ?? null))
        dispatch(setFollowUpSuggestions(data.follow_up_suggestions ?? []))
      } catch (err) {
        console.error('Chat error:', err)
        const errorMsg = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant' as const,
          content:
            'Sorry, I was unable to process your request. Please check your connection and try again.',
          timestamp: Date.now(),
        }
        dispatch(addMessage(errorMsg))
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )
}
```

Note: Add `useEffect` and `useRef` to the import on line 3 (they are already imported).

**Step 2: Verify build**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization/app && npx next build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
git add app/src/app/chat/page.tsx
git commit -m "feat: send conversation history with chat requests"
```

---

### Task 4: Delete the old intent system files

**Files:**
- Delete: `app/src/lib/intents/system-prompt.ts`
- Delete: `app/src/lib/intents/formatting-prompt.ts`
- Delete: `app/src/lib/intents/queries.ts`

**Step 1: Check for other imports of these files**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
grep -r "intents/" app/src/ --include="*.ts" --include="*.tsx"
```

Expected: Only `gemini.ts` (old version) and `route.ts` (old version) imported these — both have been rewritten and no longer reference them. If any other file imports from `intents/`, update that file first.

The `app/src/app/api/cron/refresh-insights/route.ts` may import from `intents/queries.ts` for generating insight cards. If so, **do NOT delete `queries.ts`** — only delete `system-prompt.ts` and `formatting-prompt.ts`. Check before deleting.

**Step 2: Delete the files**

```bash
rm app/src/lib/intents/system-prompt.ts
rm app/src/lib/intents/formatting-prompt.ts
# Only delete queries.ts if nothing else imports it:
rm app/src/lib/intents/queries.ts
# Remove directory if empty:
rmdir app/src/lib/intents/ 2>/dev/null || true
```

**Step 3: Verify build still passes**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization/app && npx next build
```

**Step 4: Commit**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
git add -A
git commit -m "chore: remove old intent classification system"
```

---

### Task 5: Deploy and test

**Step 1: Push to trigger Vercel deploy**

```bash
cd /home/josef/projects/jc-trade-promotion-optimization
git push origin master
```

**Step 2: Wait for deployment to be READY**

Check Vercel deployment status. Wait until state is READY.

**Step 3: Test the chat**

Open https://jc-trade-promotion-optimization.vercel.app/chat and test these conversations:

1. Simple: "What are the top 5 selling products?"
2. Follow-up: "How do those compare at the Lipa branch?"
3. Multi-step: "What products are frequently bought together?" then "Compare that for the 2 branches with the highest revenue"
4. Complex: "Show me the monthly revenue trend and highlight which months had the most churn risk customers"

Verify:
- Responses include specific numbers with ₱ formatting
- Charts render when appropriate
- Follow-up suggestions appear
- Conversation context is maintained across messages
