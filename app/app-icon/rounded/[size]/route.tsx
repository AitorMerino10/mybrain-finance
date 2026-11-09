import { ImageResponse } from 'next/og'
import { AppLogoSvg } from '@/lib/app-logo'

// Iconos con esquinas redondeadas y fondo transparente: notificaciones, favicon e instalación en Android.
// (El de la pantalla de inicio de iOS va en /app-icon/180, a sangre, porque iOS lo redondea solo.)
export const dynamicParams = false
export function generateStaticParams() {
  return [{ size: '192' }, { size: '512' }]
}

export function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size) || 192
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'transparent' }}>
        <AppLogoSvg size={size} rounded />
      </div>
    ),
    { width: size, height: size }
  )
}
