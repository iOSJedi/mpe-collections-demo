'use client'
import { ThreeWayMatch } from '@/components/payable/ThreeWayMatch'

export default function MatchingPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">GR/IR Reconciliation — 3-Way Matching</h1>
      <ThreeWayMatch />
    </div>
  )
}
