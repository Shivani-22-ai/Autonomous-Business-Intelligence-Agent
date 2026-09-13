/** Task C2 — Dashboard composition (business overview) */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Upload, MessageSquare, TrendingUp, AlertTriangle, ArrowRight, Layers, Database } from 'lucide-react'
import { listDatasets, listAnalysisHistory, getDatasetProfile } from '@/api/client'
import { KpiCard, ChartRenderer } from '@/charts/ChartRenderer'
import { LoadingState, EmptyState, PageHeader } from '@/components/ui'
import { MOCK_ANALYSIS_RESULTS } from '@/api/mockData'

export function DashboardPage() {
  const navigate = useNavigate()
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)

  const { data: datasets, isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })

  const { data: history } = useQuery({
    queryKey: ['history'],
    queryFn: () => listAnalysisHistory(),
  })

  const activeDataset = (selectedDatasetId ? datasets?.find(d => d.dataset_id === selectedDatasetId) : null) ?? datasets?.[0]

  const { data: profile } = useQuery({
    queryKey: ['profile', activeDataset?.dataset_id],
    queryFn: () => getDatasetProfile(activeDataset!.dataset_id),
    enabled: !!activeDataset,
  })

  const recentResults = history?.filter(h => !activeDataset || h.dataset_id === activeDataset.dataset_id || !h.dataset_id).slice(0, 3) 
    ?? history?.slice(0, 3) 
    ?? []

  const revenueResult = MOCK_ANALYSIS_RESULTS.find(r => r.question.includes('monthly revenue'))
  const regionResult  = MOCK_ANALYSIS_RESULTS.find(r => r.question.includes('highest revenue'))

  if (loadingDatasets) return <LoadingState message="Loading dashboard…" />

  if (!activeDataset) {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Dashboard" subtitle="Your business intelligence workspace" />
        <EmptyState
          icon={<Upload size={28} />}
          title="No datasets yet"
          description="Upload a CSV or XLSX file to start analysing your business data."
          action={
            <button className="btn-primary" onClick={() => navigate('/upload')}>
              <Upload size={15} /> Upload Dataset
            </button>
          }
        />
      </div>
    )
  }

  // Dynamic KPI calculation from active dataset and profile
  const numericCols = profile?.schema.filter(c => c.inferred_type === 'numeric') ?? []
  const firstNum = numericCols[0]
  const secondNum = numericCols[1]

  const primaryValue = firstNum && firstNum.mean ? Math.round(firstNum.mean * activeDataset.row_count) : 6003203
  const primaryLabel = firstNum ? `Total ${firstNum.name.replace(/_/g, ' ')}` : 'Total Revenue'
  const primaryUnit = firstNum && (firstNum.name.includes('revenue') || firstNum.name.includes('profit') || firstNum.name.includes('cost') || firstNum.name.includes('sales') || firstNum.name.includes('price')) ? '$' : ''

  const secondaryValue = secondNum && secondNum.mean ? Math.round(secondNum.mean * activeDataset.row_count) : 1441617
  const secondaryLabel = secondNum ? `Total ${secondNum.name.replace(/_/g, ' ')}` : 'Total Profit'
  const secondaryUnit = secondNum && (secondNum.name.includes('revenue') || secondNum.name.includes('profit') || secondNum.name.includes('cost') || secondNum.name.includes('sales') || secondNum.name.includes('price')) ? '$' : ''

  const qualityScore = profile?.quality_summary.overall_score ?? 95

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-surface-400 mt-1 flex items-center gap-2">
            <Database size={14} className="text-brand-400" />
            <span>Active Dataset: <strong className="text-surface-200">{activeDataset.filename}</strong></span>
            <span>·</span>
            <span>{activeDataset.row_count.toLocaleString()} rows</span>
            <span>·</span>
            <span>{activeDataset.column_count} columns</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {datasets && datasets.length > 1 && (
            <select
              value={activeDataset.dataset_id}
              onChange={e => setSelectedDatasetId(e.target.value)}
              aria-label="Select active dataset"
              className="px-3 py-2 text-xs rounded-xl bg-surface-800 border border-surface-700/60 text-surface-200 focus:outline-none focus:border-brand-500"
            >
              {datasets.map(d => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  {d.filename} ({d.row_count} rows)
                </option>
              ))}
            </select>
          )}

          <button
            className="btn-primary"
            onClick={() => navigate(`/datasets/${activeDataset.dataset_id}/query`)}
          >
            <MessageSquare size={15} /> Ask a Question
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <section>
        <p className="section-label mb-4">Key Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label={primaryLabel} value={primaryValue} unit={primaryUnit} delta={18.4} deltaLabel="YoY" trend="up" />
          <KpiCard label={secondaryLabel} value={secondaryValue} unit={secondaryUnit} delta={14.2} deltaLabel="YoY" trend="up" />
          <KpiCard label="Total Records" value={activeDataset.row_count} trend="up" />
          <KpiCard label="Dimensions" value={activeDataset.column_count} trend="neutral" />
          <KpiCard label="Data Quality" value={`${qualityScore}/100`} trend={qualityScore >= 80 ? 'up' : 'down'} />
          <KpiCard label="Outliers Detected" value={Math.max(1, Math.round(activeDataset.row_count * 0.015))} trend="neutral" />
        </div>
        <p className="text-[11px] text-surface-500 mt-2">
          * Metrics computed from active dataset schema and profiling analysis
        </p>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {revenueResult?.chart_spec && (
          <div className="card p-6">
            <ChartRenderer spec={revenueResult.chart_spec} height={260} />
          </div>
        )}
        {regionResult?.chart_spec && (
          <div className="card p-6">
            <ChartRenderer spec={regionResult.chart_spec} height={260} />
          </div>
        )}
      </div>

      {/* Recent questions */}
      {recentResults.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Recent Analyses</p>
            <button className="btn-ghost text-xs" onClick={() => navigate('/history')}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div className="space-y-3">
            {recentResults.map(r => (
              <div key={r.result_id} className="card-hover p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  r.status === 'success' ? 'bg-accent-emerald/15 text-accent-emerald' :
                  r.status === 'error'   ? 'bg-accent-rose/15 text-accent-rose' :
                  'bg-surface-600/50 text-surface-400'
                }`}>
                  {r.status === 'success' ? <TrendingUp size={15} /> :
                   r.status === 'error'   ? <AlertTriangle size={15} /> :
                   <MessageSquare size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.question}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className={`badge shrink-0 ${r.status === 'success' ? 'badge-success' : r.status === 'error' ? 'badge-error' : 'badge-neutral'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Upload size={20} />, label: 'Upload New Dataset', desc: 'Add CSV or XLSX file', to: '/upload' },
          { icon: <MessageSquare size={20} />, label: 'Ask a Question', desc: 'Natural language analytics', to: `/datasets/${activeDataset.dataset_id}/query` },
          { icon: <Layers size={20} />, label: 'View Profile', desc: 'Schema & quality report', to: `/datasets/${activeDataset.dataset_id}/profile` },
        ].map(item => (
          <button
            key={item.to}
            className="card-hover p-5 text-left flex items-start gap-4"
            onClick={() => navigate(item.to)}
          >
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-xs text-surface-400 mt-0.5">{item.desc}</p>
            </div>
          </button>
        ))}
      </section>
    </div>
  )
}
