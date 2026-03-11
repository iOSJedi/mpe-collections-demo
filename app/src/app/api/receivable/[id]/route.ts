import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { db } from '@/db'
import {
  customers,
  contracts,
  invoices,
  incomingPayments,
  delinquencyScores,
  creditRiskScores,
  paymentPatterns,
  payerSegments,
} from '@/db/schema'
import { eq, desc, gte, sql } from 'drizzle-orm'
import type { CustomerDetail } from '@/types'

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

    // 1. Customer record
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.customerId, customerId))
      .limit(1)

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 2. Contracts
    const contractRows = await db
      .select()
      .from(contracts)
      .where(eq(contracts.customerId, customerId))
      .orderBy(desc(contracts.createdAt))

    // 3. Invoices — last 6 months, joined with contracts for contract_number
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

    const invoiceRows = await db
      .select({
        invoice_id: invoices.invoiceId,
        invoice_number: invoices.invoiceNumber,
        contract_number: contracts.contractNumber,
        billing_period_start: invoices.billingPeriodStart,
        billing_period_end: invoices.billingPeriodEnd,
        due_date: invoices.dueDate,
        amount: invoices.amount,
        balance_remaining: invoices.balanceRemaining,
        status: invoices.status,
      })
      .from(invoices)
      .leftJoin(contracts, eq(contracts.contractId, invoices.contractId))
      .where(
        sql`${invoices.customerId} = ${customerId} AND ${invoices.billingPeriodStart} >= ${sixMonthsAgoStr}`
      )
      .orderBy(desc(invoices.dueDate))

    // 4. Recent payments — last 20, joined with invoices for invoice_number
    const paymentRows = await db
      .select({
        payment_id: incomingPayments.paymentId,
        invoice_number: invoices.invoiceNumber,
        amount: incomingPayments.amount,
        payment_method: incomingPayments.paymentMethod,
        payment_date: incomingPayments.paymentDate,
        reference_number: incomingPayments.referenceNumber,
        status: incomingPayments.status,
      })
      .from(incomingPayments)
      .leftJoin(invoices, eq(invoices.invoiceId, incomingPayments.invoiceId))
      .where(eq(incomingPayments.customerId, customerId))
      .orderBy(desc(incomingPayments.paymentDate))
      .limit(20)

    // 5. Delinquency score
    const [delinquency] = await db
      .select()
      .from(delinquencyScores)
      .where(eq(delinquencyScores.customerId, customerId))
      .limit(1)

    // 6. Credit risk
    const [creditRisk] = await db
      .select()
      .from(creditRiskScores)
      .where(eq(creditRiskScores.customerId, customerId))
      .limit(1)

    // 7. Payment pattern
    const [paymentPattern] = await db
      .select()
      .from(paymentPatterns)
      .where(eq(paymentPatterns.customerId, customerId))
      .limit(1)

    // 8. Payer segment
    const [payerSegment] = await db
      .select()
      .from(payerSegments)
      .where(eq(payerSegments.customerId, customerId))
      .limit(1)

    // 9. Aggregated totals from invoices
    const [totals] = await db
      .select({
        total_receivable: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} != 'PAID' THEN ${invoices.balanceRemaining}::numeric ELSE 0 END), 0)`,
        overdue_amount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'OVERDUE' THEN ${invoices.balanceRemaining}::numeric ELSE 0 END), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.customerId, customerId))

    const result: CustomerDetail = {
      customer_id: customer.customerId,
      account_number: customer.accountNumber,
      type: customer.type as 'TENANT' | 'PROPERTY_MANAGER',
      name: customer.name,
      business_type: customer.businessType ?? null,
      property_name: customer.propertyName ?? null,
      unit_info: customer.unitInfo ?? null,
      status: customer.status,
      contact_person: customer.contactPerson ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      total_receivable: Number(totals?.total_receivable ?? 0),
      overdue_amount: Number(totals?.overdue_amount ?? 0),
      delinquency_risk: delinquency?.riskLevel ?? null,
      segment_name: payerSegment?.segmentName ?? null,
      delinquency_score: delinquency ? Number(delinquency.riskScore) : null,
      credit_risk_level: creditRisk?.riskLevel ?? null,
      payment_pattern: paymentPattern
        ? {
            avg_days_to_pay: paymentPattern.avgDaysToPay != null ? Number(paymentPattern.avgDaysToPay) : null,
            preferred_method: paymentPattern.preferredMethod ?? null,
            typical_payment_day: paymentPattern.typicalPaymentDay ?? null,
            partial_payment_rate: paymentPattern.partialPaymentRate != null ? Number(paymentPattern.partialPaymentRate) : null,
          }
        : null,
      contracts: contractRows.map((c) => ({
        contract_id: c.contractId,
        contract_number: c.contractNumber,
        type: c.type,
        description: c.description ?? null,
        monthly_amount: Number(c.monthlyAmount),
        start_date: c.startDate,
        end_date: c.endDate,
        status: c.status,
      })),
      invoices: invoiceRows.map((inv) => ({
        invoice_id: inv.invoice_id,
        invoice_number: inv.invoice_number,
        contract_number: inv.contract_number ?? '',
        billing_period_start: inv.billing_period_start,
        billing_period_end: inv.billing_period_end,
        due_date: inv.due_date,
        amount: Number(inv.amount),
        balance_remaining: Number(inv.balance_remaining),
        status: inv.status,
      })),
      recent_payments: paymentRows.map((p) => ({
        payment_id: p.payment_id,
        invoice_number: p.invoice_number ?? '',
        amount: Number(p.amount),
        payment_method: p.payment_method,
        payment_date: p.payment_date ? String(p.payment_date) : '',
        reference_number: p.reference_number ?? null,
        status: p.status,
      })),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch customer detail:', error)
    return NextResponse.json({ error: 'Failed to fetch customer detail' }, { status: 500 })
  }
}
