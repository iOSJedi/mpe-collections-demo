import { describe, it, expect } from 'vitest'
import { buildQapCsv } from './qap'

describe('buildQapCsv', () => {
  const certs = [
    { atcCode: 'WC100', payorTin: '111', payorBranchCode: '000', payorName: 'A Corp',
      grossAmount: '100000.00', withheldAmount: '5000.00', periodEnd: '2026-04-30', referenceNumber: '202604000000001' },
    { atcCode: 'WC100', payorTin: '222', payorBranchCode: '000', payorName: 'B Corp',
      grossAmount: '50000.00',  withheldAmount: '2500.00', periodEnd: '2026-04-30', referenceNumber: '202604000000002' },
    { atcCode: 'WC158', payorTin: '333', payorBranchCode: '000', payorName: 'C Corp',
      grossAmount: '30000.00',  withheldAmount: '600.00',  periodEnd: '2026-04-30', referenceNumber: '202604000000003' },
  ]
  it('emits one header row + one data row per cert', () => {
    const csv = buildQapCsv(certs)
    const lines = csv.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(4)   // header + 3 rows + totals lines
  })
  it('groups totals per ATC', () => {
    const csv = buildQapCsv(certs)
    expect(csv).toContain('7500.00')
    expect(csv).toContain('600.00')
  })
})
