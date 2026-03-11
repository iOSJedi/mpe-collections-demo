# MPE Collections Portal — Design Spec

**Date:** 2026-03-10
**Project:** mpe-collections-demo
**Client context:** Ayala Land Corporation — Collections & Payments Department

## Overview

Repurpose the JC Trade Promotion Optimization demo into an Ayala Land Collections & Payments Portal. The system manages both **Accounts Receivable** (customers paying Ayala Land) and **Accounts Payable** (Ayala Land paying suppliers), with AI-powered document verification, QR code payment flows, and 3-way matching.

### Three Interfaces

1. **Collections Dashboard** — Admin view for collections staff. SAP Fiori-style navigation with Spaces → Pages → Sections. Manages customers, suppliers, payments, documents, escalations, and AI chat.
2. **Customer Emulator** — Popover panel within the dashboard. Lets the presenter demo as any customer in the system — view invoices, display QR codes, upload proof-of-payment.
3. **Payment Page** — Public route (`/pay?token=...`) accessed by scanning the QR code. Mobile-first, shows invoice details, supports full/partial payment via credit card (Stripe, no branding) or BPI bank transfer (emulated).

## Branding

- Ayala Land brand treatment: dark green (`#003B1F`) primary, gold (`#C5A930`) accent
- SAP S/4 HANA Fiori terminology throughout

## Terminology (SAP S/4 HANA Conventions)

| Concept | SAP Term Used |
|---|---|
| Tenant / Payer | **Customer** (Business Partner, FI-AR role) |
| Vendor / Merchant | **Supplier** (Business Partner, FI-AP role) |
| Invoice to customer | **Customer Invoice** |
| Invoice from supplier | **Supplier Invoice** |
| Payment received | **Incoming Payment** |
| Payment sent | **Outgoing Payment** |
| 3-Way Match | **GR/IR Reconciliation** |

## Infrastructure

- **Framework:** Next.js (existing, App Router)
- **Database:** Supabase PostgreSQL + SQL Proxy edge function (existing)
- **ORM:** Drizzle ORM (existing)
- **Auth:** Firebase Auth (Google OAuth) for admin; mock auth for Customer Emulator
- **AI:** Gemini (existing) — SQL chat, multimodal OCR, document validation
- **Payments:** Stripe (PaymentIntent flow, no branding) + BPI bank transfer (emulated)
- **State:** Redux Toolkit (existing)
- **ML Pipeline:** AWS Lambda + Docker (existing, repurposed)
- **Deployment:** Vercel (frontend) + Supabase (DB)

## Database Schema

### Core Domain — Accounts Receivable

#### `customers`
| Column | Type | Notes |
|---|---|---|
| customer_id | serial PK | |
| type | enum | `TENANT` \| `PROPERTY_MANAGER` |
| name | varchar | Company/person name |
| contact_person | varchar | |
| email | varchar | |
| phone | varchar | |
| business_type | varchar | e.g. "Retail", "F&B", "Property Management" |
| property_name | varchar | e.g. "Greenbelt 5", "Ayala Triangle Tower 2" |
| unit_info | varchar | e.g. "Unit 301, 3F" |
| account_number | varchar unique | e.g. "CUST-0017" — used as `acct` in QR JWT |
| status | enum | `ACTIVE` \| `INACTIVE` \| `SUSPENDED` |
| created_at | timestamp | |

**Seed:** 30 tenants (mall/office lessees at Ayala properties) + 20 property management companies = 50 customers.

#### `contracts`
| Column | Type | Notes |
|---|---|---|
| contract_id | serial PK | |
| customer_id | FK → customers | |
| contract_number | varchar unique | e.g. "ALC-2024-00123" |
| type | enum | `LEASE` \| `CONCESSION` \| `SERVICE` |
| description | text | Lease/service details |
| monthly_amount | decimal | PHP |
| start_date | date | |
| end_date | date | |
| status | enum | `ACTIVE` \| `EXPIRED` \| `TERMINATED` |
| created_at | timestamp | |

