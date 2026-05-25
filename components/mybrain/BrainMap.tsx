'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react'

export const BRAIN_MAP_VIEWBOX_W = 134
export const BRAIN_MAP_VIEWBOX_H = 130
const VIEWBOX_W = BRAIN_MAP_VIEWBOX_W
const VIEWBOX_H = BRAIN_MAP_VIEWBOX_H

const headProfilePath =
  'M 52 8 C 88 4 116 14 122 36 C 124 42 121 46 118 48 L 128 64 L 114 70 C 116 76 114 80 110 84 L 113 88 L 108 92 C 100 102 92 106 88 112 L 88 124 L 50 124 L 50 112 C 50 104 46 100 42 96 C 22 90 8 74 8 56 C 8 30 24 12 52 8 Z'

const ROUTE_PUSH_DELAY_MS = 920

export type BrainNode = {
  id: string
  name: string
  logo: string
  color?: string | null
  x: number
  y: number
  size: number
  isActive?: boolean
  href?: string
}

export type BrainConnection = readonly [number, number]

interface BrainMapProps {
  nodes: BrainNode[]
  connections: ReadonlyArray<BrainConnection>
  topRightAction?: ReactNode
  topLeftAction?: ReactNode
  className?: string
  uniqueId?: string
  showSilhouette?: boolean
  draggable?: boolean
  bare?: boolean
  onNodePositionChange?: (nodeId: string, x: number, y: number) => void
  onNodePositionCommit?: (nodeId: string, x: number, y: number) => void
}

