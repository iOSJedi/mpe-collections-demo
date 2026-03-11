'use client'

import { useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/components/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner'
import { useAppDispatch, useAppSelector } from '@/store'
import { setActiveView } from '@/store/slices/navSlice'
import {
  addMessage,
  setLoading,
  setCurrentChart,
  setFollowUpSuggestions,
  clearChat,
} from '@/store/slices/chatSlice'
import { apiFetch } from '@/lib/api'
import { StarterQuestions } from '@/components/chat/StarterQuestions'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChartPanel } from '@/components/chat/ChartPanel'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

function useSendQuestion() {
  const dispatch = useAppDispatch()
  const messagesRef = useRef<{ role: string; content: string }[]>([])

  // Keep a ref of messages for the closure
  const messages = useAppSelector((state) => state.chat.messages)
  useEffect(() => {
    messagesRef.current = messages.map((m) => ({ role: m.role, content: m.content }))
  }, [messages])

  return useCallback(
    async (question: string) => {
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: question,
        timestamp: Date.now(),
      }
      dispatch(addMessage(userMsg))
      dispatch(setLoading(true))
      dispatch(setFollowUpSuggestions([]))

      try {
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            messages: messagesRef.current,
          }),
        })

        if (!res.ok) throw new Error('Chat request failed')

        const data = await res.json()

        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: data.answer_text || 'I could not generate a response. Please try again.',
          chartConfig: data.chart_config ?? null,
          followUpSuggestions: data.follow_up_suggestions ?? [],
          timestamp: Date.now(),
        }
        dispatch(addMessage(assistantMsg))
        dispatch(setCurrentChart(data.chart_config ?? null))
        dispatch(setFollowUpSuggestions(data.follow_up_suggestions ?? []))
      } catch (err) {
        console.error('Chat error:', err)
        const errorMsg = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant' as const,
          content:
            'Sorry, I was unable to process your request. Please check your connection and try again.',
          timestamp: Date.now(),
        }
        dispatch(addMessage(errorMsg))
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch]
  )
}

function ChatContent({ sendQuestion }: { sendQuestion: (q: string) => void }) {
  const dispatch = useAppDispatch()
  const { messages, isLoading, currentChart, followUpSuggestions } = useAppSelector(
    (state) => state.chat
  )

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left column: Chat */}
      <div className="flex-1 lg:w-3/5 flex flex-col min-h-0 border-r border-border/50">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-background/80 backdrop-blur-sm flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">Ask your data</h1>
            <p className="text-xs text-muted-foreground">
              Get answers, charts, and insights from your business data
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(clearChat())}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              New chat
            </Button>
          )}
        </div>

        {/* Messages or starter */}
        {messages.length === 0 && !isLoading ? (
          <StarterQuestions onSelect={sendQuestion} />
        ) : (
          <ChatThread messages={messages} isLoading={isLoading} />
        )}

        {/* Follow-up suggestions */}
        {followUpSuggestions.length > 0 && !isLoading && (
          <div className="px-4 py-2 flex-shrink-0 border-t bg-background/50">
            <div className="flex flex-wrap gap-2">
              {followUpSuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => sendQuestion(suggestion)}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile: inline chart panel after messages */}
        {currentChart && messages.length > 0 && (
          <div className="lg:hidden border-t bg-muted/30 flex-shrink-0">
            <ChartPanel config={currentChart} />
          </div>
        )}

        {/* Input */}
        <ChatInput onSend={sendQuestion} disabled={isLoading} />
      </div>

      {/* Right column: Chart panel (desktop only) */}
      <div className="hidden lg:flex lg:w-2/5 flex-col bg-muted/20 min-h-0 overflow-y-auto">
        <div className="px-4 py-3 border-b flex-shrink-0">
          <h2 className="text-sm font-semibold text-primary">Visualization</h2>
        </div>
        <div className="flex-1">
          <ChartPanel config={currentChart} />
        </div>
      </div>
    </div>
  )
}

function ChatPageWithParams() {
  const searchParams = useSearchParams()
  const { messages, isLoading } = useAppSelector((state) => state.chat)
  const sendQuestion = useSendQuestion()
  const autoSentRef = useRef(false)

  // Auto-send from ?q= query param on mount
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && messages.length === 0 && !isLoading && !autoSentRef.current) {
      autoSentRef.current = true
      sendQuestion(q)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <ChatContent sendQuestion={sendQuestion} />
}

export default function ChatPage() {
  const { user, loading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(setActiveView('chat'))
  }, [dispatch])

  if (loading) return <PageLoadingSpinner message="Loading chat..." />

  if (!user) return <LoginPage />

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Loading chat...</p>
          </div>
        }
      >
        <ChatPageWithParams />
      </Suspense>
    </AppShell>
  )
}
