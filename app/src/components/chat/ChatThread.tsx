'use client'

import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { cn } from '@/lib/utils'

interface ChatThreadProps {
  messages: ChatMessage[]
  isLoading: boolean
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return new Date(timestamp).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getContextualLoadingMessage(lastQuestion: string | undefined): string {
  if (!lastQuestion) return 'Analyzing your data'

  const q = lastQuestion.toLowerCase()
  if (q.includes('wholesale') || q.includes('buyer'))
    return 'Asking your data about wholesale trends'
  if (q.includes('customer') || q.includes('churn') || q.includes('segment'))
    return 'Digging into customer patterns'
  if (q.includes('branch') || q.includes('store') || q.includes('location'))
    return 'Comparing branch performance'
  if (q.includes('revenue') || q.includes('sales') || q.includes('profit'))
    return 'Crunching the revenue numbers'
  if (q.includes('product') || q.includes('category') || q.includes('basket'))
    return 'Analyzing product trends'
  if (q.includes('credit') || q.includes('overdue') || q.includes('payment'))
    return 'Reviewing credit and payment data'
  if (q.includes('forecast') || q.includes('predict') || q.includes('next month'))
    return 'Running the forecast model'
  return 'Analyzing your data'
}

function ThinkingIndicator({ lastUserQuestion }: { lastUserQuestion?: string }) {
  const message = getContextualLoadingMessage(lastUserQuestion)

  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-card border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{message}</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse" style={{ animationDelay: '200ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse" style={{ animationDelay: '400ms' }} />
          </span>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-start gap-3', isUser ? 'flex-row-reverse' : 'flex-row', 'max-w-[85%]', isUser ? 'ml-auto' : 'mr-auto')}>
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-card border text-card-foreground shadow-sm'
          )}
        >
          {message.content}
        </div>
        <span
          className={cn(
            'text-[11px] text-muted-foreground/70 px-1',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

export function ChatThread({ messages, isLoading }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Find the last user message for contextual loading
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <ThinkingIndicator lastUserQuestion={lastUserMessage?.content} />}
    </div>
  )
}
