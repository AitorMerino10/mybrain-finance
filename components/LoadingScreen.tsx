'use client'

import { useEffect, useState } from 'react'

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Simular progreso de carga
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 2
      })
    }, 30)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#073763]">
      <div className="flex flex-col items-center gap-8">
        {/* Cerebro SVG con animación - Vista lateral */}
        <div className="relative">
          <svg
            width="240"
            height="240"
            viewBox="0 0 240 240"
            className="transform"
          >
            {/* Contorno principal del cerebro (vista lateral) */}
            <path
              d="M 40 80 Q 30 60, 40 40 Q 50 20, 70 30 Q 90 40, 100 50 Q 110 60, 120 70 Q 130 80, 140 85 Q 150 90, 160 95 Q 170 100, 180 105 Q 190 110, 200 115 Q 210 120, 200 130 Q 190 140, 180 145 Q 170 150, 160 155 Q 150 160, 140 165 Q 130 170, 120 175 Q 110 180, 100 185 Q 90 190, 80 195 Q 70 200, 60 200 Q 50 200, 40 190 Q 30 180, 30 170 Q 30 160, 35 150 Q 40 140, 45 130 Q 50 120, 50 110 Q 50 100, 45 90 Z"
              stroke={progress > 10 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2.5"
              fill="none"
              className="transition-colors duration-500"
            />
            
            {/* Líneas de circunvoluciones - Parte frontal */}
            <path
              d="M 60 50 Q 70 45, 80 50 Q 90 55, 95 60"
              stroke={progress > 20 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 70 70 Q 80 65, 90 70 Q 100 75, 105 80"
              stroke={progress > 30 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            
            {/* Líneas de circunvoluciones - Parte central superior */}
            <path
              d="M 100 60 Q 110 55, 120 60 Q 130 65, 135 70"
              stroke={progress > 40 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 110 80 Q 120 75, 130 80 Q 140 85, 145 90"
              stroke={progress > 50 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            
            {/* Líneas de circunvoluciones - Parte central */}
            <path
              d="M 120 100 Q 130 95, 140 100 Q 150 105, 155 110"
              stroke={progress > 60 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 130 120 Q 140 115, 150 120 Q 160 125, 165 130"
              stroke={progress > 70 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            
            {/* Líneas de circunvoluciones - Parte posterior */}
            <path
              d="M 140 140 Q 150 135, 160 140 Q 170 145, 175 150"
              stroke={progress > 80 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 150 160 Q 160 155, 170 160 Q 180 165, 185 170"
              stroke={progress > 90 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="2"
              fill="none"
              className="transition-colors duration-500"
            />
            
            {/* Líneas de conexión internas */}
            <path
              d="M 80 90 L 100 95"
              stroke={progress > 15 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="1.5"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 100 110 L 120 115"
              stroke={progress > 25 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="1.5"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 120 130 L 140 135"
              stroke={progress > 35 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="1.5"
              fill="none"
              className="transition-colors duration-500"
            />
            <path
              d="M 90 130 L 110 135"
              stroke={progress > 45 ? '#90EBD6' : '#2D5F4F'}
              strokeWidth="1.5"
              fill="none"
              className="transition-colors duration-500"
            />
          </svg>
        </div>

        {/* Texto */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-bold text-white">MyBrain</h1>
          <p className="text-lg text-[#90EBD6] font-medium">finance</p>
        </div>
      </div>
    </div>
  )
}