#### `invoices` (Customer Invoices)
| Column | Type | Notes |
|---|---|---|
| invoice_id | serial PK | |
| contract_id | FK → contracts | |
| customer_id | FK → customers | |
| invoice_number | varchar unique | e.g. "INV-2026-03-00001" |
| billing_period_start | date | |
| billing_period_end | date | |
| due_date | date | |
| amount | decimal | Total invoice amount (PHP) |
| balance_remaining | decimal | Tracks partial payments |
| status | enum | `PENDING` \| `PARTIAL` \| `PAID` \| `OVERDUE` |
| issued_at | timestamp | |

#### `payments` (Incoming Payments)
| Column | Type | Notes |
|---|---|---|
| payment_id | serial PK | |
| invoice_id | FK → invoices | |
| customer_id | FK → customers | |
| amount | decimal | Amount paid (PHP) |
| payment_method | enum | `STRIPE` \| `BPI_TRANSFER` \| `CHECK` \| `CASH` |
| payment_date | timestamp | |
| stripe_payment_intent_id | varchar nullable | |
| reference_number | varchar nullable | Bank reference |
| status | enum | `PENDING` \| `CONFIRMED` \| `FAILED` \| `REFUNDED` |
| confirmed_at | timestamp nullable | |

#### `qr_codes`
| Column | Type | Notes |
|---|---|---|
| qr_id | serial PK | |
| invoice_id | FK → invoices | |
| customer_id | FK → customers | |
| contract_number | varchar | Embedded in QR |
| account_identifier | varchar | Embedded in QR |
| amount | decimal | Embedded in QR |
| encoded_url | text | Full /pay?token=... URL |
| created_at | timestamp | |
| expires_at | timestamp | |

#### `documents` (Proof-of-Payment)
| Column | Type | Notes |
|---|---|---|
| document_id | serial PK | |
| customer_id | FK → customers | Who uploaded |
| invoice_id | FK → invoices nullable | |
| payment_id | FK → payments nullable | |
| file_url | text | Stored file location |
| file_name | varchar | |
| file_type | varchar | image/pdf |
| ocr_result | jsonb | Extracted fields from Gemini |
| ocr_status | enum | `PENDING` \| `PROCESSED` \| `FAILED` |
| validation_result | jsonb | AI validation output |
| uploaded_at | timestamp | |

#### `escalations`
| Column | Type | Notes |
|---|---|---|
| escalation_id | serial PK | |
| document_id | FK → documents | |
| customer_id | FK → customers | |
| invoice_id | FK → invoices | |
| type | enum | `AMOUNT_MISMATCH` \| `PAYER_MISMATCH` \| `DATE_MISMATCH` \| `DUPLICATE` \| `OTHER` |
| description | text | AI-generated explanation |
| ai_analysis | jsonb | Full AI analysis details |
| status | enum | `OPEN` \| `IN_REVIEW` \| `RESOLVED` \| `DISMISSED` |
| assigned_to | varchar nullable | Staff member |
| resolution_notes | text nullable | |
| created_at | timestamp | |
| resolved_at | timestamp nullable | |

### Core Domain — Accounts Payable

#### `suppliers`
| Column | Type | Notes |
|---|---|---|
| supplier_id | serial PK | |
| name | varchar | e.g. "SteelAsia Manufacturing Corp." |
| category | varchar | e.g. "Steel & Rebar", "Cement & Concrete" |
| type | enum | `CONTRACTOR` \| `SUPPLIER` \| `CONSULTANT` \| `SERVICE_PROVIDER` |
| contact_person | varchar | |
| email | varchar | |
| phone | varchar | |
| tax_id | varchar | TIN |
| bank_details | jsonb | For payment |
| status | enum | `ACTIVE` \| `INACTIVE` \| `BLACKLISTED` |
| created_at | timestamp | |

