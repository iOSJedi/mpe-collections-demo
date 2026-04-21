import { describe, it, expect } from 'vitest'
import { classifyPaymentGap } from './detector'

const baseInvoice = { amount: '100000.00', balanceRemaining: '100000.00' }

describe('classifyPaymentGap', () => {
  it('classifies a clean 5% short payment as CWT_MATCH', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '95000.00', declaredRatePct: '5.00' })).toMatchObject({
      kind: 'CWT_MATCH', gapAmount: 5000, gapPct: 5,
    })
  })
  it('classifies a 7% gap against a 5% declared rate as CWT_MISMATCH', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '93000.00', declaredRatePct: '5.00' }).kind).toBe('CWT_MISMATCH')
  })
  it('classifies a full payment as FULL', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '100000.00', declaredRatePct: '5.00' }).kind).toBe('FULL')
  })
  it('classifies a random underpayment (30%) as PARTIAL', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '70000.00', declaredRatePct: '5.00' }).kind).toBe('PARTIAL')
  })
  it('accepts ±0.5% tolerance on the declared rate', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '94600.00', declaredRatePct: '5.00' }).kind).toBe('CWT_MATCH')
  })
  it('returns NONE when no rate is declared', () => {
    expect(classifyPaymentGap({ invoice: baseInvoice, paymentAmount: '95000.00', declaredRatePct: null }).kind).toBe('NONE')
  })
})
