'use client'
import { EscalationQueue } from '@/components/collections/EscalationQueue'

export default function EscalationsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Escalation Queue</h1>
      <EscalationQueue />
    </div>
  )
}
