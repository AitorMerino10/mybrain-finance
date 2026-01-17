'use client'

import { useState, useRef, useEffect } from 'react'

interface HelpTooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export default function HelpTooltip({ content, position = 'top', className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const top = position === 'bottom'
      ? rect.bottom + 8
      : rect.top - 8
    setTooltipStyle({ top })
  }, [isOpen, position])

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onBlur={() => setIsOpen(false)}
        ref={buttonRef}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#90EBD6]/20 text-[#90EBD6] hover:bg-[#90EBD6]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/50"
        aria-label="Ayuda"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={`fixed z-50 w-64 p-3 text-sm text-gray-700 bg-white rounded-lg shadow-lg border border-gray-200 left-1/2 -translate-x-1/2 ${
            position === 'bottom' ? 'translate-y-0' : '-translate-y-full'
          }`}
          style={tooltipStyle ? { top: tooltipStyle.top } : undefined}
          role="tooltip"
        >
          <p className="leading-relaxed">{content}</p>
          {/* Flecha */}
          <div
            className={`absolute w-2 h-2 bg-white border border-gray-200 left-1/2 -translate-x-1/2 rotate-45 ${
              position === 'bottom'
                ? 'top-0 -translate-y-1/2 border-b-0 border-r-0'
                : 'bottom-0 translate-y-1/2 border-t-0 border-l-0'
            }`}
          />
        </div>
      )}
    </div>
  )
}
