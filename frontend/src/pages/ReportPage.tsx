/** Tasks D1 + D2 + D3 — Executive Report preview, generation, and export */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText, Download, TrendingUp, AlertTriangle,
  CheckCircle, Lightbulb, BarChart2, Shield, ArrowLeft,
} from 'lucide-react'
import { getReport } from '@/api/client'
import type { Report, ReportKPI } from '@/types'
import { ChartRenderer, KpiCard } from '@/charts/ChartRenderer'
import { LoadingState, ErrorState, PageHeader, Skeleton } from '@/components/ui'

/* ── Sub-components ───────────────────────────────────────────────────── */

function KPIGrid({ kpis }: { kpis: ReportKPI[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map(kpi => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          unit={kpi.unit}
          delta={kpi.change}
          deltaLabel={kpi.change_label}
          trend={kpi.trend}
        />
      ))}
    </div>
  )
}

function SectionCard({
  icon,
  title,
  accent = 'brand',
  children,
}: {
  icon: React.ReactNode
  title: string
  accent?: 'brand' | 'emerald' | 'rose' | 'amber' | 'cyan'
  children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    brand:   'bg-brand-600/15 text-brand-400',
    emerald: 'bg-accent-emerald/15 text-accent-emerald',
    rose:    'bg-accent-rose/15 text-accent-rose',
    amber:   'bg-accent-amber/15 text-accent-amber',
    cyan:    'bg-accent-cyan/15 text-accent-cyan',
  }
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors[accent]}`}>
          {icon}
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ReportLoading() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-40" />
      <div className="grid grid-cols-6 gap-4">
        {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────── */

export function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const [downloading, setDownloading] = useState(false)

  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => getReport(reportId!),
    enabled: !!reportId,
    // Poll while generating
    refetchInterval: data => data?.status === 'generating' ? 3000 : false,
  })

  /* D3 — JSON export (P0) */
  const handleDownload = () => {
    if (!report) return
    setDownloading(true)
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${report.report_id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) return <ReportLoading />
  if (isError || !report) {
    return (
      <div className="p-6 lg:p-10">
        <ErrorState message="Could not load report." onRetry={() => refetch()} />
      </div>
    )
  }

  /* D2 — Generation status */
  if (report.status === 'generating') {
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto">
        <LoadingState message="Generating executive report… this may take a moment." />
        <p className="text-xs text-center text-surface-500 mt-2">
          Report content is derived from actual analysis results — not LLM-generated claims.
        </p>
      </div>
    )
  }

  if (report.status === 'error') {
    return (
      <div className="p-6 lg:p-10">
        <ErrorState message="Report generation failed. Please try again from the analysis page." onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header — D1 */}
      <PageHeader
        title={report.title}
        subtitle={`Generated ${new Date(report.generated_at).toLocaleString()} · Dataset ${report.dataset_id}`}
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              id="download-report"
              className="btn-secondary text-sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={14} />
              {downloading ? 'Saving…' : 'Download JSON'}
            </button>
          </div>
        }
      />

      {/* Honesty banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/25">
        <Shield size={16} className="text-brand-400 mt-0.5 shrink-0" />
        <p className="text-xs text-brand-300">
          All metrics and findings in this report are computed by the analytics engine from your uploaded dataset.
          The AI agent selected analysis tools — it did not invent or estimate any numbers.
        </p>
      </div>

      {/* Executive summary */}
      <SectionCard icon={<FileText size={18} />} title="Executive Summary" accent="brand">
        <p className="text-sm text-surface-200 leading-relaxed">{report.executive_summary}</p>
      </SectionCard>

      {/* KPIs */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-surface-400" />
          <h2 className="text-base font-semibold text-white">Key Performance Indicators</h2>
        </div>
        <KPIGrid kpis={report.kpis} />
      </section>

      {/* Trend findings */}
      {report.trend_findings.length > 0 && (
        <SectionCard icon={<TrendingUp size={18} />} title="Trend Analysis" accent="cyan">
          <div className="space-y-4">
            {report.trend_findings.map(finding => (
              <div key={finding.id} className="pl-4 border-l-2 border-accent-cyan/30">
                <p className="text-sm font-semibold text-white">{finding.title}</p>
                <p className="text-sm text-surface-300 mt-1 leading-relaxed">{finding.content}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Anomaly findings */}
      {report.anomaly_findings.length > 0 && (
        <SectionCard icon={<AlertTriangle size={18} />} title="Anomaly Findings" accent="rose">
          <div className="space-y-4">
            {report.anomaly_findings.map(finding => (
              <div key={finding.id} className="pl-4 border-l-2 border-accent-rose/30">
                <p className="text-sm font-semibold text-white">{finding.title}</p>
                <p className="text-sm text-surface-300 mt-1 leading-relaxed">{finding.content}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Charts */}
      {report.chart_specs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart2 size={16} className="text-surface-400" />
            Supporting Charts
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {report.chart_specs.map((spec, i) => (
              <div key={i} className="card p-6">
                <ChartRenderer spec={spec} height={260} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <SectionCard icon={<Lightbulb size={18} />} title="Recommendations" accent="amber">
          <p className="text-xs text-surface-500 italic">
            Data-informed suggestions based on computed findings — not guaranteed business decisions.
          </p>
          <div className="space-y-4">
            {report.recommendations.map((rec, i) => (
              <div key={rec.id} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent-amber/20 text-accent-amber flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{rec.title}</p>
                  <p className="text-sm text-surface-300 mt-0.5 leading-relaxed">{rec.content}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Data quality warnings */}
      {report.data_quality_warnings.length > 0 && (
        <SectionCard icon={<Shield size={18} />} title="Data Quality Notes" accent="amber">
          <ul className="space-y-2">
            {report.data_quality_warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-accent-amber">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Footer */}
      <div className="text-center pt-4 border-t border-surface-700/40">
        <p className="text-xs text-surface-500">
          ABI Agent · Report ID: {report.report_id} · Generated {new Date(report.generated_at).toLocaleString()}
        </p>
        <p className="text-xs text-surface-600 mt-1">
          This report was generated from dataset analysis. All figures trace back to computed results.
        </p>
      </div>
    </div>
  )
}
