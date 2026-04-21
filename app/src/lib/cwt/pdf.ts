import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface Bir2307Data {
  periodStart: string
  periodEnd: string
  payeeTin: string
  payeeBranchCode: string
  payeeName: string
  payeeAddress: string
  payeeZipCode: string
  payorTin: string
  payorBranchCode: string
  payorName: string
  payorAddress: string
  payorZipCode: string
  atcCode: string
  grossAmount: number
  taxWithheldAmount: number
  signedByName: string
  signedByTin: string
  signatureImagePngBase64?: string
  referenceNumber?: string
}

// BIR 2307 official form is 612 × 936 pt. pdf-lib origin is bottom-left;
// the extracted label coordinates are top-left (pymupdf), so y_lib = PAGE_H - y_top.
const PAGE_H = 936
const TEMPLATE_PATH = path.resolve(process.cwd(), 'public/forms/BIR-2307-real.pdf')

function mmddyyyy(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${m}/${d}/${y}`
}

function splitTin(tin: string): [string, string, string, string] {
  const parts = tin.replace(/[^0-9]/g, '').padEnd(12, '0').slice(0, 12)
  return [parts.slice(0, 3), parts.slice(3, 6), parts.slice(6, 9), parts.slice(9, 12)]
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function renderBir2307Pdf(data: Bir2307Data): Promise<Uint8Array> {
  const templateBytes = await readFile(TEMPLATE_PATH)
  const pdf = await PDFDocument.load(templateBytes)
  const page = pdf.getPages()[0]
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ink = rgb(0.03, 0.08, 0.2)
  const accent = rgb(0.0, 0.28, 0.6)
  const muted = rgb(0.3, 0.3, 0.3)

  const at = (x: number, yTop: number) => ({ x, y: PAGE_H - yTop })
  const draw = (
    text: string, x: number, yTop: number,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const { size = 10, bold = true, color = ink } = opts
    page.drawText(text, { ...at(x, yTop), font: bold ? helvBold : helv, size, color })
  }

  // Period
  const fromParts = mmddyyyy(data.periodStart)
  const toParts = mmddyyyy(data.periodEnd)
  draw(fromParts.slice(0, 2), 165, 121)
  draw(fromParts.slice(3, 5), 200, 121)
  draw(fromParts.slice(6, 10), 230, 121)
  draw(toParts.slice(0, 2), 420, 121)
  draw(toParts.slice(3, 5), 455, 121)
  draw(toParts.slice(6, 10), 485, 121)

  // Payee TIN
  const [pt1, pt2, pt3, pt4] = splitTin(data.payeeTin)
  draw(pt1.split('').join(' '), 215, 150, { size: 11 })
  draw(pt2.split('').join(' '), 265, 150, { size: 11 })
  draw(pt3.split('').join(' '), 315, 150, { size: 11 })
  draw(pt4.split('').join(' '), 365, 150, { size: 11 })

  // Payee details
  draw(data.payeeName.toUpperCase(), 45, 175, { size: 11 })
  draw(data.payeeAddress, 45, 203, { size: 10, bold: false })
  draw(data.payeeZipCode, 555, 203, { size: 10 })

  // Payor TIN
  const [xt1, xt2, xt3, xt4] = splitTin(data.payorTin)
  draw(xt1.split('').join(' '), 215, 267, { size: 11 })
  draw(xt2.split('').join(' '), 265, 267, { size: 11 })
  draw(xt3.split('').join(' '), 315, 267, { size: 11 })
  draw(xt4.split('').join(' '), 365, 267, { size: 11 })

  // Payor details
  draw(data.payorName.toUpperCase(), 45, 289, { size: 11 })
  draw(data.payorAddress, 45, 317, { size: 10, bold: false })
  draw(data.payorZipCode, 555, 317, { size: 10 })

  // Part III first data row
  const rowY = 383
  draw('Rentals of Real Property', 30, rowY, { size: 9, bold: false })
  draw(data.atcCode, 195, rowY, { size: 10, color: accent })
  draw(formatAmount(data.grossAmount), 373, rowY, { size: 10 })
  draw(formatAmount(data.grossAmount), 456, rowY, { size: 10 })
  draw(formatAmount(data.taxWithheldAmount), 517, rowY, { size: 10 })

  // Totals row
  draw(formatAmount(data.grossAmount), 456, 506, { size: 10 })
  draw(formatAmount(data.taxWithheldAmount), 517, 506, { size: 10 })

  // Signature
  if (data.signatureImagePngBase64) {
    try {
      const sig = await pdf.embedPng(Buffer.from(data.signatureImagePngBase64, 'base64'))
      page.drawImage(sig, { ...at(75, 750), width: 140, height: 40 })
    } catch { /* skip on bad PNG */ }
  }
  draw(`${data.signedByName} — Authorized Signatory`, 80, 758, { size: 9 })
  draw(`for ${data.payorName}`, 80, 768, { size: 8, bold: false })

  const stamp = data.referenceNumber
    ? `Issued automatically by Ayala Land Inc. under RA 8792 + RR 16-2021. Ref ${data.referenceNumber}`
    : 'Issued automatically by Ayala Land Inc. under RA 8792 + RR 16-2021.'
  draw(stamp, 30, 910, { size: 7, bold: false, color: muted })

  return await pdf.save()
}
