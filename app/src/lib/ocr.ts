import { GoogleGenerativeAI } from '@google/generative-ai'
import { OcrResult } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function extractPaymentDetails(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent([
    {
      inlineData: { mimeType, data: imageBase64 },
    },
    {
      text: `Analyze this payment proof document. Extract the following fields and return as JSON only:
{
  "payment_amount": <number or null>,
  "payment_date": "<ISO date string or null>",
  "reference_number": "<string or null>",
  "bank_name": "<string or null>",
  "payee_name": "<string or null - who received the payment>",
  "payer_name": "<string or null - who made the payment>",
  "document_type": "<check | bank_transfer | deposit_slip | other>"
}
Return ONLY the JSON object, no other text.`,
    },
  ])

  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to extract OCR data')
  return JSON.parse(jsonMatch[0]) as OcrResult
}
