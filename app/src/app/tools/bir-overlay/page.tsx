import { loadCoords } from '@/lib/cwt/pdf-coords'
import { OverlayEditor } from './OverlayEditor'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const coords = await loadCoords()
  return <OverlayEditor initialCoords={coords} />
}
