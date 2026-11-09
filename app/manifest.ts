import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyBrain finance',
    short_name: 'MyBrain',
    description: 'Gestión de finanzas personales y familiares',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#071A2B',
    theme_color: '#071A2B',
    icons: [
      { src: '/app-icon/rounded/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/rounded/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
