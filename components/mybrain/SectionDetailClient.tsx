'use client'

import { useState } from 'react'
import EntryList from './EntryList'
import SectionHeader from './SectionHeader'
import type {
  MyBrainEntryWithValues,
  MyBrainSectionWithFields,
} from '@/types/mybrain'

interface SectionDetailClientProps {
  section: MyBrainSectionWithFields
  userId: string
  entries: MyBrainEntryWithValues[]
}

export default function SectionDetailClient({
  section,
  userId,
  entries,
}: SectionDetailClientProps) {
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div className="space-y-4">
      <SectionHeader
        section={section}
        userId={userId}
        showConfig={showConfig}
        onToggleConfig={() => setShowConfig((value) => !value)}
      />
      {!showConfig && <EntryList fields={section.fields} entries={entries} />}
    </div>
  )
}
