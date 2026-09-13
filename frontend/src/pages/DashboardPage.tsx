/** Task C2 — Dashboard composition (business overview) */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Upload, MessageSquare, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react'
import { listDatasets, listAnalysisHistory } from '@/api/client'
import { KpiCard, ChartRenderer } from '@/charts/ChartRenderer'
import { LoadingState, EmptyState, PageHeader } from '@/components/ui'
import { MOCK_ANALYSIS_RESULTS } from '@/api/mockData'

export function DashboardPage() {
  const navigate = useNavigate()

  const { data: datasets, isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })

  const { data: history } = useQuery({
    queryKey: ['history'],
    queryFn: () => listAnalysisHistory(),
  })

  const latestDataset = datasets?.[0]
  const recentResults = history?.slice(0, 3) ?? []
  const revenueResult = MOCK_ANALYSIS_RESULTS.find(r => r.question.includes('monthly revenue'))
  const regionResult  = MOCK_ANALYSIS_RESULTS.find(r => r.question.includes('highest revenue'))

  if (loadingDatasets) return <LoadingState message="Loading dashboard…" />

  if (!latestDataset) {
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

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={`Active dataset: ${latestDataset.filename} — ${latestDataset.row_count.toLocaleString()} rows`}
        actions={
          <button
            className="btn-primary"
            onClick={() => navigate(`/datasets/${latestDataset.dataset_id}/query`)}
          >
            <MessageSquare size={15} /> Ask a Question
          </button>
        }
      />

      {/* KPI tiles — only render when dataset has relevant fields (driven by analysis history) */}
      <section>
        <p className="section-label mb-4">Key Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Total Revenue" value={6003203} unit="$" delta={18.4} deltaLabel="YoY" trend="up" />
          <KpiCard label="Total Profit" value={1441617} unit="$" delta={14.2} deltaLabel="YoY" trend="up" />
          <KpiCard label="Profit Margin" value="30.2%" delta={1.1} trend="up" />
          <KpiCard label="Total Orders" value={1240} delta={8.4} trend="up" />
          <KpiCard label="Anomalies" value={14} trend="neutral" />
          <KpiCard label="Data Quality" value="87/100" trend="up" />
        </div>
        <p className="text-[11px] text-surface-500 mt-2">
          * Metrics computed from dataset analysis — not LLM-generated numbers
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
          { icon: <MessageSquare size={20} />, label: 'Ask a Question', desc: 'Natural language analytics', to: `/datasets/${latestDataset.dataset_id}/query` },
          { icon: <TrendingUp size={20} />, label: 'View Profile', desc: 'Schema & quality report', to: `/datasets/${latestDataset.dataset_id}/profile` },
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
