export interface QapRow {
  atcCode: string
  payorTin: string
  payorBranchCode: string
  payorName: string
  grossAmount: string
  withheldAmount: string
  periodEnd: string
  referenceNumber: string
}

const HEADER = ['ATC', 'PayorTIN', 'PayorBranch', 'PayorName', 'Gross', 'TaxWithheld', 'Period', 'RefNo']

export function buildQapCsv(rows: QapRow[]): string {
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push([r.atcCode, r.payorTin, r.payorBranchCode, csvEscape(r.payorName),
                r.grossAmount, r.withheldAmount, r.periodEnd, r.referenceNumber].join(','))
  }
  const byAtc = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.atcCode] = (acc[r.atcCode] ?? 0) + Number(r.withheldAmount)
    return acc
  }, {})
  for (const [atc, total] of Object.entries(byAtc)) {
    lines.push(['TOTAL', atc, '', '', '', total.toFixed(2), '', ''].join(','))
  }
  return lines.join('\n') + '\n'
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
