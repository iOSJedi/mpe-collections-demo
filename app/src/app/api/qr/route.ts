import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db } from '@/db'
import { invoices, contracts, customers, qrCodes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { signQrToken } from '@/lib/jwt'
import { generateQrDataUrl } from '@/lib/qr'
import { QrPayload } from '@/types'

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { invoiceId } = body

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }

    const invoiceIdNum = Number(invoiceId)
    if (isNaN(invoiceIdNum)) {
      return NextResponse.json({ error: 'invoiceId must be a number' }, { status: 400 })
    }

    // Look up invoice with joined contract and customer data
    const result = await db
      .select({
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        balanceRemaining: invoices.balanceRemaining,
        customerId: invoices.customerId,
        contractNumber: contracts.contractNumber,
        accountNumber: customers.accountNumber,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(contracts, eq(invoices.contractId, contracts.contractId))
      .innerJoin(customers, eq(invoices.customerId, customers.customerId))
      .where(eq(invoices.invoiceId, invoiceIdNum))
      .limit(1)

    if (!result.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = result[0]

    // Build QR payload
    const payload: QrPayload = {
      inv: invoice.invoiceNumber,
      con: invoice.contractNumber,
      acct: invoice.accountNumber,
      amt: Number(invoice.amount),
      bal: Number(invoice.balanceRemaining),
      due: String(invoice.dueDate),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }

    // Sign JWT token
    const token = signQrToken(payload)

    // Build payment URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const paymentUrl = `${appUrl}/pay?token=${token}`

    // Generate QR data URL
    const qrDataUrl = await generateQrDataUrl(paymentUrl)

    // Compute expiry timestamp
    const expiresAt = new Date(payload.exp)

    // Save to qr_codes table
    await db.insert(qrCodes).values({
      invoiceId: invoice.invoiceId,
      customerId: invoice.customerId,
      contractNumber: invoice.contractNumber,
      accountIdentifier: invoice.accountNumber,
      amount: invoice.amount,
      encodedUrl: paymentUrl,
      expiresAt,
    })

    return NextResponse.json({
      qrDataUrl,
      encodedUrl: paymentUrl,
      expiresAt: expiresAt.toISOString(),
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      contractNumber: invoice.contractNumber,
      accountNumber: invoice.accountNumber,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Failed to generate QR code:', errMsg, error)
    return NextResponse.json({ error: `Failed to generate QR code: ${errMsg}` }, { status: 500 })
  }
})
