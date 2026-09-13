// ─── Shared domain types consumed from D2 API ─────────────────────────────

export interface Dataset {
  dataset_id: string
  filename: string
  file_type: 'csv' | 'xlsx'
  row_count: number
  column_count: number
  created_at: string
}

export interface ColumnProfile {
  name: string
  inferred_type: 'numeric' | 'categorical' | 'date' | 'boolean' | 'unknown'
  nullable: boolean
  unique_count: number
  missing_count: number
  missing_pct: number
  sample_values: (string | number | null)[]
  min?: number | string
  max?: number | string
  mean?: number
  std?: number
}

export interface QualitySummary {
  overall_score: number           // 0–100
  warnings: string[]
  critical_issues: string[]
}

export interface DatasetProfile {
  dataset_id: string
  filename: string
  row_count: number
  column_count: number
  schema: ColumnProfile[]
  quality_summary: QualitySummary
  created_at: string
}

// ─── Analysis / Agent ─────────────────────────────────────────────────────

export type AnalysisTool =
  | 'profile_dataset'
  | 'run_safe_sql'
  | 'run_python_analysis'
  | 'detect_anomalies'
  | 'calculate_kpis'
  | 'detect_trends'
  | 'summarize_grouped_metrics'
  | 'create_chart_spec'
  | 'generate_report'


export type AnalysisStatus = 'pending' | 'running' | 'success' | 'error'

export interface Insight {
  label: string
  value: string | number
  unit?: string
  delta?: number
  delta_label?: string
}

export interface AnalysisWarning {
  code: string
  message: string
  severity: 'info' | 'warning' | 'critical'
}

// ─── Chart Spec ───────────────────────────────────────────────────────────

export type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'kpi' | 'pie' | 'table' | 'none'

export interface ChartDataPoint {
  [key: string]: string | number | null
}

export interface AnomalyMarker {
  index: number
  label: string
  value: number
}

export interface ChartSpec {
  type: ChartType
  title: string
  x_key?: string
  y_keys: string[]
  data: ChartDataPoint[]
  x_label?: string
  y_label?: string
  anomaly_markers?: AnomalyMarker[]
  colors?: string[]
}

// ─── Analysis Result ──────────────────────────────────────────────────────

export interface AnalysisResult {
  result_id: string
  dataset_id: string
  question: string
  status: AnalysisStatus
  tool: AnalysisTool | null
  reason: string
  insights: Insight[]
  chart_spec: ChartSpec | null
  warnings: AnalysisWarning[]
  created_at: string
  completed_at?: string
  sql_query?: string
  raw_rows?: Record<string, unknown>[]
}

// ─── Report ───────────────────────────────────────────────────────────────

export interface ReportKPI {
  label: string
  value: string | number
  unit?: string
  change?: number
  change_label?: string
  trend?: 'up' | 'down' | 'neutral'
}

export interface ReportSection {
  id: string
  title: string
  content: string
}

export interface Report {
  report_id: string
  dataset_id: string
  status: 'generating' | 'ready' | 'error'
  title: string
  executive_summary: string
  kpis: ReportKPI[]
  trend_findings: ReportSection[]
  anomaly_findings: ReportSection[]
  chart_specs: ChartSpec[]
  recommendations: ReportSection[]
  data_quality_warnings: string[]
  generated_at: string
}

// ─── Upload ───────────────────────────────────────────────────────────────

export interface UploadResponse {
  dataset_id: string
  filename: string
  file_type: 'csv' | 'xlsx'
  row_count: number
  column_count: number
  created_at: string
}

// ─── API Wrappers ─────────────────────────────────────────────────────────

export interface ApiError {
  status: number
  message: string
  detail?: string
}
