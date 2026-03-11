export function PageLoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  )
}
