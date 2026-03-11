# Citimart Data-to-Decision Intelligence System — Design Document

**Date:** 2026-03-04
**Status:** Approved

## Overview

Predictive analytics and data-to-decision intelligence system for a 7-branch grocery chain. Demo/POC targeting business operators who have never used an analytics tool. Presents to the founding family to win a Phase 2 engagement.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | Firebase Auth (Google Sign-in) | Match jc-contact-center patterns |
| Database | Supabase Postgres + Drizzle ORM | User has existing Supabase account; Drizzle for type safety |
| ML Pipeline | AWS Lambda (Python container) | Full scikit-learn/Prophet support; EventBridge cron + on-demand |
| AI Chat | Gemini 2.0 Flash | Fast, cheap, good JSON output for intent classification |
| State Management | Redux Toolkit | Match jc-contact-center patterns |
| UI Components | Radix UI + CVA + Tailwind (shadcn-style) | Match jc-contact-center patterns |
| Branding | Brand-agnostic | No Citimart logos or branding in UI |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        VERCEL                           │
│                                                         │
│  ┌──────────────┐    ┌─────────────────────────────┐    │
│  │   Next.js    │    │   API Routes (withAuth)      │   │
│  │   Frontend   │───▶│                              │   │
│  │              │    │  /api/auth/*       → Firebase │   │
│  │  • Dashboard │    │  /api/chat         → Gemini   │   │
│  │  • Chat UI   │    │  /api/insights     → Supabase │   │
│  │  • DNA View  │    │  /api/customers    → Supabase │   │
│  │  • Wholesale │    │  /api/wholesale    → Supabase │   │
│  │  • Branches  │    │  /api/branches     → Supabase │   │
│  │  • Analytics │    │  /api/ml/trigger   → Lambda   │   │
│  └──────────────┘    └─────────────────────────────┘    │
│                                                         │
│  Vercel Cron (daily) → /api/cron/refresh-insights       │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┼──────────┐
        ▼         ▼          ▼
  ┌──────────┐ ┌────────┐ ┌─────────────────────────────┐
  │  Gemini  │ │Supabase│ │       AWS Lambda             │
  │  2.0     │ │Postgres│ │   (Python 3.11 container)    │
  │  Flash   │ │        │ │                               │
  │ Intent   │ │Drizzle │ │  • FP-Growth basket analysis  │
  │ classify │ │  ORM   │ │  • K-Means segmentation       │
  │ +        │ │        │ │  • Churn scoring (LogReg)     │
  │ Response │ │        │ │  • Credit risk scoring        │
  │ format   │ │        │ │  • Demand forecasting         │
  └──────────┘ └────────┘ └─────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14+ (App Router) | Server Components where possible |
| Styling | Tailwind CSS 3.x | Navy/teal palette, Inter font |
| Charts | Recharts 2.x | All inline visualizations |
| Icons | lucide-react | Same as jc-contact-center |
| Components | Radix UI + CVA | shadcn-style, same as jc-contact-center |
| State | Redux Toolkit | Feature slices per page |
| Auth | Firebase Auth | Google Sign-in, withAuth() middleware |
| Database | Supabase Postgres + Drizzle ORM | Serverless Postgres |
| AI | Gemini 2.0 Flash | Intent classification + response formatting |
| ML | Python 3.11 on AWS Lambda | scikit-learn, mlxtend, prophet |
| Deployment | Vercel + AWS | Frontend/API on Vercel, ML on Lambda |

## Authentication

Adapted from jc-contact-center (simplified — no cookie refresh, no IP tracking):

- Firebase client auth + Google provider (`signInWithPopup`)
- `AuthContext` + `useAuth` hook for client-side state
- `/api/auth/login` POST to acknowledge session server-side
- `/api/auth/me` GET for session restoration
- `withAuth()` HOF middleware on all API routes — verifies Firebase ID token
- `apiFetch` helper attaches Bearer token to all client requests

Login page: clean Google Sign-in button on navy/teal palette, no branding.

## Design System

### Color Tokens (CSS Variables)

```
--primary: #1B2A4A (deep navy)
--accent: #2A7F8E (teal)
--background: #F8F9FA (off-white)
--card: #FFFFFF
--destructive: #DC3545
--warning: #FFC107
--success: #28A745
--info: #2A7F8E
--text: #333333
```

### Components

Same CVA + Radix pattern as jc-contact-center:
- Button (default, destructive, outline, secondary, ghost variants)
- Card (Header, Title, Description, Content, Footer)
- Input, Select, Dialog, Badge, Tabs
- `cn()` utility (clsx + tailwind-merge)

### Layout

AppShell pattern: TopBar (page title + user avatar), collapsible icon Sidebar, content area.

Sidebar items: Dashboard, Chat, Customers, Wholesale, Branches, Analytics.

### Typography

Inter via Google Fonts. Currency: ₱ with commas, abbreviations for large numbers.

## Redux Store

```typescript
{
  nav: { activeView, sidebarCollapsed },
  chat: { messages[], isLoading, chartConfig, followUpSuggestions },
  customer: { customers[], selectedCustomer, filters, segments },
  wholesale: { buyers[], filters, sortBy },
  branch: { branchData[], selectedMetric, dateRange },
  analytics: { tasks[], runningTask, lastResults }
}
```

## Project Structure

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard
│   │   ├── chat/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx           # Customer DNA View
│   │   ├── wholesale/page.tsx
│   │   ├── branches/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── auth/{login,me}/route.ts
│   │       ├── chat/route.ts
│   │       ├── insights/route.ts
│   │       ├── customers/route.ts
│   │       ├── customers/[id]/route.ts
│   │       ├── wholesale/route.ts
│   │       ├── branches/route.ts
│   │       ├── ml/trigger/route.ts
│   │       └── cron/refresh-insights/route.ts
│   │
│   ├── components/
│   │   ├── ui/                         # Button, Card, Input, etc.
│   │   ├── layout/                     # AppShell, TopBar, Sidebar
│   │   ├── dashboard/
│   │   ├── chat/
│   │   ├── customers/
│   │   ├── wholesale/
│   │   ├── branches/
│   │   ├── analytics/
│   │   └── Providers.tsx
│   │
│   ├── contexts/AuthContext.tsx
│   ├── hooks/
│   ├── store/
│   │   ├── index.ts
│   │   └── slices/
│   ├── lib/
│   │   ├── auth-middleware.ts
│   │   ├── firebase.ts
│   │   ├── firebase-admin.ts
│   │   ├── supabase.ts
│   │   ├── api.ts
│   │   ├── gemini.ts
│   │   ├── lambda.ts
│   │   ├── utils.ts
│   │   └── intents/
│   ├── db/
│   │   ├── schema.ts
│   │   └── migrations/
│   └── types/index.ts
│
├── scripts/seed.ts
├── ml_pipeline/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── lambda_handler.py
│   └── ml_pipeline/
│       ├── basket_analysis.py
│       ├── segmentation.py
│       ├── churn_scoring.py
│       ├── credit_risk.py
│       └── demand_forecast.py
│
├── package.json
├── tailwind.config.ts
├── drizzle.config.ts
├── next.config.ts
└── tsconfig.json
```

## Database Schema

Full Postgres schema as specified in the original prompt — 13 tables:

**Core:** branches, products, customers, transactions, transaction_items, wholesale_payments

**ML Output:** customer_segments, churn_scores, credit_risk_scores, product_associations, demand_forecasts, insight_cards

All translated to Drizzle schema definitions in `db/schema.ts`.

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/login` | POST | No | Create session after Firebase sign-in |
| `/api/auth/me` | GET | Yes | Return current user |
| `/api/chat` | POST | Yes | Two-call Gemini (intent → query → format) |
| `/api/insights` | GET | Yes | Active insight cards |
| `/api/customers` | GET | Yes | Customer list with filters |
| `/api/customers/[id]` | GET | Yes | Full customer DNA profile |
| `/api/wholesale` | GET | Yes | Wholesale buyers + risk scores |
| `/api/branches` | GET | Yes | Branch comparison data |
| `/api/ml/trigger` | POST | Yes | Invoke Lambda function |
| `/api/cron/refresh-insights` | POST | Cron | Vercel Cron daily insight refresh |

## Gemini Integration

Two-call pattern per user question:

1. **Intent Classification** (temp 0.1, JSON mode): Classify user question into one of ~12 intents with parameters
2. **Query Execution**: Map intent → parameterized Drizzle query → execute against Supabase
3. **Response Formatting** (temp 0.4, JSON mode): Format query results into business-friendly text + Recharts config

12 supported intents: top_products, customer_purchase_trend, basket_analysis, wholesale_buyer_health, branch_comparison, customer_segmentation, churn_risk, price_sensitivity, seasonal_forecast, customer_profile, credit_risk, promo_impact, general_insight.

## ML Pipeline

AWS Lambda Python container with 5 modules:

1. **Basket Analysis** — FP-Growth via mlxtend, min_support=0.02, min_lift=1.5
2. **Customer Segmentation** — RFM scoring + K-Means (k=5)
3. **Churn Scoring** — Logistic Regression on transaction behavior features
4. **Credit Risk Scoring** — Logistic Regression on payment history features
5. **Demand Forecast** — Prophet with Philippine holiday calendar

Triggered by: EventBridge cron (nightly 10pm PHT) + on-demand via `/api/ml/trigger`.

## Seed Script

`scripts/seed.ts` generates:
- 7 branches
- 200-300 SKUs (Filipino FMCG brands)
- 500 retail + 80 wholesale + 15-20 dual customers
- 60,000-80,000 transactions with 200,000-300,000 line items (6 months)
- Wholesale payment records
- 10 intentionally embedded patterns for demo discovery

## Pages

1. **Dashboard** (`/`) — KPI summary bar + insight cards grid
2. **Chat** (`/chat`) — Two-column: chat thread (60%) + chart panel (40%)
3. **Customer List** (`/customers`) — Filterable list by segment/type
4. **Customer DNA** (`/customers/[id]`) — Unified profile (overview, purchase behavior, basket patterns, timeline)
5. **Wholesale Health** (`/wholesale`) — Filterable buyer cards with risk indicators
6. **Branch Comparison** (`/branches`) — Multi-chart comparison dashboard
7. **Analytics** (`/analytics`) — ML trigger control panel

## Environment Variables

```
# Supabase
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT=

# Gemini
GEMINI_API_KEY=

# AWS Lambda (Function URL)
LAMBDA_URL=https://your-function-url.lambda-url.ap-southeast-1.on.aws/
LAMBDA_API_KEY=optional-shared-secret

# App
NEXT_PUBLIC_APP_URL=
```
