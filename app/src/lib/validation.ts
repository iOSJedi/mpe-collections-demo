import { OcrResult, ValidationResult, ValidationCheck } from '@/types'

interface InvoiceContext {
  invoiceNumber: string
  amount: number
  balanceRemaining: number
  dueDate: string
  customerName: string
  issuedAt: string
}

export function validateDocument(
  ocr: OcrResult,
  context: InvoiceContext,
  uploadingCustomerName: string,
  existingReferenceNumbers: string[]
): ValidationResult {
  const checks: ValidationCheck[] = []

  // PAYER_MISMATCH
  if (ocr.payer_name) {
    const nameMatch = fuzzyMatch(ocr.payer_name, uploadingCustomerName)
    checks.push({
      check: 'PAYER_MISMATCH',
      passed: nameMatch,
      expected: uploadingCustomerName,
      actual: ocr.payer_name,
      severity: nameMatch ? 'info' : 'critical',
    })
  }

  // AMOUNT_MISMATCH
  if (ocr.payment_amount !== null) {
    const amountMatch =
      Math.abs(ocr.payment_amount - context.balanceRemaining) < 0.01 ||
      ocr.payment_amount <= context.balanceRemaining
    checks.push({
      check: 'AMOUNT_MISMATCH',
      passed: amountMatch,
      expected: String(context.balanceRemaining),
      actual: String(ocr.payment_amount),
      severity: amountMatch ? 'info' : 'warning',
    })
  }

  // DATE_MISMATCH
  if (ocr.payment_date) {
    const payDate = new Date(ocr.payment_date)
    const issueDate = new Date(context.issuedAt)
    const dateValid = payDate >= issueDate
    checks.push({
      check: 'DATE_MISMATCH',
      passed: dateValid,
      expected: `After ${context.issuedAt}`,
      actual: ocr.payment_date,
      severity: dateValid ? 'info' : 'warning',
    })
  }

  // DUPLICATE
  if (ocr.reference_number) {
    const isDuplicate = existingReferenceNumbers.includes(ocr.reference_number)
    checks.push({
      check: 'DUPLICATE',
      passed: !isDuplicate,
      expected: 'Unique reference',
      actual: isDuplicate ? 'Already used' : ocr.reference_number,
      severity: isDuplicate ? 'critical' : 'info',
    })
  }

  return {
    is_valid: checks.every(c => c.passed),
    checks,
  }
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a))
}
