/** Task A3 — Dataset Profile Screen */
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, FileText, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { getDatasetProfile } from '@/api/client'
import type { ColumnProfile } from '@/types'
import { LoadingState, ErrorState, PageHeader, Skeleton } from '@/components/ui'

const TYPE_COLORS: Record<string, string> = {
  numeric:     'badge-info',
  categorical: 'badge-neutral',
  date:        'badge-success',
  boolean:     'badge-warning',
  unknown:     'badge-neutral',
}

function QualityBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'from-accent-emerald to-accent-emerald' :
    score >= 60 ? 'from-accent-amber to-accent-amber' :
    'from-accent-rose to-accent-rose'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold text-white w-10 text-right">{score}</span>
    </div>
  )
}

function ColumnRow({ col }: { col: ColumnProfile }) {
  return (
    <tr className="border-t border-surface-700/40 hover:bg-surface-700/20 transition-colors">
      <td className="px-4 py-3 text-sm font-mono font-medium text-white">{col.name}</td>
      <td className="px-4 py-3">
        <span className={`badge ${TYPE_COLORS[col.inferred_type] ?? 'badge-neutral'}`}>
          {col.inferred_type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-surface-300 tabular-nums">{col.unique_count.toLocaleString()}</td>
      <td className="px-4 py-3">
        <span className={col.missing_pct > 5 ? 'text-accent-rose text-sm font-medium' : 'text-surface-400 text-sm'}>
          {col.missing_count > 0 ? `${col.missing_count} (${col.missing_pct.toFixed(1)}%)` : '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        {col.mean !== undefined && (
          <span className="text-xs text-surface-400 tabular-nums">
            μ {col.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {col.std !== undefined && ` ± ${col.std.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
          </span>
        )}
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        <p className="text-xs text-surface-400 truncate">
          {col.sample_values.slice(0, 3).join(', ')}
        </p>
      </td>
    </tr>
  )
}

export function ProfilePage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile', datasetId],
    queryFn: () => getDatasetProfile(datasetId!),
    enabled: !!datasetId,
  })

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="p-6 lg:p-10">
        <ErrorState message="Could not load dataset profile." onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Dataset Profile"
        subtitle={profile.filename}
        actions={
          <button
            className="btn-primary"
            onClick={() => navigate(`/datasets/${datasetId}/query`)}
          >
            <MessageSquare size={15} /> Ask a Question
          </button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Rows', value: profile.row_count.toLocaleString() },
          { label: 'Columns', value: profile.column_count },
          { label: 'Missing Values', value: `${profile.schema.reduce((a, c) => a + c.missing_count, 0)}` },
          { label: 'Quality Score', value: `${profile.quality_summary.overall_score}/100` },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quality section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          {profile.quality_summary.overall_score >= 80
            ? <CheckCircle size={18} className="text-accent-emerald" />
            : <AlertTriangle size={18} className="text-accent-amber" />}
          <h3 className="text-base font-semibold">Data Quality</h3>
        </div>
        <QualityBar score={profile.quality_summary.overall_score} />

        {profile.quality_summary.critical_issues.length > 0 && (
          <div className="space-y-2">
            <p className="section-label">Critical Issues</p>
            {profile.quality_summary.critical_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-sm text-accent-rose">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {issue}
              </div>
            ))}
          </div>
        )}

        {profile.quality_summary.warnings.length > 0 && (
          <div className="space-y-2">
            <p className="section-label">Warnings</p>
            {profile.quality_summary.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-sm text-accent-amber">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-700/50 flex items-center gap-2">
          <FileText size={16} className="text-surface-400" />
          <h3 className="text-base font-semibold">Column Schema</h3>
          <span className="badge badge-neutral ml-auto">{profile.column_count} columns</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-surface-400 bg-surface-800/60">
                <th className="px-4 py-3 font-semibold">Column</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Unique</th>
                <th className="px-4 py-3 font-semibold">Missing</th>
                <th className="px-4 py-3 font-semibold">Stats</th>
                <th className="px-4 py-3 font-semibold">Samples</th>
              </tr>
            </thead>
            <tbody>
              {profile.schema.map(col => (
                <ColumnRow key={col.name} col={col} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigate to report */}
      <button
        className="card-hover p-5 w-full text-left flex items-center gap-4"
        onClick={() => navigate(`/datasets/${datasetId}/query`)}
      >
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 shrink-0">
          <MessageSquare size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Start Analysing</p>
          <p className="text-xs text-surface-400">Ask business questions in natural language</p>
        </div>
        <ChevronRight size={18} className="ml-auto text-surface-500" />
      </button>
    </div>
  )
}
