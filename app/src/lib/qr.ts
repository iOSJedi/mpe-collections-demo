import QRCode from 'qrcode'

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#003B1F', light: '#FFFFFF' },
  })
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', width: 300, margin: 2 })
}
