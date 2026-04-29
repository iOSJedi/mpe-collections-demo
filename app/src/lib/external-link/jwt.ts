import jwt from 'jsonwebtoken'
import { ExternalPayLinkPayload } from '@/types'

const SECRET = process.env.QR_JWT_SECRET || 'demo-secret-change-in-production'

export function signExternalLinkToken(payload: ExternalPayLinkPayload): string {
  return jwt.sign(payload, SECRET)
}

export function verifyExternalLinkToken(token: string): ExternalPayLinkPayload {
  return jwt.verify(token, SECRET) as ExternalPayLinkPayload
}
