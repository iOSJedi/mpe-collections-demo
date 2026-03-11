'use client'
import { useParams } from 'next/navigation'
import { CustomerDetail } from '@/components/receivable/CustomerDetail'

export default function CustomerDetailPage() {
  const params = useParams()
  const customerId = Number(params.id)
  return <CustomerDetail customerId={customerId} />
}
