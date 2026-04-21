import { describe, it, expect } from 'vitest'
import { atcFor, defaultRateFor } from './rates'

describe('atcFor', () => {
  it('returns WC100 (5%) for lease to private corporate', () => {
    expect(atcFor({ contractType: 'LEASE', taxClassification: 'PRIVATE' })).toEqual({ code: 'WC100', ratePct: 5 })
  })
  it('returns WC640 (5%) for government lessee', () => {
    expect(atcFor({ contractType: 'LEASE', taxClassification: 'GOVT' })).toEqual({ code: 'WC640', ratePct: 5 })
  })
  it('returns WC158 (2%) for services', () => {
    expect(atcFor({ contractType: 'SERVICE', taxClassification: 'PRIVATE' })).toEqual({ code: 'WC158', ratePct: 2 })
  })
  it('returns null for concession', () => {
    expect(atcFor({ contractType: 'CONCESSION', taxClassification: 'PRIVATE' })).toBeNull()
  })
})

describe('defaultRateFor', () => {
  it('returns 5 for LEASE', () => { expect(defaultRateFor('LEASE')).toBe(5) })
  it('returns 2 for SERVICE', () => { expect(defaultRateFor('SERVICE')).toBe(2) })
  it('returns 0 for CONCESSION', () => { expect(defaultRateFor('CONCESSION')).toBe(0) })
})
