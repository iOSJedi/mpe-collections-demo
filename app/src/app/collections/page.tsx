'use client'
import { Worklist } from '@/components/collections/Worklist'

export default function CollectionsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Collections Worklist</h1>
      <Worklist />
    </div>
  )
}
