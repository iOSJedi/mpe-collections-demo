import { createHash } from 'node:crypto'

export interface ReferenceInput {
  year: number
  month: number
  customerId: number
  invoiceId: number
  paymentId: number
}

export function referenceNumberFor(input: ReferenceInput): string {
  const prefix = `${input.year.toString().padStart(4, '0')}${input.month.toString().padStart(2, '0')}`
  const seed = `${input.customerId}-${input.invoiceId}-${input.paymentId}`
  const hash = createHash('sha1').update(seed).digest('hex')
  const hashAsInt = BigInt('0x' + hash.slice(0, 16)) % BigInt(1_000_000_000)
  const tail = hashAsInt.toString().padStart(9, '0')
  return prefix + tail
}
