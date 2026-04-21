import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

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

function mmddyyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y}`
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function renderBir2307Pdf(data: Bir2307Data): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])  // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const draw = (text: string, x: number, y: number, size = 9, f: PDFFont = font) => {
    page.drawText(text, { x, y: 792 - y, size, font: f, color: rgb(0, 0, 0) })
  }
  const box = (x: number, y: number, w: number, h: number) => {
    page.drawRectangle({ x, y: 792 - y - h, width: w, height: h, borderColor: rgb(0,0,0), borderWidth: 0.5 })
  }

  // Header
  draw('BIR Form No. 2307', 40, 50, 10, bold)
  draw('Republic of the Philippines — Bureau of Internal Revenue', 40, 64, 8)
  draw('Certificate of Creditable Tax Withheld at Source', 40, 80, 13, bold)
  if (data.referenceNumber) {
    draw(`Reference No.: ${data.referenceNumber}`, 400, 80, 9, bold)
  }

  // Period
  draw('For the Period', 40, 108, 9, bold)
  box(130, 102, 80, 18)
  draw('From', 215, 116, 8)
  box(235, 102, 80, 18)
  draw(mmddyyyy(data.periodStart), 135, 116, 9)
  draw('To', 320, 116, 8)
  box(335, 102, 80, 18)
  draw(mmddyyyy(data.periodEnd), 240, 116, 9)
  draw(mmddyyyy(data.periodEnd), 340, 116, 9)

  // Part I — Payee Information
  draw('Part I — Payee Information', 40, 150, 10, bold)
  draw("Payee's Taxpayer Identification Number (TIN)", 40, 170, 8)
  box(40, 174, 150, 16); draw(data.payeeTin, 45, 186, 9)
  draw('Branch Code', 200, 170, 8)
  box(200, 174, 60, 16); draw(data.payeeBranchCode, 205, 186, 9)

  draw("Payee's Name (Last Name, First Name, Middle Name)", 40, 210, 8)
  box(40, 214, 420, 16); draw(data.payeeName, 45, 226, 9)

  draw('Registered Address', 40, 250, 8)
  box(40, 254, 360, 16); draw(data.payeeAddress, 45, 266, 9)
  draw('ZIP Code', 410, 250, 8)
  box(410, 254, 60, 16); draw(data.payeeZipCode, 415, 266, 9)

  // Part II — Payor Information
  draw('Part II — Payor Information', 40, 300, 10, bold)
  draw("Payor's Taxpayer Identification Number (TIN)", 40, 320, 8)
  box(40, 324, 150, 16); draw(data.payorTin, 45, 336, 9)
  draw('Branch Code', 200, 320, 8)
  box(200, 324, 60, 16); draw(data.payorBranchCode, 205, 336, 9)

  draw("Payor's Name (Last Name, First Name, Middle Name)", 40, 360, 8)
  box(40, 364, 420, 16); draw(data.payorName, 45, 376, 9)

  draw('Registered Address', 40, 400, 8)
  box(40, 404, 360, 16); draw(data.payorAddress, 45, 416, 9)
  draw('ZIP Code', 410, 400, 8)
  box(410, 404, 60, 16); draw(data.payorZipCode, 415, 416, 9)

  // Part III — Details of Tax Withheld
  draw('Part III — Details of Monthly Income Payments and Tax Withheld', 40, 450, 10, bold)
  draw('ATC', 40, 470, 8, bold)
  box(40, 474, 60, 16); draw(data.atcCode, 55, 486, 9)
  draw('Amount of Payment', 110, 470, 8, bold)
  box(110, 474, 140, 16); draw(formatMoney(data.grossAmount), 115, 486, 9)
  draw('Tax Withheld for the Quarter', 260, 470, 8, bold)
  box(260, 474, 140, 16); draw(formatMoney(data.taxWithheldAmount), 265, 486, 9)

  // Totals
  draw('Total Taxes Withheld', 40, 520, 9, bold)
  box(260, 524, 140, 16); draw(formatMoney(data.taxWithheldAmount), 265, 536, 9, bold)

  // Part IV — Signatory Block
  draw('I declare, under the penalties of perjury, that this certificate has been made in good faith, verified by me, and to the best of my knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.', 40, 570, 7)

  draw('Signatory (Authorized Withholding Agent)', 40, 620, 8, bold)
  draw(data.signedByName, 40, 660, 10, bold)
  draw(`TIN: ${data.signedByTin}`, 40, 675, 9)
  page.drawLine({ start: { x: 40, y: 792 - 650 }, end: { x: 260, y: 792 - 650 }, thickness: 0.5, color: rgb(0,0,0) })

  // Signature stamp
  if (data.signatureImagePngBase64) {
    try {
      const sig = await pdfDoc.embedPng(Buffer.from(data.signatureImagePngBase64, 'base64'))
      const sigDims = sig.scale(0.4)
      page.drawImage(sig, {
        x: 50,
        y: 792 - 645 - sigDims.height,
        width: Math.min(sigDims.width, 200),
        height: Math.min(sigDims.height, 40),
      })
    } catch { /* skip on bad PNG */ }
  }

  // Footer
  draw('Issued automatically by Ayala Land Inc. under RA 8792 and RR 16-2021 durable authorization.', 40, 740, 7)
  draw(`Issued: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, 40, 752, 7)

  return await pdfDoc.save()
}
