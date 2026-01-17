import CircularLoader from '@/components/CircularLoader'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <CircularLoader size="lg" />
    </div>
  )
}

