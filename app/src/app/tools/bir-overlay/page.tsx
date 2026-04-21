import { COORDS } from '@/lib/cwt/pdf-coords'
import { OverlayEditor } from './OverlayEditor'

export default function Page() {
  return <OverlayEditor initialCoords={COORDS} />
}
