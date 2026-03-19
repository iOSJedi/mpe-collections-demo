import { AllocationPreview } from '@/types'

interface InvoiceWithPenalties {
  invoiceId: number
  invoiceNumber: string
  balanceRemaining: number
  dueDate: string
  penalties: { penaltyId: number; periodLabel: string; amount: number; paidAmount: number; status: string }[]
}

export function calculateAllocation(
  invoicesWithPenalties: InvoiceWithPenalties[],
  paymentAmount: number,
  method: 'PENALTIES_FIRST' | 'FIFO',
  penaltyRate: number,
): AllocationPreview {
  // Sort oldest first by due date
  const sorted = [...invoicesWithPenalties].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )

  let remaining = paymentAmount
  const applied: AllocationPreview['applied'] = []
  const outstanding: AllocationPreview['remaining'] = []

  if (method === 'PENALTIES_FIRST') {
    // Pass 1: Apply to all penalties (oldest invoice first)
    for (const inv of sorted) {
      for (const pen of inv.penalties) {
        if (pen.status !== 'ACTIVE') continue
        const unpaid = pen.amount - pen.paidAmount
        if (unpaid <= 0) continue
        const apply = Math.min(remaining, unpaid)
        if (apply > 0) {
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PENALTY',
            penaltyId: pen.penaltyId,
            periodLabel: pen.periodLabel,
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
        if (remaining <= 0) break
      }
      if (remaining <= 0) break
    }

    // Pass 2: Apply to principal (oldest first)
    for (const inv of sorted) {
      if (remaining <= 0) break
      const principal = inv.balanceRemaining
      if (principal <= 0) continue
      const apply = Math.min(remaining, principal)
      if (apply > 0) {
        applied.push({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          allocationType: 'PRINCIPAL',
          amount: Math.round(apply * 100) / 100,
        })
        remaining -= apply
      }
    }
  } else {
    // FIFO: per-invoice (penalties then principal) before moving to next
    for (const inv of sorted) {
      if (remaining <= 0) break

      // Penalties for this invoice first
      for (const pen of inv.penalties) {
        if (pen.status !== 'ACTIVE') continue
        const unpaid = pen.amount - pen.paidAmount
        if (unpaid <= 0) continue
        const apply = Math.min(remaining, unpaid)
        if (apply > 0) {
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PENALTY',
            penaltyId: pen.penaltyId,
            periodLabel: pen.periodLabel,
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
      }

      // Then principal
      if (remaining > 0) {
        const principal = inv.balanceRemaining
        if (principal > 0) {
          const apply = Math.min(remaining, principal)
          applied.push({
            invoiceId: inv.invoiceId,
            invoiceNumber: inv.invoiceNumber,
            allocationType: 'PRINCIPAL',
            amount: Math.round(apply * 100) / 100,
          })
          remaining -= apply
        }
      }
    }
  }

  // Build "still outstanding" list
  const appliedMap = new Map<string, number>()
  for (const a of applied) {
    const key = a.penaltyId ? `pen-${a.penaltyId}` : `pri-${a.invoiceId}`
    appliedMap.set(key, (appliedMap.get(key) || 0) + a.amount)
  }

  for (const inv of sorted) {
    for (const pen of inv.penalties) {
      if (pen.status !== 'ACTIVE') continue
      const unpaid = pen.amount - pen.paidAmount
      const wasApplied = appliedMap.get(`pen-${pen.penaltyId}`) || 0
      const stillOwed = Math.round((unpaid - wasApplied) * 100) / 100
      if (stillOwed > 0) {
        outstanding.push({
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          type: 'PENALTY',
          periodLabel: pen.periodLabel,
          amount: stillOwed,
        })
      }
    }
    const principalApplied = appliedMap.get(`pri-${inv.invoiceId}`) || 0
    const principalRemaining = Math.round((inv.balanceRemaining - principalApplied) * 100) / 100
    if (principalRemaining > 0) {
      outstanding.push({
        invoiceId: inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        type: 'PRINCIPAL',
        amount: principalRemaining,
      })
    }
  }

  const totalRemaining = outstanding.reduce((s, o) => s + o.amount, 0)
  const monthlyPenaltyAccrual = Math.round(totalRemaining * (penaltyRate / 100) * 100) / 100

  return {
    applied,
    remaining: outstanding,
    totalApplied: Math.round((paymentAmount - Math.max(0, remaining)) * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
    monthlyPenaltyAccrual,
  }
}
