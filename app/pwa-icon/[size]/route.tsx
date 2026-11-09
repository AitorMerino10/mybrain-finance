import { ImageResponse } from 'next/og'

// Iconos de la app (pantalla de inicio): se generan al compilar, sin ficheros de imagen.
export const dynamicParams = false
export function generateStaticParams() {
  return [{ size: '180' }, { size: '192' }, { size: '512' }]
}

export function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size) || 192
  const unit = size / 100
  const bars = [34, 52, 72]
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0f2a44 0%, #071A2B 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 * unit, height: 56 * unit }}>
          {bars.map((height, index) => (
            <div
              key={index}
              style={{
                width: 12 * unit,
                height: (height * 56 * unit) / 72,
                borderRadius: 4 * unit,
                background: index === 2 ? '#90EBD6' : index === 1 ? '#5fd3bb' : '#2fa68f',
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
