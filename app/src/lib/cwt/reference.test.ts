import { describe, it, expect } from 'vitest'
import { referenceNumberFor } from './reference'

describe('referenceNumberFor', () => {
  it('produces a 15-character string', () => {
    const r = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(r).toHaveLength(15)
  })
  it('prefixes with YYYYMM', () => {
    const r = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(r.slice(0, 6)).toBe('202604')
  })
  it('is deterministic for the same inputs', () => {
    const a = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    const b = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    expect(a).toBe(b)
  })
  it('differs across different inputs', () => {
    const a = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 30 })
    const b = referenceNumberFor({ year: 2026, month: 4, customerId: 10, invoiceId: 20, paymentId: 31 })
    expect(a).not.toBe(b)
  })
  it('pads single-digit month', () => {
    const r = referenceNumberFor({ year: 2026, month: 1, customerId: 1, invoiceId: 1, paymentId: 1 })
    expect(r.slice(0, 6)).toBe('202601')
  })
})
