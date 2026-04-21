import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM = `You are a PH BIR withholding-tax classifier. Given a contract description and tenant type, return the correct ATC code and rate per RR 11-2018 / RR 2-98 §2.57.2. Known codes: WC100 (5% rent on real property, private lessee), WC640 (5% govt lessee), WC158 (2% services), null (not subject).`

export interface AtcSuggestion { code: string | null; ratePct: number; confidence: number; reasoning: string }

export async function classifyAtc(input: { contractDescription: string; tenantBusinessType: string; taxClassification: string }): Promise<AtcSuggestion> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          code: { type: SchemaType.STRING, nullable: true },
          ratePct: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.NUMBER },
          reasoning: { type: SchemaType.STRING },
        }, required: ['ratePct', 'confidence', 'reasoning'],
      } as any,
    },
  })
  const res = await model.generateContent([{ text: SYSTEM }, { text: JSON.stringify(input) }])
  return JSON.parse(res.response.text())
}