export default function BrainMap({
  nodes,
  connections,
  topRightAction,
  topLeftAction,
  className = '',
  uniqueId = 'default',
  showSilhouette = true,
  draggable = false,
  bare = false,
  onNodePositionChange,
  onNodePositionCommit,
}: BrainMapProps) {
  const router = useRouter()
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const [enteringOrigin, setEnteringOrigin] = useState({ x: 50, y: 50 })
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    id: string
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    latestX: number
    latestY: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef<string | null>(null)

  useEffect(() => {
    nodes.forEach((node) => {
      if (node.href) router.prefetch(node.href)
    })
  }, [nodes, router])

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [])

  function handleNodeClick(
    event: MouseEvent<HTMLAnchorElement>,
    node: BrainNode,
  ) {
    if (suppressClickRef.current === node.id) {
      event.preventDefault()
      suppressClickRef.current = null
      return
    }
    if (!node.href) return
    if (enteringId) return
    event.preventDefault()
    const rect = mapRef.current?.getBoundingClientRect()
    if (rect) {
      setEnteringOrigin({
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      })
    }
    setEnteringId(node.id)
    window.dispatchEvent(
      new CustomEvent('mybrain:route-transition-start', {
        detail: {
          x: event.clientX,
          y: event.clientY,
        },
      }),
    )
    navTimerRef.current = setTimeout(() => {
      if (node.href) router.push(node.href)
    }, ROUTE_PUSH_DELAY_MS)
  }

  function clampNodePosition(node: BrainNode, x: number, y: number) {
    return {
      x: Math.max(node.size, Math.min(VIEWBOX_W - node.size, x)),
      y: Math.max(node.size, Math.min(VIEWBOX_H - node.size, y)),
    }
  }

  function handlePointerDown(
    event: PointerEvent<HTMLAnchorElement | HTMLDivElement>,
    node: BrainNode,
  ) {
    if (!draggable || enteringId) return

    dragRef.current = {
      id: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      latestX: node.x,
      latestY: node.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement | HTMLDivElement>) {
    const drag = dragRef.current
    const rect = mapRef.current?.getBoundingClientRect()
    if (!drag || !rect) return

    const node = nodes.find((candidate) => candidate.id === drag.id)
    if (!node) return

    const dx = ((event.clientX - drag.startClientX) / rect.width) * VIEWBOX_W
    const dy = ((event.clientY - drag.startClientY) / rect.height) * VIEWBOX_H
    const next = clampNodePosition(node, drag.startX + dx, drag.startY + dy)
    const hasMoved =
      Math.abs(event.clientX - drag.startClientX) > 4 ||
      Math.abs(event.clientY - drag.startClientY) > 4

    drag.latestX = next.x
    drag.latestY = next.y
    drag.moved = drag.moved || hasMoved
    onNodePositionChange?.(drag.id, next.x, next.y)
  }

  function handlePointerUp(event: PointerEvent<HTMLAnchorElement | HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.moved) {
      suppressClickRef.current = drag.id
      onNodePositionCommit?.(drag.id, drag.latestX, drag.latestY)
    }
    dragRef.current = null
  }

  const hazeId = `brainHaze-${uniqueId}`
  const softBlurId = `softBlur-${uniqueId}`

  const isEntering = enteringId !== null
  const sceneStyle: CSSProperties = {
    transformOrigin: `${enteringOrigin.x}% ${enteringOrigin.y}%`,
    transform: isEntering
      ? 'scale(2.55) translate3d(0, 0, 0)'
      : 'scale(1) translate3d(0, 0, 0)',
    transition:
      'transform 920ms cubic-bezier(0.16, 1, 0.3, 1), filter 920ms cubic-bezier(0.16, 1, 0.3, 1)',
    filter: isEntering ? 'saturate(1.12) brightness(1.08)' : 'none',
    willChange: 'transform, filter',
  }

  return (
    <div
      ref={mapRef}
      className={`relative w-full overflow-hidden ${
        bare
          ? ''
          : 'rounded-[36px] bg-[radial-gradient(circle_at_50%_22%,rgba(68,108,180,0.24)_0%,rgba(26,40,71,0.45)_34%,rgba(15,23,42,0.96)_100%)] p-3 shadow-[0_30px_90px_rgba(5,10,24,0.45)] sm:p-6'
      } ${className}`}
      style={
        bare
          ? { containerType: 'inline-size' }
          : {
              aspectRatio: `${VIEWBOX_W} / ${VIEWBOX_H}`,
              containerType: 'inline-size',
            }
      }
    >
      <div className="absolute inset-0" style={sceneStyle}>
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{ opacity: isEntering ? 0.42 : 1 }}
        >
          <div className="pointer-events-none absolute inset-x-12 top-6 h-32 rounded-full bg-[#7AA0FF]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-12 left-10 h-28 w-28 rounded-full bg-[#90EBD6]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-12 right-12 h-24 w-24 rounded-full bg-[#7AA0FF]/8 blur-3xl" />
        </div>

      {topRightAction && (
        <div
          className="absolute right-3 top-3 z-30 transition-opacity duration-200 sm:right-5 sm:top-5"
          style={{
            opacity: isEntering ? 0 : 1,
            pointerEvents: isEntering ? 'none' : 'auto',
          }}
        >
          {topRightAction}
        </div>
      )}
      {topLeftAction && (
        <div
          className="absolute left-3 top-3 z-30 transition-opacity duration-200 sm:left-5 sm:top-5"
          style={{
            opacity: isEntering ? 0 : 1,
            pointerEvents: isEntering ? 'none' : 'auto',
          }}
        >
          {topLeftAction}
        </div>
      )}

        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio={bare ? 'none' : 'xMidYMid meet'}
          className="absolute inset-0 h-full w-full transition-opacity duration-700"
          style={{ opacity: isEntering ? 0.18 : 1 }}
          fill="none"
        >
        <defs>
          <radialGradient id={hazeId} cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor="rgba(125,154,212,0.22)" />
            <stop offset="100%" stopColor="rgba(125,154,212,0)" />
          </radialGradient>
          <filter
            id={softBlurId}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>

        {showSilhouette && (
          <>
            <ellipse cx="60" cy="52" rx="62" ry="50" fill={`url(#${hazeId})`} />

            <path
              d={headProfilePath}
              fill="rgba(122,143,190,0.05)"
              stroke="rgba(168,181,217,0.32)"
              strokeWidth="0.6"
            />

            <path
              d={headProfilePath}
              fill="none"
              stroke="rgba(168,181,217,0.16)"
              strokeWidth="2.4"
              filter={`url(#${softBlurId})`}
            />
          </>
        )}

        {connections.map(([i, j], k) => {
          const a = nodes[i]
          const b = nodes[j]
          if (!a || !b) return null
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const offset = 2.8
          const perpX = (-dy / len) * offset
          const perpY = (dx / len) * offset
          const midX = (a.x + b.x) / 2 + perpX
          const midY = (a.y + b.y) / 2 + perpY
          return (
            <g key={`c-${k}`}>
              <path
                d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
                stroke="rgba(174,205,255,0.22)"
                strokeWidth="0.4"
                strokeLinecap="round"
              />
              <circle
                cx={midX}
                cy={midY}
                r="0.55"
                fill="rgba(255,255,255,0.5)"
              />
            </g>
          )
        })}
        </svg>

        {nodes.map((node) => {
          const isThis = enteringId === node.id
          const sizePct = (node.size / VIEWBOX_W) * 100
          const leftPct = (node.x / VIEWBOX_W) * 100
          const topPct = (node.y / VIEWBOX_H) * 100

          const containerStyle: CSSProperties = {
            position: 'absolute',
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${sizePct}cqw`,
            transform: isThis
              ? 'translate(-50%, -50%) scale(1.32)'
              : isEntering
                ? 'translate(-50%, -50%) scale(0.72)'
                : 'translate(-50%, -50%) scale(1)',
            opacity: isEntering && !isThis ? 0 : 1,
            zIndex: isThis ? 60 : 10,
            transition:
              'transform 760ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease-out',
            pointerEvents: isEntering ? 'none' : 'auto',
            cursor: draggable ? 'grab' : 'pointer',
            touchAction: draggable ? 'none' : 'auto',
            userSelect: 'none',
            containerType: 'inline-size',
            willChange: 'transform, opacity',
          }

        const bubbleStyle: CSSProperties = {
          background:
            'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.22) 0%, rgba(95,118,170,0.4) 55%, rgba(50,65,108,0.62) 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow:
            '0 8px 18px rgba(8,12,28,0.4), inset 0 1px 2px rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.22)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }

        const inner = (
          <div
            className="relative aspect-square w-full rounded-full transition-transform duration-200 group-hover:scale-105"
            style={bubbleStyle}
          >
            <div
              className="absolute rounded-full"
              style={{
                left: '14%',
                top: '12%',
                width: '40%',
                height: '24%',
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)',
                filter: 'blur(0.5px)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                style={{
                  fontSize: '46cqw',
                  lineHeight: 1,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  textShadow: '0 1px 2px rgba(8,16,30,0.55)',
                }}
              >
                {node.logo}
              </span>
            </div>
          </div>
        )

        const label = (
          <div
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center font-semibold text-white"
            style={{
              top: 'calc(100% + 6px)',
              fontSize: 'clamp(9px, 1.5cqw, 12px)',
              textShadow: '0 1px 4px rgba(5,12,28,0.6)',
              letterSpacing: '0.01em',
              opacity: isThis ? 0 : 1,
              transition: 'opacity 220ms ease-out',
            }}
          >
            {node.name}
          </div>
        )

          if (node.href) {
            return (
              <a
                key={node.id}
                href={node.href}
                aria-label={node.name}
                onClick={(e) => handleNodeClick(e, node)}
                onPointerDown={(e) => handlePointerDown(e, node)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="group"
                style={containerStyle}
              >
                {inner}
                {label}
              </a>
            )
          }

          return (
            <div
              key={node.id}
              onPointerDown={(e) => handlePointerDown(e, node)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={containerStyle}
              className="group"
            >
              {inner}
              {label}
            </div>
          )
        })}
      </div>

    </div>
  )
}
