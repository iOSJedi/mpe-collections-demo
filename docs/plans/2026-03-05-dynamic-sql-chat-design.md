# Dynamic SQL Chat — Design Document

## Problem

The current chat AI uses deterministic intent classification → hardcoded query routing. It cannot handle complex or multi-step questions like "What products are frequently bought together? Now compare that for the 2 branches with highest sales." Each question maps to exactly one predefined SQL query.

## Solution

Replace the 3-stage pipeline (classify intent → execute hardcoded query → format response) with a single Gemini call that has a `run_sql` tool. Gemini writes and executes SQL dynamically, can call it multiple times per turn, and has full conversation history for follow-up context.

## Architecture

**New flow:**
```
question + chat history + schema → Gemini with run_sql tool → (calls run_sql 1-N times) → final answer with chart
```

Single Gemini 2.0 Flash call with function calling. The model receives:
- Full DB schema as SQL DDL in the system prompt
- Conversation history (all previous user + assistant messages)
- A `run_sql` tool it can invoke 1-5 times per turn

Gemini decides what SQL to run, inspects results, optionally runs more queries, then produces the final response with the same shape: `{ answer_text, chart_config, follow_up_suggestions }`.

## API Changes

`POST /api/chat` request body adds `messages[]` (conversation history). Backend loops: send to Gemini → if function call, execute SQL, feed results back → repeat until Gemini produces final text. Cap at 5 SQL calls per turn.

Response shape unchanged: `{ answer_text, chart_config, follow_up_suggestions }`.

## Safety

- Every `run_sql` call wraps the query in `BEGIN TRANSACTION READ ONLY; ... COMMIT;`
- Postgres rejects any mutation (INSERT, UPDATE, DELETE, DROP) at the transaction level
- System prompt also instructs SELECT-only
- Max 5 tool calls per turn

## System Prompt

Provides:
- Role: Business analytics assistant for JC Supermarket, Batangas Philippines
- Full DDL schema (all 12 tables)
- `run_sql` tool definition
- Philippine Peso formatting, conversational tone
- Chart config JSON structure + color palette (same as current formatting prompt)
- Rules: SELECT only, max 5 tool calls, max 12 chart data points

## Files Changed

- Replace: `app/src/lib/gemini.ts` — new `chat()` function with tool calling loop
- Replace: `app/src/app/api/chat/route.ts` — pass messages array, call `chat()`
- Modify: chat page/components — send conversation history with each request
- Delete: `app/src/lib/intents/system-prompt.ts`, `formatting-prompt.ts`, `queries.ts`

## Unchanged

- Auth middleware (`withAuth`)
- ChartPanel component (same chart_config format)
- Redux chatSlice state shape
- Response JSON structure
