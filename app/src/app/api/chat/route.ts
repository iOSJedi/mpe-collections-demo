import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { chat, type ChatMessage } from '@/lib/gemini'

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()

    const question = body.question as string | undefined
    const clientMessages = (body.messages || []) as { role: string; content: string }[]

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const currentDate = new Date().toISOString().split('T')[0]

    // Build history from client messages, filtering out empty assistant messages
    const history: ChatMessage[] = clientMessages
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    // Append the current question
    history.push({ role: 'user', content: question })

    const result = await chat(history, currentDate)

    return NextResponse.json({
      answer_text: result.answer_text,
      chart_config: result.chart_config || null,
      follow_up_suggestions: result.follow_up_suggestions || [],
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        answer_text:
          'Sorry, I encountered an error processing your question. Please try again.',
        chart_config: null,
        follow_up_suggestions: [
          'What are the top selling products?',
          'Show me branch performance',
        ],
      },
      { status: 200 }
    ) // Return 200 with error message for better UX
  }
})
