# Ayala Land Collections & Payments Portal — Demo Script

**URL:** https://mpe-payments-demo.vercel.app
**Duration:** ~20 minutes
**Prerequisite:** Reseed data via Settings (gear icon) > Re-seed Data before the demo

---

## Act 1: Dashboard Overview (2 min)

1. Log in with Google
2. Land on the **Overview** dashboard
3. Highlight the KPI cards: total receivables, overdue amounts, collection rate
4. Show the **Aging Chart** — buckets of overdue invoices (Current, 1-30, 31-60, 61-90, 90+)
5. Point out **AI Insight Cards** — auto-generated action items from the ML pipeline

> **Talking point:** "This is the operations command center. Everything updates daily from our ML pipeline."

---

## Act 2: Penalty & Payment Breakdown (4 min)

### 2a. Admin view — Overdue tenant with penalties

1. Navigate to **Receivable** > click on **Pottery Barn Philippines** (Greenbelt 5)
2. Show the **Invoice Breakdown** section:
   - 6 overdue invoices with color-coded aging badges (red 90+ days, amber 30-60)
   - Each invoice shows: Principal, Penalty (months x 2%), Paid, Balance
   - Total penalties: ~₱249,264
3. Show the **Payment History** with allocation detail — each payment shows exactly which invoice and whether it went to PRINCIPAL or PENALTY
4. Point out the **Summary Bar**: Total Principal, Total Penalties, Total Paid, Grand Total Due

> **Talking point:** "Every peso is accounted for. The system breaks down exactly how payments are applied — penalties first by default, which protects Ayala Land's revenue position."

### 2b. Penalty settings

1. Open **Settings** (gear icon in sidebar)
2. Show **Penalty Configuration**:
   - Penalty Rate: 2% per month (configurable)
   - Grace Period: 0 days
   - Application Method: toggle between "Penalties First" (landlord-friendly) and "FIFO" (payer-friendly)
3. Change the rate to 3% and save, then change back to 2%

> **Talking point:** "The penalty rate, grace period, and application method are all configurable without code changes."

### 2c. Payer portal — QR code payment with breakdown

1. Open the **Emulator** (bottom-right button) in **Payer** mode
2. Select **Pottery Barn Philippines**
3. Go to **Invoices** tab, select an overdue invoice
4. Switch to **QR** tab, generate a QR code
5. Click the payment link (or copy it)
6. On the payment page, show:
   - **Balance Breakdown**: all overdue invoices with penalty calculations per month
   - Total due with principal/penalty split
7. Click **Partial Payment**, enter a partial amount (e.g., ₱500,000)
8. Show the **dynamic calculator**:
   - "How your payment will be applied" (green) — penalties cleared first
   - "Still outstanding" (red) — remaining balance with warning about continued accrual

> **Talking point:** "The payer sees exactly what they owe and what happens if they pay partially. Full transparency drives faster collections."

---

## Act 3: Credit Balance & Overpayment (2 min)

1. Navigate to **Receivable** > click on **Uniqlo Philippines Inc.** (Greenbelt 5, TEN0001)
2. Show the **Credit Balance Card** in the sidebar:
   - Credit Balance: ₱4,540.00
   - Source: "Overpayment credit applied from prior invoice"
3. Click **Apply to Invoice** — show the dialog listing outstanding invoices
4. Show the **Credit History** log (CREDIT entries in green)
5. Mention the **Refund** option

> **Talking point:** "When a tenant overpays, the excess automatically becomes a credit. The admin can apply it to future invoices or issue a refund — no manual reconciliation needed."

---

## Act 4: Security Deposit Forfeiture (3 min)

### 4a. Customer with active forfeiture

1. Stay on Receivable, navigate to **Samsung Experience Store** (Greenbelt 3)
2. Show the **Security Deposit Card**:
   - Initial: ₱2,514,216 / Current: ₱2,114,262 / Forfeited: ₱399,954
   - Forfeiture history: one APPROVED entry for INV-202510-00049

