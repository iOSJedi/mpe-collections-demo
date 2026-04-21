// app/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', 'pdf-lib', '@pdf-lib/fontkit'],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
