'use client'
export function Bir2307Preview({ pdfDataUrl }: { pdfDataUrl: string }) {
  if (!pdfDataUrl) return <div className="text-slate-500">(no PDF rendered yet)</div>
  return <iframe src={pdfDataUrl} className="w-full h-[900px] border rounded bg-white" />
}
