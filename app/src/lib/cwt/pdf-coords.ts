// Coordinates for overlaying data onto app/public/forms/BIR-2307-real.pdf.
// Values are in PDF points using TOP-LEFT origin (same as pymupdf extraction).
// pdf-lib draws from bottom-left, so at render time: y_lib = 936 - y.
// Tune these in the visual editor at /tools/bir-overlay.

export const PDF_SIZE = { width: 612, height: 936 }
export const BG_PNG = '/forms/BIR-2307-bg.png'  // rendered at 2.5× (1530×2340)
export const BG_SCALE = 2.5

// Each field: { x, y } in PDF points (top-left). Size/bold are hints for rendering.
export interface FieldCoord { x: number; y: number; size?: number; bold?: boolean; label: string }

export const COORDS: Record<string, FieldCoord> = {
  periodFromMM:    { x: 165, y: 121, size: 10, label: 'Period From MM' },
  periodFromDD:    { x: 200, y: 121, size: 10, label: 'Period From DD' },
  periodFromYYYY:  { x: 230, y: 121, size: 10, label: 'Period From YYYY' },
  periodToMM:      { x: 420, y: 121, size: 10, label: 'Period To MM' },
  periodToDD:      { x: 455, y: 121, size: 10, label: 'Period To DD' },
  periodToYYYY:    { x: 485, y: 121, size: 10, label: 'Period To YYYY' },

  payeeTin1:       { x: 215, y: 150, size: 11, label: 'Payee TIN 1-3' },
  payeeTin2:       { x: 265, y: 150, size: 11, label: 'Payee TIN 4-6' },
  payeeTin3:       { x: 315, y: 150, size: 11, label: 'Payee TIN 7-9' },
  payeeTin4:       { x: 365, y: 150, size: 11, label: 'Payee TIN 10-12' },

  payeeName:       { x: 45,  y: 175, size: 11, label: 'Payee Name' },
  payeeAddress:    { x: 45,  y: 203, size: 10, label: 'Payee Address', bold: false },
  payeeZip:        { x: 555, y: 203, size: 10, label: 'Payee ZIP' },

  payorTin1:       { x: 215, y: 267, size: 11, label: 'Payor TIN 1-3' },
  payorTin2:       { x: 265, y: 267, size: 11, label: 'Payor TIN 4-6' },
  payorTin3:       { x: 315, y: 267, size: 11, label: 'Payor TIN 7-9' },
  payorTin4:       { x: 365, y: 267, size: 11, label: 'Payor TIN 10-12' },

  payorName:       { x: 45,  y: 289, size: 11, label: 'Payor Name' },
  payorAddress:    { x: 45,  y: 317, size: 10, label: 'Payor Address', bold: false },
  payorZip:        { x: 555, y: 317, size: 10, label: 'Payor ZIP' },

  rowLabel:        { x: 30,  y: 383, size: 9,  label: 'Row 1 — Nature', bold: false },
  rowAtc:          { x: 195, y: 383, size: 10, label: 'Row 1 — ATC' },
  rowGross:        { x: 373, y: 383, size: 10, label: 'Row 1 — Amount (3rd month)' },
  rowTotal:        { x: 456, y: 383, size: 10, label: 'Row 1 — Total' },
  rowTaxWithheld:  { x: 517, y: 383, size: 10, label: 'Row 1 — Tax Withheld' },

  totalsGross:     { x: 456, y: 506, size: 10, label: 'Totals — Gross' },
  totalsTax:       { x: 517, y: 506, size: 10, label: 'Totals — Tax' },

  signatureImg:    { x: 75,  y: 710, size: 0,  label: 'Signature (image, 140×40pt)' },
  signatoryName:   { x: 80,  y: 758, size: 9,  label: 'Signatory Name' },
  signatoryFor:    { x: 80,  y: 768, size: 8,  label: 'for [Company]', bold: false },

  stamp:           { x: 30,  y: 910, size: 7,  label: 'Auto-issue stamp', bold: false },
}

export type CoordKey = keyof typeof COORDS
