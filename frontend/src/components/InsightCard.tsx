/** Task B2 — Insight Card */
import { AlertTriangle, Info, CheckCircle, Database, Wrench } from 'lucide-react'
import type { AnalysisResult, AnalysisWarning, Insight } from '@/types'

function SeverityIcon({ severity }: { severity?: AnalysisWarning['severity'] }) {
  if (severity === 'critical') return <AlertTriangle size={14} className="text-accent-rose shrink-0 mt-0.5" />
  if (severity === 'warning') return <AlertTriangle size={14} className="text-accent-amber shrink-0 mt-0.5" />
  return <Info size={14} className="text-brand-400 shrink-0 mt-0.5" />
}

function WarningPill({ w }: { w: AnalysisWarning | string }) {
  if (typeof w === 'string') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl text-xs bg-accent-amber/10 border border-accent-amber/20 text-accent-amber">
        <AlertTriangle size={14} className="text-accent-amber shrink-0 mt-0.5" />
        <span>{w}</span>
      </div>
    )
  }
  const base = 'flex items-start gap-2 p-3 rounded-xl text-xs'
  const cls =
    w.severity === 'critical' ? `${base} bg-accent-rose/10 border border-accent-rose/20 text-accent-rose` :
    w.severity === 'warning'  ? `${base} bg-accent-amber/10 border border-accent-amber/20 text-accent-amber` :
                                `${base} bg-brand-500/10 border border-brand-500/20 text-brand-300`
  return (
    <div className={cls}>
      <SeverityIcon severity={w.severity} />
      <span>{w.message}</span>
    </div>
  )
}

const TOOL_LABELS: Record<string, string> = {
  run_safe_sql:       'Safe SQL',
  run_python_analysis:'Python Analysis',
  detect_anomalies:   'Anomaly Detection',
  calculate_kpis:     'KPI Calculation',
  detect_trends:      'Trend Detection',
  create_chart_spec:  'Chart Generation',
  generate_report:    'Report Generation',
  profile_dataset:    'Dataset Profiling',
}

export function InsightCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="card p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="section-label mb-1">Question</p>
          <p className="text-base font-semibold text-white leading-snug">{result.question}</p>
        </div>
        <span className={`badge shrink-0 ${result.status === 'success' ? 'badge-success' : result.status === 'error' ? 'badge-error' : 'badge-neutral'}`}>
          {result.status === 'success' && <CheckCircle size={11} />}
          {result.status}
        </span>
      </div>

      {/* Tool + reason */}
      {result.tool && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-700/40 border border-surface-600/30">
          <Wrench size={14} className="text-surface-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-brand-300">{TOOL_LABELS[result.tool] ?? result.tool}</span>
            {result.reason && (
              <p className="text-xs text-surface-400 mt-0.5">{result.reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Insights grid */}
      {result.insights.length > 0 && (
        <div>
          <p className="section-label mb-3">Findings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.insights.map((ins: Insight | any, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-surface-700/40 border border-surface-600/30 flex flex-col justify-between">
                {typeof ins === 'string' ? (
                  <p className="text-sm font-medium text-white leading-relaxed">{ins}</p>
                ) : (
                  <>
                    <p className="stat-label">{ins.label ?? `Finding ${i + 1}`}</p>
                    <p className="text-lg font-bold text-white mt-1 truncate">
                      {ins.unit === '$' && <span className="text-surface-400 text-sm">$</span>}
                      {typeof ins.value === 'number' ? ins.value.toLocaleString() : String(ins.value ?? '')}
                      {ins.unit && ins.unit !== '$' && <span className="text-surface-400 text-sm ml-1">{ins.unit}</span>}
                    </p>
                    {ins.delta !== undefined && (
                      <p className={`text-xs mt-0.5 font-medium ${ins.delta >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                        {ins.delta >= 0 ? '↑' : '↓'} {Math.abs(ins.delta)}%
                        {ins.delta_label && <span className="text-surface-500 font-normal"> {ins.delta_label}</span>}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          <p className="section-label">Assumptions & Warnings</p>
          {result.warnings.map((w, i) => <WarningPill key={i} w={w} />)}
        </div>
      )}

      {/* Source info */}
      <div className="flex items-center gap-4 pt-2 border-t border-surface-700/40 text-xs text-surface-500">
        <span className="flex items-center gap-1.5">
          <Database size={11} />
          Dataset: {result.dataset_id}
        </span>
        <span>{new Date(result.created_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
