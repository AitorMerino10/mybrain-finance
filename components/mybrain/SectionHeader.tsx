'use client'

import SectionFieldsEditor from './SectionFieldsEditor'
import type { MyBrainSectionWithFields } from '@/types/mybrain'

interface SectionHeaderProps {
  section: MyBrainSectionWithFields
  userId: string
  showConfig: boolean
  onToggleConfig: () => void
}

export default function SectionHeader({
  section,
  userId,
  showConfig,
  onToggleConfig,
}: SectionHeaderProps) {
  const logo = section.ds_logo || section.ds_section.charAt(0).toUpperCase()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg text-white">
            {logo}
          </span>
          <h1 className="truncate text-xl font-bold text-white sm:text-2xl">
            {section.ds_section}
          </h1>
        </div>

        <button
          type="button"
          onClick={onToggleConfig}
          aria-expanded={showConfig}
          aria-controls="section-config-panel"
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.8"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.108 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.27 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.27-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.107-1.204-.165-.397-.505-.71-.93-.78l-.893-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {showConfig ? 'Ocultar' : 'Config'}
        </button>
      </div>

      {showConfig && (
        <div id="section-config-panel" className="rounded-[24px] bg-white/[0.03] p-3">
          <SectionFieldsEditor userId={userId} section={section} />
        </div>
      )}
    </div>
  )
}