### 4b. Fully exhausted deposit

1. Navigate to **Solenad Cinemas (Ayala Malls Cinemas)** (Solenad 3, Nuvali)
2. Show deposit card: Initial: ₱1,400,940 / Current: ₱0 / Forfeited: ₱1,400,940
3. Point out: "This tenant's entire deposit has been consumed by forfeitures"

### 4c. Forfeiture approval queue

1. Navigate to **Collections** > **Forfeitures** tab
2. Show the pending forfeiture for **JP Morgan Chase Bank N.A.** (INV-202510-00100, ₱518,688, FLAGGED)
3. Demo the **Approve Forfeiture** action — click approve
4. Show the status change to APPROVED
5. Navigate back to the customer to show the deposit balance reduced

### 4d. Settings

1. Open Settings > show **Deposit Forfeiture** threshold: "Auto-flag after 90 days overdue"
2. Explain: "Invoices overdue beyond this threshold are automatically flagged for deposit forfeiture. An admin must approve before any deduction occurs."

> **Talking point:** "No money moves without approval, but the system proactively flags accounts that need attention."

---

## Act 5: Supplier Workflow & AP Timeline (4 min)

### 5a. Supplier submits a claim (Emulator)

1. Open **Emulator** > switch to **Supplier** mode
2. Select supplier: **EEI Corporation**
3. Select a PO (e.g., PO-ALI-000008)
4. Click **Submit Claim / Invoice**
5. On the newly created claim, click **Upload Delivery Report**
6. Click **Check Payment Status** — show the timeline:
   - CLAIM SUBMITTED (green)
   - DELIVERY REPORT UPLOADED (green)
   - Remaining steps greyed out (GR Confirmed, 3-Way Match, AP Clerk, FM, etc.)

### 5b. AP Clerk approves (Admin side)

1. Navigate to **Payables** > **Approval Queue** tab
2. Set role dropdown to **AP Clerk**
3. Find the claim under "Pending My Review"
4. Click **View Timeline** — show the workflow progress
5. Click **Approve**

### 5c. Finance Manager authorizes (Admin side)

1. Switch role to **Finance Manager**
2. Find the claim (now at FM review stage)
3. Click **Authorize Payment**
4. System auto-fires: FM Approved → Payment Scheduled → Payment Released

### 5d. Supplier sees completion (Emulator)

1. Switch back to Emulator > Supplier mode
2. Click **Check Payment Status** on the same claim
3. Timeline now shows all 8 steps in green — fully completed

> **Talking point:** "Both sides have real-time visibility. The supplier tracks their payment, Ayala Land controls the approval gates."

---

## Act 6: Milestone Payments (3 min)

### 6a. PO with milestone progress

1. Navigate to **Payables** > click on supplier **EEI Corporation**
2. Expand PO **PO-ALI-000008** (₱1,478,692) — click "Milestones"
3. Show the **Milestone Progress** visualization:
   - Stacked progress bar: green (Mobilization — PAID), amber (Mid-Delivery — COMPLETED), grey (Final Acceptance — PENDING)
   - Milestone cards with amounts (20% / 40% / 40% of ₱1,478,692)
   - "Release Payment" button on the COMPLETED milestone
4. Click **Release Payment** on the Mid-Delivery milestone
5. Show it change to PAID with payment reference

### 6b. Supplier marks milestone complete (Emulator)

1. Open Emulator > Supplier mode
2. Select **Siemens Philippines Inc.**, PO-ALI-000031
3. Show the **PO Milestones** section with progress bar
4. Click **Mark Complete** on the next pending milestone
5. Show the status change from PENDING to COMPLETED

### 6c. Milestone templates

1. Mention that templates are configurable: "Standard 20/40/40", "Equal Split 50/50", "Full on Completion"
2. These can be assigned to any PO

