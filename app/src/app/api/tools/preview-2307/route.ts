import { NextRequest } from 'next/server'
import { renderBir2307Pdf } from '@/lib/cwt/pdf'

// Returns a sample filled-in BIR 2307 using the currently-loaded coord map.
// NOTE: to preview edits in the visual editor WITHOUT saving, the editor sends
// an override coord map in the request body — but since COORDS is imported at
// module load, overrides require a save + page refresh. The body is ignored;
// this route just renders the current on-disk coord map.
export async function POST(_req: NextRequest) {
  const bytes = await renderBir2307Pdf({
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    payeeTin: '000-000-000-000',
    payeeBranchCode: '000',
    payeeName: 'Ayala Land, Inc.',
    payeeAddress: 'Tower One, Ayala Triangle, Makati City',
    payeeZipCode: '1226',
    payorTin: '640-503-867-000',
    payorBranchCode: '000',
    payorName: 'APPLE PHILIPPINES (Authorized Retailer)',
    payorAddress: '30th St corner 11th Ave, BGC, Taguig City',
    payorZipCode: '1634',
    atcCode: 'WC100',
    grossAmount: 2455942,
    taxWithheldAmount: 122797.1,
    signedByName: 'Juan Dela Cruz',
    signedByTin: '640-503-867-000',
    referenceNumber: '202604PREVIEW1',
  })
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview-2307.pdf"',
      'Cache-Control': 'no-cache',
    },
  })
}
