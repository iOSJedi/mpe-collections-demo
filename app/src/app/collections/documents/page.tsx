'use client'
import { DocumentVerification } from '@/components/collections/DocumentVerification'

export default function DocumentsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Document Verification</h1>
      <DocumentVerification />
    </div>
  )
}
