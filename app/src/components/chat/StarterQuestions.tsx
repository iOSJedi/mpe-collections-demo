'use client'

import { MessageSquareText } from 'lucide-react'

const STARTER_QUESTIONS = [
  'What are the top selling products this month?',
  'Which wholesale buyers are at risk?',
  'Compare branch performance this quarter',
  'Show me customer segments breakdown',
  'Which products are frequently bought together?',
]

interface StarterQuestionsProps {
  onSelect: (question: string) => void
}

export function StarterQuestions({ onSelect }: StarterQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquareText className="h-8 w-8 text-primary" />
        <h2 className="text-xl font-semibold text-primary">Ask your data</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-8 text-center max-w-md">
        Ask questions about sales, customers, credit risk, and branch performance.
        Get answers with charts and actionable insights.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {STARTER_QUESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => onSelect(question)}
            className="rounded-xl border bg-card text-card-foreground px-4 py-3 text-sm text-left shadow-sm hover:bg-accent/10 hover:border-secondary transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}
