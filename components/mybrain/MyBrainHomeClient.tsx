'use client'

import { useState } from 'react'
import type { MyBrainBrainRegion, MyBrainSectionCard } from '@/types/mybrain'
import CreateSectionModal from './CreateSectionModal'
import BrainMap, {
  BRAIN_MAP_VIEWBOX_H,
  BRAIN_MAP_VIEWBOX_W,
  type BrainConnection,
  type BrainNode,
} from './BrainMap'

interface MyBrainHomeClientProps {
  userId: string
  sections: MyBrainSectionCard[]
  firstName: string
}

const headRegionAnchors: Record<MyBrainBrainRegion, { x: number; y: number }> =
  {
    frontal_right: { x: 102, y: 26 },
    frontal_left: { x: 76, y: 16 },
    parietal_right: { x: 96, y: 50 },
    parietal_left: { x: 52, y: 42 },
    temporal_right: { x: 98, y: 70 },
    temporal_left: { x: 66, y: 64 },
    occipital_right: { x: 28, y: 28 },
    occipital_left: { x: 22, y: 60 },
    cerebellum: { x: 60, y: 86 },
  }

function getOffsetPosition(
  anchor: { x: number; y: number },
  index: number,
  total: number,
) {
  if (total === 1) return anchor
  const angle = (index / total) * Math.PI * 2 - Math.PI / 4
  const radius = total === 2 ? 5 : total <= 4 ? 7 : 9
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  }
}

function toViewBoxX(positionX: number) {
  return (positionX / 100) * BRAIN_MAP_VIEWBOX_W
}

function toViewBoxY(positionY: number) {
  return (positionY / 100) * BRAIN_MAP_VIEWBOX_H
}

function toStoredX(x: number) {
  return (x / BRAIN_MAP_VIEWBOX_W) * 100
}

function toStoredY(y: number) {
  return (y / BRAIN_MAP_VIEWBOX_H) * 100
}

function computeNodeSize(
  section: MyBrainSectionCard,
  all: MyBrainSectionCard[],
) {
  if (all.length <= 1) return 18
  const counts = all.map((s) => s.entryCount)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  if (max === min) return 14
  const t = (section.entryCount - min) / (max - min)
  return 10 + t * 12
}

function getSectionLogo(section: MyBrainSectionCard) {
  if (section.logo && section.logo.trim().length > 0) {
    return section.logo
  }
  return section.isSystemSection ? '€' : section.name.charAt(0).toUpperCase()
}

function buildConnections(nodes: BrainNode[]): BrainConnection[] {
  if (nodes.length < 2) return []
  const set = new Set<string>()
  nodes.forEach((node, i) => {
    const ranked = nodes
      .map((other, j) => ({
        idx: j,
        dist: Math.hypot(node.x - other.x, node.y - other.y),
      }))
      .filter((entry) => entry.idx !== i)
      .sort((a, b) => a.dist - b.dist)

    const neighborCount = nodes.length <= 4 ? 1 : 2
    ranked.slice(0, neighborCount).forEach((entry) => {
      const key =
        i < entry.idx ? `${i}-${entry.idx}` : `${entry.idx}-${i}`
      set.add(key)
    })
  })
  return Array.from(set).map(
    (key) => key.split('-').map((value) => Number(value)) as [number, number],
  )
}

export default function MyBrainHomeClient({
  userId,
  sections,
  firstName,
}: MyBrainHomeClientProps) {
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({})
  const personalSections = sections.filter((s) => !s.isSystemSection)

  const sectionsByRegion = new Map<MyBrainBrainRegion, MyBrainSectionCard[]>()
  for (const section of sections) {
    const list = sectionsByRegion.get(section.brainRegion) || []
    list.push(section)
    sectionsByRegion.set(section.brainRegion, list)
  }

  const nodes: BrainNode[] = []
  for (const [region, list] of Array.from(sectionsByRegion.entries())) {
    const anchor = headRegionAnchors[region]
    if (!anchor) continue

    list.forEach((section, idx) => {
      const fallbackPos = getOffsetPosition(anchor, idx, list.length)
      const storedPos =
        typeof section.brainPositionX === 'number' &&
        typeof section.brainPositionY === 'number'
          ? {
              x: toViewBoxX(section.brainPositionX),
              y: toViewBoxY(section.brainPositionY),
            }
          : null
      const pos = positionOverrides[section.id] || storedPos || fallbackPos
      const baseSize = computeNodeSize(section, sections)

      nodes.push({
        id: section.id,
        name: section.name,
        logo: getSectionLogo(section),
        color: null,
        x: pos.x,
        y: pos.y,
        size: baseSize,
        isActive: false,
        href: section.href,
      })
    })
  }

  const connections = buildConnections(nodes)

  function handleNodePositionChange(sectionId: string, x: number, y: number) {
    setPositionOverrides((current) => ({
      ...current,
      [sectionId]: { x, y },
    }))
  }

  async function handleNodePositionCommit(sectionId: string, x: number, y: number) {
    try {
      await fetch(`/api/mybrain/sections/${sectionId}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x: toStoredX(x),
          y: toStoredY(y),
        }),
      })
    } catch (error) {
      console.error('Error al guardar la posicion del nodo:', error)
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="px-4 pb-2 pt-3 text-xl font-bold italic text-white sm:px-6 sm:text-2xl md:text-3xl lg:px-8">
        Howdy, {firstName}!
      </h1>

      {sections.length > 0 ? (
        <BrainMap
          nodes={nodes}
          connections={connections}
          uniqueId="home"
          className="h-[calc(100vh-220px)] min-h-[420px] sm:h-[calc(100vh-200px)]"
          bare
          showSilhouette={false}
          draggable
          onNodePositionChange={handleNodePositionChange}
          onNodePositionCommit={handleNodePositionCommit}
        />
      ) : (
        <div className="mx-4 mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6 text-center sm:mx-6 lg:mx-8">
          <h4 className="text-xl font-bold text-white">
            Tu primera sección empieza aquí
          </h4>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#A8B5D9] sm:text-base">
            Crea una sección y aparecerá en tu mapa para empezar a llenarla con
            recuerdos.
          </p>
          <div className="mt-6 flex justify-center">
            <CreateSectionModal userId={userId} />
          </div>
        </div>
      )}
    </div>
  )
}
