import { ImageResponse } from 'next/og'
import { AppLogoSvg, LOGO_BG } from '@/lib/app-logo'

// Iconos de la app (pantalla de inicio): se generan al compilar, sin ficheros de imagen.
export const dynamicParams = false
export function generateStaticParams() {
  return [{ size: '180' }, { size: '192' }, { size: '512' }]
}

export function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size) || 192
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: LOGO_BG }}>
        <AppLogoSvg size={size} />
      </div>
    ),
    { width: size, height: size }
  )
}
