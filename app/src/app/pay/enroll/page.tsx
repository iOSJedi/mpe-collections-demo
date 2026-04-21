import { EnrollmentForm } from '@/components/cwt/EnrollmentForm'

export default async function Page({ searchParams }: { searchParams: Promise<{ customerId?: string; token?: string }> }) {
  const sp = await searchParams
  return <EnrollmentForm customerId={Number(sp.customerId ?? 0)} qrToken={sp.token ?? ''} />
}
