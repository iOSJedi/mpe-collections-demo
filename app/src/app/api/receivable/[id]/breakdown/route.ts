import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { cachedJson, getFromCache, setInCache } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyToken(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const customerId = parseInt(id, 10)
    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
    }

    const cacheKey = `customer-breakdown-${customerId}`
    const cached = getFromCache(cacheKey)
    if (cached) return cachedJson(cached, 15, 30)

    // Customer info
    const custResult = await db.execute(sql`SELECT customer_id, name, account_number FROM customers_col WHERE customer_id = ${customerId}`)
    const custRows = custResult as unknown as { customer_id: number; name: string; account_number: string }[]
    if (!custRows.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    const customer = custRows[0]

    // Invoices with contract info
    const invResult = await db.execute(sql`SELECT i.invoice_id, i.invoice_number, i.billing_period_start, i.billing_period_end, i.due_date, i.amount, i.balance_remaining, i.status, i.total_penalties, i.penalties_paid, c.contract_number FROM invoices_col i LEFT JOIN contracts_col c ON i.contract_id = c.contract_id WHERE i.customer_id = ${customerId} ORDER BY i.due_date`)
    const invoiceRows = invResult as unknown as { invoice_id: number; invoice_number: string; billing_period_start: string; billing_period_end: string; due_date: string; amount: string; balance_remaining: string; status: string; total_penalties: string; penalties_paid: string; contract_number: string | null }[]

    // Penalties for all invoices
    const invoiceIds = invoiceRows.map(i => i.invoice_id)
    let penaltyRows: { penalty_id: number; invoice_id: number; period_label: string; penalty_amount: string; penalty_rate: string; accrual_date: string; status: string; paid_amount: string }[] = []
    if (invoiceIds.length > 0) {
      const penResult = await db.execute(sql.raw(`SELECT penalty_id, invoice_id, period_label, penalty_amount, penalty_rate, accrual_date, status, paid_amount FROM penalty_ledger_col WHERE invoice_id IN (${invoiceIds.join(',')}) ORDER BY accrual_date`))
      penaltyRows = penResult as unknown as typeof penaltyRows
    }

    // CWT certificates linked to each invoice (first one wins)
    let cwtRows: { certificate_id: number; invoice_id: number; reference_number: string }[] = []
    if (invoiceIds.length > 0) {
      const cwtResult = await db.execute(sql.raw(`SELECT certificate_id, invoice_id, reference_number FROM cwt_certificates_col WHERE invoice_id IN (${invoiceIds.join(',')}) ORDER BY certificate_id`))
      cwtRows = cwtResult as unknown as typeof cwtRows
    }
    const cwtByInvoice = new Map<number, { certificateId: number; referenceNumber: string }>()
    for (const row of cwtRows) {
      if (!cwtByInvoice.has(row.invoice_id)) {
        cwtByInvoice.set(row.invoice_id, { certificateId: row.certificate_id, referenceNumber: row.reference_number })
      }
    }

    const penaltiesByInvoice = new Map<number, typeof penaltyRows>()
    for (const p of penaltyRows) {
      const arr = penaltiesByInvoice.get(p.invoice_id) || []
      arr.push(p)
      penaltiesByInvoice.set(p.invoice_id, arr)
    }

    // Payments
    const payResult = await db.execute(sql`SELECT payment_id, invoice_id, amount, payment_method, payment_date, reference_number, status, check_number, clearance_date FROM incoming_payments_col WHERE customer_id = ${customerId} ORDER BY payment_date DESC LIMIT 20`)
    const paymentRows = payResult as unknown as { payment_id: number; invoice_id: number | null; amount: string; payment_method: string; payment_date: string; reference_number: string | null; status: string; check_number: string | null; clearance_date: string | null }[]

    // Allocations
    const paymentIds = paymentRows.map(p => p.payment_id)
    let allocationRows: { allocation_id: number; payment_id: number; invoice_id: number; penalty_id: number | null; allocation_type: string; amount: string }[] = []
    if (paymentIds.length > 0) {
      const allocResult = await db.execute(sql.raw(`SELECT allocation_id, payment_id, invoice_id, penalty_id, allocation_type, amount FROM payment_allocations_col WHERE payment_id IN (${paymentIds.join(',')}) ORDER BY allocation_id`))
      allocationRows = allocResult as unknown as typeof allocationRows
    }

    const allocationsByPayment = new Map<number, typeof allocationRows>()
    for (const a of allocationRows) {
      const arr = allocationsByPayment.get(a.payment_id) || []
      arr.push(a)
      allocationsByPayment.set(a.payment_id, arr)
    }

    const now = new Date()
    const invoicesOut = invoiceRows.map(inv => {
      const dueDate = new Date(inv.due_date)
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000))
      const pens = (penaltiesByInvoice.get(inv.invoice_id) || []).map(p => ({
        penaltyId: p.penalty_id,
        invoiceId: p.invoice_id,
        periodLabel: p.period_label,
        penaltyAmount: Number(p.penalty_amount),
        penaltyRate: Number(p.penalty_rate),
        accrualDate: p.accrual_date,
        status: p.status as 'ACTIVE' | 'PAID' | 'WAIVED',
        paidAmount: Number(p.paid_amount),
      }))
      return {
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        billingPeriodStart: inv.billing_period_start,
        billingPeriodEnd: inv.billing_period_end,
        dueDate: inv.due_date,
        amount: Number(inv.amount),
        balanceRemaining: Number(inv.balance_remaining),
        status: inv.status,
        contractNumber: inv.contract_number || '',
        totalPenalties: Number(inv.total_penalties),
        penaltiesPaid: Number(inv.penalties_paid),
        penalties: pens,
        daysOverdue,
        cwtCert: cwtByInvoice.get(inv.invoice_id) ?? null,
      }
    })

    const paymentsOut = paymentRows.map(p => ({
      paymentId: p.payment_id,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      paymentDate: String(p.payment_date || ''),
      referenceNumber: p.reference_number,
      checkNumber: p.check_number,
      clearanceDate: p.clearance_date ? String(p.clearance_date) : null,
      status: p.status,
      allocations: (allocationsByPayment.get(p.payment_id) || []).map(a => ({
        allocationId: a.allocation_id,
        paymentId: a.payment_id,
        invoiceId: a.invoice_id,
        penaltyId: a.penalty_id,
        allocationType: a.allocation_type as 'PRINCIPAL' | 'PENALTY',
        amount: Number(a.amount),
      })),
    }))

    const totalPrincipal = invoicesOut.reduce((s, i) => s + i.amount, 0)
    const totalPenalties = invoicesOut.reduce((s, i) => s + i.totalPenalties, 0)
    const totalPaid = paymentsOut.filter(p => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0)

    const result = {
      customer: { customerId: customer.customer_id, name: customer.name, accountNumber: customer.account_number },
      invoices: invoicesOut,
      payments: paymentsOut,
      totals: {
        totalPrincipal,
        totalPenalties,
        totalPaid,
        grandTotalDue: totalPrincipal + totalPenalties - totalPaid,
      },
    }
    setInCache(cacheKey, result, 15_000)
    return cachedJson(result, 15, 30)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Breakdown failed:', msg)
    return NextResponse.json({ error: `Failed to load breakdown: ${msg}` }, { status: 500 })
  }
}