> **Talking point:** "For construction and delivery contracts, milestone-based payments ensure Ayala Land only pays for completed work."

---

## Act 7: Check Payments (2 min)

### 7a. Check payment in the system

1. Navigate to **Receivable** > click **Uniqlo Philippines Inc.**
2. In the payment history, find the CHECK payments:
   - CHK-1001 / CHK-1002: **PENDING CLEARANCE** — with clearance progress bar
   - CHK-1003: **CONFIRMED** — cleared and processed
   - CHK-1004: **BOUNCED** — check bounced
3. Show the **clearance progress bar** (days elapsed / 3 days)
4. Demo **Confirm Early** button (for urgent processing)
5. Show the **View Deposit Slip** button — opens the AI document viewer

### 7b. Check payment from payer portal (optional live demo)

1. From the Emulator, generate a QR code for a Uniqlo invoice
2. Open the payment link
3. On the payment page, select **Check Payment** (instead of Card)
4. Walk through: enter check number, bank name, see clearing notice
5. Upload a deposit slip (any image)
6. Submit — show PENDING_CLEARANCE status

> **Talking point:** "Check payments have a 3-day clearing window. The AI automatically verifies deposit slips, and admins can track clearance progress or confirm early if needed."

---

## Act 8: Document AI Analysis (2 min)

1. Navigate to **Collections** > **Documents** tab
2. Click **View** on a document
3. Show the **side-by-side viewer**:
   - Left: uploaded document image
   - Right: AI-extracted fields with match/mismatch indicators
   - Confidence score (green ≥ 85%, amber 60-85%, red < 60%)
4. Point out a mismatch scenario if available
5. Show the action buttons: Confirm Payment / Flag for Review

> **Talking point:** "Gemini Vision extracts and cross-references every field. Mismatches are flagged instantly — no manual checking of deposit slips."

---

## Act 9: AI Chat Assistant (1 min)

1. Open the **AI Chat** (bottom of sidebar)
2. Ask: "How much does Pottery Barn Philippines owe in total including penalties?"
3. Show the AI executing SQL queries and returning a formatted answer
4. Ask: "Which tenants have the highest delinquency risk?"
5. Show the AI pulling from ML scores

> **Talking point:** "Natural language access to the entire system. No dashboards to build — just ask."

---

## Closing (1 min)

Recap the key differentiators:
1. **Full transparency** — both payer and admin see the same breakdown
2. **Configurable business rules** — penalty rates, application methods, forfeiture thresholds
3. **AI-powered** — document verification, risk scoring, natural language queries
4. **End-to-end AP workflow** — from supplier claim to two-level approval with timeline
5. **Milestone payments** — pay only for completed work
6. **Multiple payment methods** — card, bank transfer, check with clearing
7. **Credit management** — overpayments automatically tracked and applicable

---

## Quick Reference — Key Accounts for Demo

| Account | Property | What to show |
|---------|----------|--------------|
| Pottery Barn Philippines | Greenbelt 5 | 6 overdue invoices, ₱249K penalties, payment breakdown |
| Uniqlo Philippines Inc. | Greenbelt 5 | ₱4,540 credit balance, check payments (CHK-1001 to 1004) |
| Samsung Experience Store | Greenbelt 3 | Security deposit partially forfeited (₱400K) |
| Solenad Cinemas | Solenad 3, Nuvali | Deposit fully exhausted (₱0 balance) |
| JP Morgan Chase Bank N.A. | Tower One | FLAGGED forfeiture awaiting approval (₱519K) |
| EEI Corporation | (Supplier) | PO-ALI-000008: milestones at 20% paid, 40% completed, 40% pending |
| Siemens Philippines Inc. | (Supplier) | PO-ALI-000031: milestones to demo Mark Complete |
| Monark Equipment Corp. | (Supplier) | SINV-000015: GR_CONFIRMED workflow stage |
