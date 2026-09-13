/** Task B3 — Analysis history */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock, MessageSquare, TrendingUp, AlertTriangle, Database, ArrowRight } from 'lucide-react'
import { listAnalysisHistory } from '@/api/client'
import { LoadingState, EmptyState, ErrorState, PageHeader } from '@/components/ui'

const TOOL_LABELS: Record<string, string> = {
  run_safe_sql:       'SQL',
  run_python_analysis:'Python',
  detect_anomalies:   'Anomaly',
  calculate_kpis:     'KPI',
  detect_trends:      'Trend',
  create_chart_spec:  'Chart',
  generate_report:    'Report',
  profile_dataset:    'Profile',
}

export function HistoryPage() {
  const navigate = useNavigate()

  const { data: history, isLoading, isError, refetch } = useQuery({
    queryKey: ['history'],
    queryFn: () => listAnalysisHistory(),
  })

  if (isLoading) return <LoadingState message="Loading history…" />
  if (isError) return (
    <div className="p-6 lg:p-10">
      <ErrorState message="Could not load analysis history." onRetry={() => refetch()} />
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Analysis History"
        subtitle="All previous questions, tools used, and results"
      />

      {!history?.length ? (
        <EmptyState
          icon={<Clock size={26} />}
          title="No history yet"
          description="Ask your first question to see it appear here."
          action={
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {history.map(result => (
            <div key={result.result_id} className="card-hover p-5">
              <div className="flex items-start gap-4">
                {/* Status icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  result.status === 'success' ? 'bg-accent-emerald/15 text-accent-emerald' :
                  result.status === 'error'   ? 'bg-accent-rose/15 text-accent-rose' :
                  result.status === 'running' ? 'bg-brand-500/15 text-brand-400' :
                  'bg-surface-600/50 text-surface-400'
                }`}>
                  {result.status === 'success' ? <TrendingUp size={18} /> :
                   result.status === 'error'   ? <AlertTriangle size={18} /> :
                   <MessageSquare size={18} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-snug">{result.question}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    {/* Dataset */}
                    <span className="flex items-center gap-1.5 text-xs text-surface-500">
                      <Database size={11} />
                      {result.dataset_id}
                    </span>

                    {/* Tool */}
                    {result.tool && (
                      <span className="badge badge-info text-[11px]">
                        {TOOL_LABELS[result.tool] ?? result.tool}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="flex items-center gap-1.5 text-xs text-surface-500">
                      <Clock size={11} />
                      {new Date(result.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Insights preview */}
                  {result.insights.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.insights.slice(0, 3).map((ins, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-surface-700/60 text-surface-300">
                          <span className="text-surface-500 mr-1">{ins.label}:</span>
                          {ins.unit === '$' && '$'}
                          {typeof ins.value === 'number' ? ins.value.toLocaleString() : ins.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status + arrow */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`badge ${
                    result.status === 'success' ? 'badge-success' :
                    result.status === 'error'   ? 'badge-error' :
                    result.status === 'running' ? 'badge-info' :
                    'badge-neutral'
                  }`}>
                    {result.status}
                  </span>
                  <button
                    className="btn-ghost text-xs py-1 px-2"
                    onClick={() => navigate(`/datasets/${result.dataset_id}/query`)}
                  >
                    Ask more <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
