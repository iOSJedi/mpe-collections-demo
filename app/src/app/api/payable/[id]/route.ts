import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { suppliers, supplierInvoices, purchaseOrders, threeWayMatches } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import type { SupplierDetail, POSummary, SupplierInvoiceSummary } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supplierId = parseInt(id, 10)
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'Invalid supplier ID' }, { status: 400 })
    }

    // Fetch supplier with aggregates
    const [supplierRow] = await db
      .select({
        supplier_id: suppliers.supplierId,
        name: suppliers.name,
        category: suppliers.category,
        type: suppliers.type,
        status: suppliers.status,
        contact_person: suppliers.contactPerson,
        email: suppliers.email,
        phone: suppliers.phone,
        tax_id: suppliers.taxId,
        total_payable: sql<string>`COALESCE(SUM(CASE WHEN ${supplierInvoices.paymentStatus} != 'PAID' THEN (${supplierInvoices.amount}::numeric - ${supplierInvoices.amountPaid}::numeric) ELSE 0 END), 0)`,
        open_pos: sql<string>`COUNT(DISTINCT CASE WHEN ${purchaseOrders.status} = 'OPEN' THEN ${purchaseOrders.poId} END)`,
        blocked_invoices: sql<string>`COUNT(DISTINCT CASE WHEN ${threeWayMatches.matchStatus} = 'MISMATCH' THEN ${threeWayMatches.matchId} END)`,
      })
      .from(suppliers)
      .leftJoin(supplierInvoices, eq(supplierInvoices.supplierId, suppliers.supplierId))
      .leftJoin(purchaseOrders, eq(purchaseOrders.supplierId, suppliers.supplierId))
      .leftJoin(threeWayMatches, eq(threeWayMatches.supplierId, suppliers.supplierId))
      .where(eq(suppliers.supplierId, supplierId))
      .groupBy(
        suppliers.supplierId,
        suppliers.name,
        suppliers.category,
        suppliers.type,
        suppliers.status,
        suppliers.contactPerson,
        suppliers.email,
        suppliers.phone,
        suppliers.taxId,
      )

    if (!supplierRow) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Fetch last 20 purchase orders
    const poRows = await db
      .select({
        po_id: purchaseOrders.poId,
        po_number: purchaseOrders.poNumber,
        project_name: purchaseOrders.projectName,
        total_amount: purchaseOrders.totalAmount,
        issued_date: purchaseOrders.issuedDate,
        expected_delivery: purchaseOrders.expectedDelivery,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(20)

    // Fetch last 20 supplier invoices with PO number
    const invoiceRows = await db
      .select({
        supplier_invoice_id: supplierInvoices.supplierInvoiceId,
        invoice_number: supplierInvoices.invoiceNumber,
        po_number: purchaseOrders.poNumber,
        amount: supplierInvoices.amount,
        submitted_date: supplierInvoices.submittedDate,
        due_date: supplierInvoices.dueDate,
        payment_status: supplierInvoices.paymentStatus,
        amount_paid: supplierInvoices.amountPaid,
      })
      .from(supplierInvoices)
      .leftJoin(purchaseOrders, eq(purchaseOrders.poId, supplierInvoices.poId))
      .where(eq(supplierInvoices.supplierId, supplierId))
      .orderBy(desc(supplierInvoices.createdAt))
      .limit(20)

    const purchase_orders: POSummary[] = poRows.map((r) => ({
      po_id: r.po_id,
      po_number: r.po_number,
      project_name: r.project_name,
      total_amount: Number(r.total_amount),
      issued_date: r.issued_date,
      expected_delivery: r.expected_delivery ?? null,
      status: r.status,
    }))

    const recent_invoices: SupplierInvoiceSummary[] = invoiceRows.map((r) => ({
      supplier_invoice_id: r.supplier_invoice_id,
      invoice_number: r.invoice_number,
      po_number: r.po_number ?? '',
      amount: Number(r.amount),
      submitted_date: r.submitted_date,
      due_date: r.due_date,
      payment_status: r.payment_status,
      amount_paid: Number(r.amount_paid),
    }))

    const result: SupplierDetail = {
      supplier_id: supplierRow.supplier_id,
      name: supplierRow.name,
      category: supplierRow.category,
      type: supplierRow.type,
      status: supplierRow.status,
      contact_person: supplierRow.contact_person ?? null,
      email: supplierRow.email ?? null,
      phone: supplierRow.phone ?? null,
      tax_id: supplierRow.tax_id ?? null,
      total_payable: Number(supplierRow.total_payable),
      open_pos: Number(supplierRow.open_pos),
      blocked_invoices: Number(supplierRow.blocked_invoices),
      purchase_orders,
      recent_invoices,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch supplier detail:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier detail' }, { status: 500 })
  }
}
