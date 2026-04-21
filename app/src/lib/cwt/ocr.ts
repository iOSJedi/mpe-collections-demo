import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface OcrExtracted {
  payorTin: string | null
  payorName: string | null
  payeeTin: string | null
  payeeName: string | null
  atcCode: string | null
  grossAmount: number | null
  taxWithheldAmount: number | null
  periodStart: string | null
  periodEnd: string | null
  signedByName: string | null
  confidence: number
}

export async function extract2307(pdfBase64: string): Promise<OcrExtracted> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          payorTin: { type: SchemaType.STRING, nullable: true },
          payorName: { type: SchemaType.STRING, nullable: true },
          payeeTin: { type: SchemaType.STRING, nullable: true },
          payeeName: { type: SchemaType.STRING, nullable: true },
          atcCode: { type: SchemaType.STRING, nullable: true },
          grossAmount: { type: SchemaType.NUMBER, nullable: true },
          taxWithheldAmount: { type: SchemaType.NUMBER, nullable: true },
          periodStart: { type: SchemaType.STRING, nullable: true },
          periodEnd: { type: SchemaType.STRING, nullable: true },
          signedByName: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.NUMBER },
        }, required: ['confidence'],
      } as any,
    },
  })
  const res = await model.generateContent([
    { text: 'Extract every field of this BIR 2307 certificate. Return YYYY-MM-DD for dates.' },
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
  ])
  return JSON.parse(res.response.text())
}