**Seed:** 20 real Ayala Land ecosystem suppliers:
1. SteelAsia Manufacturing Corp. (Steel & Rebar, SUPPLIER)
2. Holcim Philippines, Inc. (Cement & Concrete, SUPPLIER)
3. Republic Cement & Building Materials (Cement, SUPPLIER)
4. Eagle Cement Corporation (Cement, SUPPLIER)
5. Megawide Construction Corp. (General Contractor, CONTRACTOR)
6. EEI Corporation (General Contractor, CONTRACTOR)
7. MC Engineering, Inc. (MEP Contractor, CONTRACTOR)
8. GNQ Industrial & Contracting Corp. (HVAC Contractor, CONTRACTOR)
9. KONE Philippines (Elevators & Escalators, SUPPLIER)
10. Otis Elevator Company Philippines (Elevators & Escalators, SUPPLIER)
11. Palafox Associates (Architecture & Design, CONSULTANT)
12. AECOM Philippines (Engineering Consulting, CONSULTANT)
13. Servicio Filipino, Inc. (Facilities Management, SERVICE_PROVIDER)
14. ServiceMaster Philippines (Facilities / Cleaning, SERVICE_PROVIDER)
15. SAP SE (Enterprise Software, SERVICE_PROVIDER)
16. Tata Consultancy Services (IT Services, SERVICE_PROVIDER)
17. PwC Isla Lipana & Co. (Audit & Advisory, CONSULTANT)
18. ACCRALAW (Legal Services, CONSULTANT)
19. FPG Insurance (Insurance & Surety, SERVICE_PROVIDER)
20. Pacific Paint (Boysen) Philippines (Paints & Coatings, SUPPLIER)

#### `purchase_orders`
| Column | Type | Notes |
|---|---|---|
| po_id | serial PK | |
| po_number | varchar unique | e.g. "PO-2026-00451" |
| supplier_id | FK → suppliers | |
| project_name | varchar | e.g. "Parklinks Tower 3" |
| description | text | What's being ordered |
| total_amount | decimal | PHP |
| issued_date | date | |
| expected_delivery | date | |
| status | enum | `OPEN` \| `PARTIALLY_RECEIVED` \| `FULLY_RECEIVED` \| `CLOSED` \| `CANCELLED` |
| created_at | timestamp | |

#### `goods_receipts`
| Column | Type | Notes |
|---|---|---|
| receipt_id | serial PK | |
| po_id | FK → purchase_orders | |
| supplier_id | FK → suppliers | |
| receipt_number | varchar | e.g. "GR-2026-00812" |
| received_date | date | |
| received_by | varchar | Site engineer name |
| description | text | What was received |
| quantity_received | decimal | |
| unit | varchar | e.g. "tons", "units", "sqm" |
| amount | decimal | Value of goods received |
| condition_notes | text nullable | |
| created_at | timestamp | |

#### `supplier_invoices`
| Column | Type | Notes |
|---|---|---|
| supplier_invoice_id | serial PK | |
| supplier_id | FK → suppliers | |
| po_id | FK → purchase_orders | |
| invoice_number | varchar | Supplier's own invoice # |
| amount | decimal | PHP |
| submitted_date | date | |
| due_date | date | |
| payment_status | enum | `UNPAID` \| `PARTIAL` \| `PAID` |
| amount_paid | decimal | Tracks partial payments |
| payment_date | date nullable | |
| created_at | timestamp | |

#### `outgoing_payments`
| Column | Type | Notes |
|---|---|---|
| outgoing_payment_id | serial PK | |
| supplier_invoice_id | FK → supplier_invoices | |
| supplier_id | FK → suppliers | |
| amount | decimal | Amount paid (PHP) |
| payment_method | enum | `BANK_TRANSFER` \| `CHECK` |
| payment_date | timestamp | |
| reference_number | varchar nullable | Bank reference or check number |
| approved_by | varchar nullable | Staff who approved |
| status | enum | `PENDING` \| `APPROVED` \| `RELEASED` \| `CONFIRMED` |
| created_at | timestamp | |

#### `three_way_matches`
| Column | Type | Notes |
|---|---|---|
| match_id | serial PK | |
| po_id | FK → purchase_orders | |
| receipt_id | FK → goods_receipts | |
| supplier_invoice_id | FK → supplier_invoices | |
| supplier_id | FK → suppliers | |
| match_status | enum | `FULL_MATCH` \| `PARTIAL_MATCH` \| `MISMATCH` \| `PENDING_REVIEW` |
| po_amount | decimal | Snapshot for comparison |
| receipt_amount | decimal | Snapshot for comparison |
| invoice_amount | decimal | Snapshot for comparison |
| discrepancies | jsonb | Array of {field, expected, actual, severity} |
| ai_notes | text | Gemini's analysis of the match |
| reviewed_by | varchar nullable | |
| reviewed_at | timestamp nullable | |
| created_at | timestamp | |

