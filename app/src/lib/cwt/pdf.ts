import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadCoords, PDF_SIZE, type CoordMap } from './pdf-coords'

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

const TEMPLATE_PATH = path.resolve(process.cwd(), 'public/forms/BIR-2307-real.pdf')

function mmddyyyy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${m}/${d}/${y}`
}
function splitTin(tin: string): [string, string, string, string] {
  const p = tin.replace(/[^0-9]/g, '').padEnd(12, '0').slice(0, 12)
  return [p.slice(0, 3), p.slice(3, 6), p.slice(6, 9), p.slice(9, 12)]
}
function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function spaced(s: string): string {
  return s.split('').join(' ')
}

export async function renderBir2307Pdf(data: Bir2307Data): Promise<Uint8Array> {
  const coords: CoordMap = await loadCoords()
  const templateBytes = await readFile(TEMPLATE_PATH)
  const pdf = await PDFDocument.load(templateBytes)
  const page = pdf.getPages()[0]
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const courier = await pdf.embedFont(StandardFonts.Courier)
  const courierBold = await pdf.embedFont(StandardFonts.CourierBold)

  const ink = rgb(0.03, 0.08, 0.2)
  const accent = rgb(0.0, 0.28, 0.6)
  const muted = rgb(0.3, 0.3, 0.3)

  const drawAt = (key: string, text: string, color = ink) => {
    const c = coords[key]
    if (!c || c.size === 0) return
    const bold = c.bold !== false
    const mono = c.monospace === true
    const font = mono ? (bold ? courierBold : courier) : (bold ? helvBold : helv)
    const size = c.size ?? 10
    const yPt = PDF_SIZE.height - c.y
    const align = c.align ?? 'left'

    if (c.charPitch && c.charPitch > 0) {
      // Each character drawn individually, centered in its charPitch-wide cell.
      const totalWidth = c.charPitch * text.length
      const originX = align === 'right' ? c.x - totalWidth
                    : align === 'center' ? c.x - totalWidth / 2
                    : c.x
      for (let i = 0; i < text.length; i++) {
        const chW = font.widthOfTextAtSize(text[i], size)
        const xPt = originX + i * c.charPitch + (c.charPitch - chW) / 2
        page.drawText(text[i], { x: xPt, y: yPt, font, size, color })
      }
    } else {
      const textW = font.widthOfTextAtSize(text, size)
      const xPt = align === 'right' ? c.x - textW
                : align === 'center' ? c.x - textW / 2
                : c.x
      page.drawText(text, { x: xPt, y: yPt, font, size, color })
    }
  }

  const from = mmddyyyy(data.periodStart)
  const to = mmddyyyy(data.periodEnd)
  drawAt('periodFromMM', from.slice(0, 2))
  drawAt('periodFromDD', from.slice(3, 5))
  drawAt('periodFromYYYY', from.slice(6, 10))
  drawAt('periodToMM', to.slice(0, 2))
  drawAt('periodToDD', to.slice(3, 5))
  drawAt('periodToYYYY', to.slice(6, 10))

  const [pa, pb, pc, pd] = splitTin(data.payeeTin)
  drawAt('payeeTin1', pa)
  drawAt('payeeTin2', pb)
  drawAt('payeeTin3', pc)
  drawAt('payeeTin4', pd)
  drawAt('payeeName', data.payeeName.toUpperCase())
  drawAt('payeeAddress', data.payeeAddress)
  drawAt('payeeZip', data.payeeZipCode)

  const [xa, xb, xc, xd] = splitTin(data.payorTin)
  drawAt('payorTin1', xa)
  drawAt('payorTin2', xb)
  drawAt('payorTin3', xc)
  drawAt('payorTin4', xd)
  drawAt('payorName', data.payorName.toUpperCase())
  drawAt('payorAddress', data.payorAddress)
  drawAt('payorZip', data.payorZipCode)

  drawAt('rowLabel', 'Rentals of Real Property')
  drawAt('rowAtc', data.atcCode, accent)
  drawAt('rowGross', formatAmount(data.grossAmount))
  drawAt('rowTotal', formatAmount(data.grossAmount))
  drawAt('rowTaxWithheld', formatAmount(data.taxWithheldAmount))
  drawAt('totalsGross', formatAmount(data.grossAmount))
  drawAt('totalsTax', formatAmount(data.taxWithheldAmount))

  if (data.signatureImagePngBase64) {
    try {
      const sig = await pdf.embedPng(Buffer.from(data.signatureImagePngBase64, 'base64'))
      const c = coords.signatureImg
      page.drawImage(sig, { x: c.x, y: PDF_SIZE.height - c.y - 40, width: 140, height: 40 })
    } catch { /* skip */ }
  }
  drawAt('signatoryName', `${data.signedByName} — Authorized Signatory`)
  drawAt('signatoryFor', `for ${data.payorName}`)

  const stamp = data.referenceNumber
    ? `Issued automatically by Ayala Land Inc. under RA 8792 + RR 16-2021. Ref ${data.referenceNumber}`
    : 'Issued automatically by Ayala Land Inc. under RA 8792 + RR 16-2021.'
  drawAt('stamp', stamp, muted)

  return await pdf.save()
}
