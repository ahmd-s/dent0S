export default function Loading() {
  return (
    <div className="h-0.5 w-full overflow-hidden bg-muted" aria-busy="true" aria-label="Loading">
      <div className="h-full w-1/3 bg-[#0D9488] animate-pulse" />
    </div>
  )
}
