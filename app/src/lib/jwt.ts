import jwt from 'jsonwebtoken'
import { QrPayload } from '@/types'

const SECRET = process.env.QR_JWT_SECRET || 'demo-secret-change-in-production'

export function signQrToken(payload: QrPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' })
}

export function verifyQrToken(token: string): QrPayload {
  return jwt.verify(token, SECRET) as QrPayload
}
