'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type OverlayContextValue = {
  count: number
  acquire: () => () => void
}

const MyBrainOverlayContext = createContext<OverlayContextValue | null>(null)

export function MyBrainOverlayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [count, setCount] = useState(0)

  const acquire = useCallback(() => {
    setCount((current) => current + 1)
    return () => {
      setCount((current) => Math.max(0, current - 1))
    }
  }, [])

  const value = useMemo(() => ({ count, acquire }), [count, acquire])

  return (
    <MyBrainOverlayContext.Provider value={value}>
      {children}
    </MyBrainOverlayContext.Provider>
  )
}

export function useMyBrainOverlayCount() {
  return useContext(MyBrainOverlayContext)?.count ?? 0
}

export function useMyBrainOverlayLock(active: boolean) {
  const ctx = useContext(MyBrainOverlayContext)

  useEffect(() => {
    if (!active || !ctx) return
    const release = ctx.acquire()
    return release
  }, [active, ctx])
}
