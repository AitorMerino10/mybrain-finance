import { ImageResponse } from 'next/og'
import { AppLogoSvg, LOGO_BG } from '@/lib/app-logo'
import { SPLASH_SLOGAN, SPLASH_TITLE, splashSizes } from '@/lib/app-splash'

// Imágenes de arranque de iOS (apple-touch-startup-image): lo que se ve al abrir la app instalada, antes de que cargue.
// Mismas proporciones que el componente SplashScreen para que el paso de una a otra sea imperceptible.
export const dynamicParams = false
export function generateStaticParams() {
  return splashSizes.map((size) => ({ size }))
}

export function GET(_request: Request, { params }: { params: { size: string } }) {
  const [width, height] = params.size.split('x').map(Number)
  const w = width || 1170
  const h = height || 2532
  const logo = Math.round(Math.min(w * 0.28, 140 * (w / 390)))
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: LOGO_BG,
          paddingBottom: Math.round(h * 0.04),
        }}
      >
        <AppLogoSvg size={logo} />
        <div style={{ display: 'flex', marginTop: Math.round(w * 0.05), fontSize: Math.round(w * 0.085), fontWeight: 700, color: '#FFFFFF' }}>{SPLASH_TITLE}</div>
        <div style={{ display: 'flex', marginTop: Math.round(w * 0.02), fontSize: Math.round(w * 0.04), color: '#90EBD6' }}>{SPLASH_SLOGAN}</div>
      </div>
    ),
    { width: w, height: h }
  )
}
