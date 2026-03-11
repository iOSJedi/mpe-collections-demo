'use client'
import { use } from 'react'
import { SupplierDetail } from '@/components/payable/SupplierDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default function SupplierDetailPage({ params }: Props) {
  const { id } = use(params)
  const supplierId = parseInt(id, 10)

  return (
    <div className="p-6 space-y-6">
      <SupplierDetail supplierId={supplierId} />
    </div>
  )
}
