export type GapClassification =
  | { kind: 'CWT_MATCH'; gapAmount: number; gapPct: number }
  | { kind: 'CWT_MISMATCH'; gapAmount: number; gapPct: number; declaredRatePct: number }
  | { kind: 'FULL' }
  | { kind: 'PARTIAL'; gapAmount: number; gapPct: number }
  | { kind: 'NONE' }

export interface GapInput {
  invoice: { amount: string; balanceRemaining: string }
  paymentAmount: string
  declaredRatePct: string | null
}

const TOLERANCE_PP = 0.5
const FULL_EPSILON = 0.01

export function classifyPaymentGap({ invoice, paymentAmount, declaredRatePct }: GapInput): GapClassification {
  const invoiceAmount = Number(invoice.amount)
  const paid = Number(paymentAmount)
  const gap = Number(invoice.balanceRemaining) - paid

  if (Math.abs(gap) < FULL_EPSILON) return { kind: 'FULL' }

  const gapPct = (gap / invoiceAmount) * 100
  if (declaredRatePct === null) return { kind: 'NONE' }

  const rate = Number(declaredRatePct)
  if (Math.abs(gapPct - rate) <= TOLERANCE_PP) {
    return { kind: 'CWT_MATCH', gapAmount: round2(gap), gapPct: round2(gapPct) }
  }
  if (gapPct > 0 && gapPct < 15) {
    return { kind: 'CWT_MISMATCH', gapAmount: round2(gap), gapPct: round2(gapPct), declaredRatePct: rate }
  }
  return { kind: 'PARTIAL', gapAmount: round2(gap), gapPct: round2(gapPct) }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