### ML Output Tables (Repurposed)

All ML output tables use upsert on `customer_id` — only the latest score is stored (no history). `scored_at` tracks when the score was last computed.

#### `payer_segments`
| Column | Type | Notes |
|---|---|---|
| segment_id | serial PK | |
| customer_id | FK → customers, unique | |
| segment_name | varchar | |
| regularity_score | decimal | Payment regularity |
| amount_score | decimal | Amount consistency |
| timeliness_score | decimal | On-time payment |
| cluster_id | int | |
| scored_at | timestamp | |

#### `delinquency_scores`
| Column | Type | Notes |
|---|---|---|
| delinquency_id | serial PK | |
| customer_id | FK → customers, unique | |
| risk_score | decimal | 0-1 |
| risk_level | enum | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` |
| days_overdue_avg | decimal | |
| missed_payments | int | |
| payment_trend | varchar | |
| top_risk_factor | varchar | |
| scored_at | timestamp | |

#### `credit_risk_scores`
| Column | Type | Notes |
|---|---|---|
| credit_risk_id | serial PK | |
| customer_id | FK → customers, unique | |
| risk_score | decimal | |
| risk_level | enum | |
| outstanding_balance | decimal | |
| credit_utilization | decimal | |
| avg_days_overdue | decimal | |
| payment_trend | varchar | |
| scored_at | timestamp | |

#### `insight_cards` (kept from original)
| Column | Type | Notes |
|---|---|---|
| insight_id | serial PK | |
| severity | varchar | `critical` \| `warning` \| `info` |
| title | varchar | |
| body | text | |
| action | varchar | Suggested action |
| related_entity_type | varchar nullable | `customer` \| `supplier` \| `invoice` \| `match` |
| related_entity_id | int nullable | FK to the relevant entity |
| related_params | jsonb | Additional context for AI chat deep-links |
| is_active | boolean | |
| created_at | timestamp | |

Generated by the ML pipeline's `/api/cron/refresh-insights` endpoint. Queries recent data across AR/AP tables and uses Gemini to generate actionable insight cards (e.g., "5 customers have overdue balances exceeding ₱500K", "3 supplier invoices blocked due to GR/IR mismatch").

#### `cash_flow_forecasts`
| Column | Type | Notes |
|---|---|---|
| forecast_id | serial PK | |
| forecast_date | date | The future date being predicted |
| predicted_inflow | decimal | Expected incoming payments (PHP) |
| predicted_outflow | decimal | Expected outgoing payments (PHP) |
| confidence_lower | decimal | Lower bound |
| confidence_upper | decimal | Upper bound |
| based_on_period | varchar | Historical period used |
| created_at | timestamp | |

#### `payment_patterns`
| Column | Type | Notes |
|---|---|---|
| pattern_id | serial PK | |
| customer_id | FK → customers | |
| avg_days_to_pay | decimal | Average days from invoice to payment |
| preferred_method | varchar | Most used payment method |
| typical_payment_day | int nullable | Day of month they usually pay |
| partial_payment_rate | decimal | % of invoices paid partially |
| scored_at | timestamp | |

## Navigation (SAP Fiori-Style Sidebar)

### Spaces (Sidebar Items)

1. **Overview** — Dashboard with KPI tiles (Total Receivables, Overdue Receivables, DSO, Blocked Invoices), aging analysis, top overdue customers, insight cards
2. **Accounts Receivable**
   - Page: Customer Accounts — Business partner list (type: Customer), detail view with contracts/invoices/payments, customer line items
   - Page: Incoming Payments — Payment log (all methods), QR payment link generation, proof-of-payment documents
3. **Accounts Payable**
   - Page: Supplier Accounts — Business partner list (type: Supplier), detail view with POs/invoices/payments, supplier line items
   - Page: GR/IR Reconciliation — 3-way matching table (PO ↔ Receipt ↔ Invoice), release blocked invoices, discrepancy drill-down
4. **Collections Management**
   - Page: Collections Worklist — Prioritized customer list by overdue amount. Data source: query `invoices` grouped by `customer_id` where `status IN ('OVERDUE', 'PARTIAL')`, enriched with `delinquency_scores.risk_level` and `payment_patterns`. Columns: Customer Name, Type, Total Overdue, Oldest Invoice, Risk Level, Last Payment Date, Days Overdue. Actions per row: View Customer, Send Reminder, Create Escalation.
   - Page: Document Verification — Uploaded proof-of-payment documents, OCR results, AI validation flags
   - Page: Escalation Queue — AI-flagged discrepancies, human review workflow, resolution tracking
5. **Intelligence**
   - Page: AI Assistant — Natural language queries via Gemini + SQL, chart generation
   - Page: Insights & Scoring — Insight cards, delinquency risk scores, payer segmentation
   - Page: Analytics — Cash flow forecasts (from `cash_flow_forecasts` table), collection performance trends (computed from `payments` aggregates), credit risk heatmaps (from `credit_risk_scores`)

### Bottom Bar
- Current user info
- **Customer Emulator** button (popover trigger, gold accent)

## QR Code & Payment Flow

### QR Code Generation
- Generated per invoice via `qrcode` npm package
- Encodes a JWT-signed URL: `/pay?token=<jwt>`
- JWT payload: `{ inv, con, acct, amt, bal, due, exp }`
- Signed with server secret to prevent tampering
- Configurable expiry

### Payment Page (`/pay?token=...`)
- Public route, no auth required
- Mobile-first design with Ayala Land branding
- Decodes and verifies JWT token; server re-validates amount against database (not just JWT) before creating PaymentIntent
- Displays: invoice number, contract number, customer name, due date, balance due
- Payment amount: toggle between Pay Full and Pay Partial (editable amount, server-validated)
- Payment methods:
  - **Credit / Debit Card** — Stripe PaymentIntent flow, Stripe Elements with custom styling for card input, NO Stripe branding visible (use `appearance` API to hide badge)
  - **BPI Bank Transfer** — Emulated; shows BPI account details for manual transfer. The Payment Page itself includes a proof-of-payment upload option so the mobile user can photograph and upload their receipt directly after transferring. This triggers the same OCR pipeline as the Customer Emulator upload.
- On successful card payment: update invoice balance_remaining, set status to PARTIAL or PAID, create incoming payment record, invalidate the used QR code
- On partial payment: invalidate current QR, generate new QR for remaining balance

> **Demo scope note:** The QR/JWT payment flow is designed for demo purposes. In production, additional security would be needed (one-time-use tokens, rate limiting, anti-replay). For the demo, JWT signing + expiry provides sufficient tamper-proofing.

## Customer Emulator (Popover)

- Triggered by gold "Customer Emulator" button in bottom bar
- Popover panel (not slide-out)
- **Customer selector:** dropdown of all 50 seeded customers, shows type badges
- **Tabs:**
  - My Invoices — list of customer's invoices with status (OVERDUE/PENDING/PAID), shows contract number per invoice, "Show QR" and "Upload Proof" actions per invoice
  - QR Codes — displays generated QR code for selected invoice, scannable by phone camera, shows embedded contract/account details
  - Upload Proof — file upload for proof-of-payment (check photo, bank slip, transfer screenshot), triggers OCR pipeline
  - History — payment history for selected customer

Contracts are visible as a grouping mechanism within the customer detail view (admin side, AR → Customer Accounts → detail) and as a reference label on invoices. They are not independently managed — the demo focuses on invoices and payments.

## OCR & AI Validation Pipeline

### Upload → OCR
1. Customer uploads image/PDF via emulator's "Upload Proof" tab
2. File stored (Supabase Storage or local)
3. Image sent to Gemini Vision (multimodal) with extraction prompt
4. Gemini returns JSON: `{ payment_amount, payment_date, reference_number, bank_name, payee_name, payer_name, document_type }`
5. OCR result stored in `documents.ocr_result`

### AI Validation
After OCR extraction, Gemini validates against system records:
- **PAYER_MISMATCH:** Payer name on receipt ≠ customer who uploaded
- **AMOUNT_MISMATCH:** Amount on receipt ≠ invoice balance
- **DATE_MISMATCH:** Payment date is before invoice issue or suspiciously far from upload date
- **DUPLICATE:** Reference number already used in a prior payment

### Outcomes
- **All checks pass:** Auto-create incoming payment record (status: PENDING), link payment to document (`documents.payment_id`), update invoice balance, mark document as validated. Admin can then confirm the payment to move it to CONFIRMED.
- **Discrepancy found:** Create escalation record, link to document (`escalations.document_id`), add to escalation queue, notify via Firebase RTDB. No payment is created until escalation is resolved.

## Escalation & Human Handoff

### Escalation Queue (Admin View)
- Table showing: Customer, Document ID, Issue Type, Status, Action
- Status workflow: OPEN → IN_REVIEW → RESOLVED / DISMISSED
- Click "Review" opens detail panel

### Review Detail
- AI analysis text explaining the discrepancy
- Side-by-side comparison: OCR-extracted data vs system invoice record
- Resolution actions: Accept Anyway, Reject, Request Reupload
- Resolution notes field
- Assigned staff tracking

### Real-time Notifications
- Firebase RTDB for real-time escalation notifications (like jc-contact-center's conversation queue)
- Notifications are ephemeral (RTDB only, not persisted to Postgres) — sufficient for demo purposes
- RTDB path: `collections/escalations/{escalation_id}` with status, type, customer name
- New escalations appear with animated badge in sidebar
- Queue sorted: OPEN first, then by creation time

## ML Pipeline (Repurposed)

Keep existing AWS Lambda + Docker infrastructure. Repurpose models:

| Original | Repurposed | Purpose |
|---|---|---|
| Customer Segmentation | **Payer Segmentation** | Segment customers by payment behavior (regularity, amount, timeliness) |
| Churn Scoring | **Delinquency Risk Scoring** | Predict likelihood of late/missed payments |
| Credit Risk | **Credit Risk** (stays) | Assess customer creditworthiness |
| Basket Analysis | **Payment Pattern Analysis** | Identify payment timing/method patterns |
| Demand Forecasting | **Cash Flow Forecasting** | Predict incoming cash flows by period |

## AI Chat (Gemini)

Keep existing Gemini + SQL function calling architecture. Update:
- System prompt: Ayala Land collections assistant (not JC Supermarket)
- Schema DDL: updated to reflect all new tables
- Can query both AR and AP data
- Can answer questions about: payment details, customer history, invoice validation, 3-way match status, delinquency risk
- Can flag discrepancies and explain AI validation results
- Generates charts for: aging analysis, collection trends, cash flow forecasts

## Seed Data

### 30 Tenants (Customers, type: TENANT)
Realistic mall and office tenants across Ayala Land properties (Greenbelt, Glorietta, Ayala Triangle, One Ayala, Ayala North Exchange, etc.)

### 20 Property Managers (Customers, type: PROPERTY_MANAGER)
Third-party property management companies managing Ayala Land residential developments

### 20 Suppliers
Real Ayala Land ecosystem suppliers (see suppliers table seed data above)

### Transactional Data
- 3-6 months of invoices per customer
- Mix of PAID, PARTIAL, PENDING, OVERDUE statuses
- Payment records with various methods
- Purchase orders, goods receipts, and supplier invoices for 3-way matching
- Pre-seeded 3-way matches with mix of FULL_MATCH, PARTIAL_MATCH, MISMATCH
- Sample documents with OCR results
- 2-3 pre-seeded escalations in various states

## Approach

**Fresh domain, borrowed infrastructure (Approach B):**
- Keep: auth, DB connection, Supabase proxy, Drizzle setup, UI primitives, layout shell, Redux patterns, Gemini integration, ML pipeline structure
- Replace: all domain-specific pages, components, API routes, schema, types, seed data
- Add: QR generation, payment page, Stripe integration, OCR pipeline, escalation system, Customer Emulator, 3-way matching
