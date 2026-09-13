/** Skeleton shimmer loader */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />
}

/** Full-page / section spinner */
export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin text-brand-400 ${className}`}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Centered loading state */
export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-surface-400">
      <Spinner size={32} />
      <p className="text-sm animate-pulse-slow">{message}</p>
    </div>
  )
}

/** Empty state with optional action */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-700/50 flex items-center justify-center text-surface-400">
          {icon}
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-surface-200">{title}</p>
        {description && <p className="text-sm text-surface-400 mt-1 max-w-xs mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Error state */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent-rose/10 flex items-center justify-center text-accent-rose text-2xl">
        ⚠
      </div>
      <div>
        <p className="text-base font-semibold text-surface-200">Something went wrong</p>
        {message && <p className="text-sm text-surface-400 mt-1 max-w-xs mx-auto">{message}</p>}
      </div>
      {onRetry && (
        <button className="btn-secondary text-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Page header */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-surface-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
