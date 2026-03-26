export const metadata = {
  title: 'Demo Script — Ayala Land Collections & Payments Portal',
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#003B1F] border-b border-[#1a4a2f] shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Ayala Land Collections & Payments Portal</h1>
            <p className="text-sm text-[#C5A930]">End-to-End Demo Script</p>
          </div>
          <a href="/" className="text-sm text-[#C5A930] hover:text-white transition-colors border border-[#C5A930] px-3 py-1.5 rounded">
            Open App &rarr;
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Intro */}
        <div className="mb-10 p-6 rounded-lg bg-[#111] border border-[#222]">
          <p className="text-sm text-[#888] mb-2">Duration: ~20 minutes &middot; Prerequisite: Reseed data via Settings before demo</p>
          <p className="text-sm text-[#aaa]">This script walks through all major features with specific accounts and data points. Follow each act sequentially for the best narrative flow.</p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 p-5 rounded-lg bg-[#0d1a0d] border border-[#1a3a1a]">
          <h2 className="text-sm font-semibold text-[#C5A930] uppercase tracking-wider mb-3">Contents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {[
              { id: 'act-1', label: 'Act 1: Dashboard Overview', time: '2 min' },
              { id: 'act-2', label: 'Act 2: Penalty & Payment Breakdown', time: '4 min' },
              { id: 'act-3', label: 'Act 3: Credit Balance & Overpayment', time: '2 min' },
              { id: 'act-4', label: 'Act 4: Security Deposit Forfeiture', time: '3 min' },
              { id: 'act-5', label: 'Act 5: Supplier Workflow & AP Timeline', time: '4 min' },
              { id: 'act-6', label: 'Act 6: Milestone Payments', time: '3 min' },
              { id: 'act-7', label: 'Act 7: Check Payments', time: '2 min' },
              { id: 'act-8', label: 'Act 8: Document AI Analysis', time: '2 min' },
              { id: 'act-9', label: 'Act 9: AI Chat Assistant', time: '1 min' },
            ].map((item) => (
              <a key={item.id} href={`#${item.id}`} className="flex justify-between items-center px-3 py-1.5 rounded hover:bg-[#1a2e1a] transition-colors">
                <span className="text-[#ccc]">{item.label}</span>
                <span className="text-[#666] text-xs">{item.time}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Acts */}
        <div className="space-y-16">

          {/* Act 1 */}
          <section id="act-1">
            <ActHeader number={1} title="Dashboard Overview" time="2 min" color="#60a5fa" />
            <Steps steps={[
              'Log in with Google',
              'Land on the **Overview** dashboard',
              'Highlight KPI cards: total receivables, overdue amounts, collection rate',
              'Show the **Aging Chart** — buckets of overdue invoices (Current, 1-30, 31-60, 61-90, 90+)',
              'Point out **AI Insight Cards** — auto-generated action items from the ML pipeline',
            ]} />
            <TalkingPoint text="This is the operations command center. Everything updates daily from our ML pipeline." />
          </section>

          {/* Act 2 */}
          <section id="act-2">
            <ActHeader number={2} title="Penalty & Payment Breakdown" time="4 min" color="#f59e0b" />

            <SubSection title="2a. Admin view — Overdue tenant with penalties" />
            <AccountBadge name="Pottery Barn Philippines" location="Greenbelt 5" />
            <Steps steps={[
              'Navigate to **Receivable** → click **Pottery Barn Philippines**',
              'Show **Invoice Breakdown**: 6 overdue invoices with aging badges (red 90+, amber 30-60)',
              'Each invoice: Principal, Penalty (months × 2%), Paid, Balance — total penalties ~₱249,264',
              'Show **Payment History** with allocation detail — PRINCIPAL vs PENALTY allocations',
              'Point out **Summary Bar**: Total Principal, Total Penalties, Total Paid, Grand Total Due',
            ]} />

            <SubSection title="2b. Penalty settings" />
            <Steps steps={[
              'Open **Settings** (gear icon) → show Penalty Configuration',
              'Show: Penalty Rate 2%/month, Grace Period 0 days, Application Method toggle',
              'Change rate to 3% and save, then back to 2% — configurable without code',
            ]} />

            <SubSection title="2c. Payer portal — QR code payment with breakdown" />
            <Steps steps={[
              'Open **Emulator** (bottom-right) → **Payer** mode → select Pottery Barn',
              'Go to Invoices tab → select an overdue invoice → switch to QR tab → generate QR',
              'Click the payment link → show **Balance Breakdown** with penalty calculations per month',
              'Click **Partial Payment** → enter ₱500,000',
              'Show dynamic calculator: "How your payment will be applied" (green) vs "Still outstanding" (red)',
            ]} />
            <TalkingPoint text="The payer sees exactly what they owe and what happens if they pay partially. Full transparency drives faster collections." />
          </section>

          {/* Act 3 */}
          <section id="act-3">
            <ActHeader number={3} title="Credit Balance & Overpayment" time="2 min" color="#60a5fa" />
            <AccountBadge name="Uniqlo Philippines Inc." location="Greenbelt 5 · TEN0001" />
            <Steps steps={[
              'Navigate to **Receivable** → click **Uniqlo Philippines Inc.**',
              'Show **Credit Balance Card** in sidebar: ₱4,540.00',
              'Source: "Overpayment credit applied from prior invoice"',
              'Click **Apply to Invoice** — dialog lists outstanding invoices to apply credit against',
              'Show **Credit History** log (green CREDIT entries)',
              'Mention **Refund** option for returning credit to tenant',
            ]} />
            <TalkingPoint text="When a tenant overpays, the excess automatically becomes a credit. Apply to future invoices or refund — no manual reconciliation." />
          </section>

          {/* Act 4 */}
          <section id="act-4">
            <ActHeader number={4} title="Security Deposit Forfeiture" time="3 min" color="#ff6b6b" />

            <SubSection title="4a. Customer with active forfeiture" />
            <AccountBadge name="Samsung Experience Store" location="Greenbelt 3" />
            <Steps steps={[
              'Navigate to **Receivable** → **Samsung Experience Store**',
              'Show **Security Deposit Card**: Initial ₱2,514,216 / Current ₱2,114,262 / Forfeited ₱399,954',
              'Forfeiture history: one APPROVED entry for INV-202510-00049',
            ]} />

            <SubSection title="4b. Fully exhausted deposit" />
            <AccountBadge name="Solenad Cinemas" location="Solenad 3, Nuvali" />
            <Steps steps={[
              'Navigate to **Solenad Cinemas** — deposit: Initial ₱1,400,940 / Current ₱0',
              '"This tenant\'s entire deposit has been consumed by forfeitures"',
            ]} />

            <SubSection title="4c. Forfeiture approval queue" />
            <AccountBadge name="JP Morgan Chase Bank N.A." location="Tower One" />
            <Steps steps={[
              'Go to **Collections** → **Forfeitures** tab',
              'Show pending forfeiture: JP Morgan, INV-202510-00100, ₱518,688, FLAGGED',
              'Click **Approve Forfeiture** → status changes to APPROVED',
              'Navigate back to customer → deposit balance reduced',
            ]} />

            <SubSection title="4d. Settings" />
            <Steps steps={[
              'Settings → **Deposit Forfeiture** threshold: "Auto-flag after 90 days overdue"',
            ]} />
            <TalkingPoint text="No money moves without approval, but the system proactively flags accounts that need attention." />
          </section>

          {/* Act 5 */}
          <section id="act-5">
            <ActHeader number={5} title="Supplier Workflow & AP Timeline" time="4 min" color="#7c8aff" />

            <SubSection title="5a. Supplier submits a claim (Emulator)" />
            <AccountBadge name="EEI Corporation" location="Supplier" />
            <Steps steps={[
              'Open **Emulator** → **Supplier** mode → select **EEI Corporation**',
              'Select PO-ALI-000008 → click **Submit Claim / Invoice**',
              'Click **Upload Delivery Report** on the new claim',
              'Click **Check Payment Status** → timeline shows CLAIM SUBMITTED + DELIVERY REPORT UPLOADED (green), rest greyed out',
            ]} />

            <SubSection title="5b. AP Clerk approves" />
            <Steps steps={[
              'Navigate to **Payables** → **Approval Queue** tab',
              'Set role: **AP Clerk** → find the claim → click **Approve**',
            ]} />

            <SubSection title="5c. Finance Manager authorizes" />
            <Steps steps={[
              'Switch role to **Finance Manager** → find the claim → click **Authorize Payment**',
              'System auto-fires: FM Approved → Payment Scheduled → Payment Released',
            ]} />

            <SubSection title="5d. Supplier sees completion" />
            <Steps steps={[
              'Back to Emulator → Supplier mode → **Check Payment Status**',
              'Timeline shows all 8 steps in green — fully completed',
            ]} />
            <TalkingPoint text="Both sides have real-time visibility. The supplier tracks their payment, Ayala Land controls the approval gates." />
          </section>

          {/* Act 6 */}
          <section id="act-6">
            <ActHeader number={6} title="Milestone Payments" time="3 min" color="#4ade80" />

            <SubSection title="6a. PO with milestone progress" />
            <AccountBadge name="EEI Corporation" location="PO-ALI-000008 · ₱1,478,692" />
            <Steps steps={[
              'Navigate to **Payables** → click **EEI Corporation**',
              'Expand PO-ALI-000008 → click **Milestones**',
              'Show stacked progress bar: green (Mobilization 20% — PAID), amber (Mid-Delivery 40% — COMPLETED), grey (Final Acceptance 40% — PENDING)',
              'Click **Release Payment** on the COMPLETED milestone → changes to PAID',
            ]} />

            <SubSection title="6b. Supplier marks milestone complete" />
            <AccountBadge name="Siemens Philippines Inc." location="PO-ALI-000031" />
            <Steps steps={[
              'Emulator → Supplier mode → select **Siemens Philippines**, PO-ALI-000031',
              'Show **PO Milestones** section with progress bar',
              'Click **Mark Complete** on the next PENDING milestone → status changes to COMPLETED',
            ]} />
            <TalkingPoint text="For construction and delivery contracts, milestone-based payments ensure Ayala Land only pays for completed work." />
          </section>

          {/* Act 7 */}
          <section id="act-7">
            <ActHeader number={7} title="Check Payments" time="2 min" color="#C5A930" />
            <AccountBadge name="Uniqlo Philippines Inc." location="Greenbelt 5" />
            <Steps steps={[
              'Navigate to **Receivable** → **Uniqlo Philippines Inc.**',
              'In payment history, find CHECK payments:',
              '— CHK-1001 / CHK-1002: **PENDING CLEARANCE** with progress bar',
              '— CHK-1003: **CONFIRMED** — cleared and processed',
              '— CHK-1004: **BOUNCED** — check bounced',
              'Show **clearance progress bar** (days elapsed / 3 days)',
              'Demo **Confirm Early** button and **View Deposit Slip** → AI document viewer',
            ]} />
            <TalkingPoint text="Check payments have a 3-day clearing window. AI verifies deposit slips automatically, and admins track clearance progress." />
          </section>

          {/* Act 8 */}
          <section id="act-8">
            <ActHeader number={8} title="Document AI Analysis" time="2 min" color="#a78bfa" />
            <Steps steps={[
              'Navigate to **Collections** → **Documents** tab',
              'Click **View** on a document',
              'Show side-by-side viewer: uploaded image (left) + AI-extracted fields (right)',
              'Highlight: confidence score, match/mismatch indicators per field',
              'Show action buttons: Confirm Payment / Flag for Review',
            ]} />
            <TalkingPoint text="Gemini Vision extracts and cross-references every field. Mismatches are flagged instantly — no manual checking of deposit slips." />
          </section>

          {/* Act 9 */}
          <section id="act-9">
            <ActHeader number={9} title="AI Chat Assistant" time="1 min" color="#f472b6" />
            <Steps steps={[
              'Open **AI Chat** (bottom of sidebar)',
              'Ask: "How much does Pottery Barn Philippines owe in total including penalties?"',
              'Show the AI executing SQL queries and returning a formatted answer',
              'Ask: "Which tenants have the highest delinquency risk?"',
            ]} />
            <TalkingPoint text="Natural language access to the entire system. No dashboards to build — just ask." />
          </section>
        </div>

        {/* Closing */}
        <section className="mt-16 mb-8 p-6 rounded-lg bg-[#0d1a0d] border border-[#1a3a1a]">
          <h2 className="text-lg font-bold text-white mb-4">Key Differentiators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '🔍', text: 'Full transparency — payer and admin see the same breakdown' },
              { icon: '⚙️', text: 'Configurable business rules — rates, methods, thresholds' },
              { icon: '🤖', text: 'AI-powered — document verification, risk scoring, NL queries' },
              { icon: '📋', text: 'End-to-end AP workflow — claim to two-level approval with timeline' },
              { icon: '🎯', text: 'Milestone payments — pay only for completed work' },
              { icon: '💳', text: 'Multiple payment methods — card, bank transfer, check' },
              { icon: '💰', text: 'Credit management — overpayments tracked and applicable' },
            ].map((d, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded bg-[#111] border border-[#222]">
                <span className="text-lg">{d.icon}</span>
                <span className="text-sm text-[#ccc]">{d.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Reference */}
        <section className="mb-16">
          <h2 className="text-lg font-bold text-white mb-4">Quick Reference — Key Accounts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left py-2 px-3 text-[#888] font-medium">Account</th>
                  <th className="text-left py-2 px-3 text-[#888] font-medium">Property</th>
                  <th className="text-left py-2 px-3 text-[#888] font-medium">What to show</th>
                </tr>
              </thead>
              <tbody className="text-[#ccc]">
                {[
                  ['Pottery Barn Philippines', 'Greenbelt 5', '6 overdue invoices, ₱249K penalties, payment breakdown'],
                  ['Uniqlo Philippines Inc.', 'Greenbelt 5', '₱4,540 credit balance, check payments (CHK-1001 to 1004)'],
                  ['Samsung Experience Store', 'Greenbelt 3', 'Security deposit partially forfeited (₱400K)'],
                  ['Solenad Cinemas', 'Solenad 3, Nuvali', 'Deposit fully exhausted (₱0 balance)'],
                  ['JP Morgan Chase Bank N.A.', 'Tower One', 'FLAGGED forfeiture awaiting approval (₱519K)'],
                  ['EEI Corporation', '(Supplier)', 'PO-ALI-000008: milestones 20% paid, 40% completed, 40% pending'],
                  ['Siemens Philippines Inc.', '(Supplier)', 'PO-ALI-000031: milestones — demo Mark Complete'],
                ].map(([account, property, show], i) => (
                  <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#111]">
                    <td className="py-2 px-3 font-medium text-white">{account}</td>
                    <td className="py-2 px-3 text-[#888]">{property}</td>
                    <td className="py-2 px-3">{show}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function ActHeader({ number, title, time, color }: { number: number; title: string; time: string; color: string }) {
  return (
    <div className="flex items-center gap-4 mb-6 pb-3 border-b border-[#222]">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: color }}>
        {number}
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <span className="text-xs text-[#666]">{time}</span>
      </div>
    </div>
  )
}

function SubSection({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-[#C5A930] mt-6 mb-3">{title}</h3>
}

function AccountBadge({ name, location }: { name: string; location: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a2e] border border-[#333] text-sm mb-3">
      <span className="font-medium text-white">{name}</span>
      <span className="text-[#666]">&middot;</span>
      <span className="text-[#888]">{location}</span>
    </div>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-xs text-[#666] mt-0.5">{i + 1}</span>
          <span className="text-[#ccc]" dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
        </li>
      ))}
    </ol>
  )
}

function TalkingPoint({ text }: { text: string }) {
  return (
    <div className="mt-4 p-4 rounded-lg bg-[#0d1a0d] border-l-3 border-[#C5A930] text-sm text-[#aaa] italic" style={{ borderLeftWidth: 3, borderLeftColor: '#C5A930' }}>
      <span className="text-[#C5A930] font-medium not-italic">Talking point: </span>{text}
    </div>
  )
}
