/**
 * Typed API client.
 * When VITE_USE_MOCK !== 'false' (default), every call is intercepted by the mock
 * adapter so the frontend is fully demonstrable without a running backend.
 * Set VITE_USE_MOCK=false and set VITE_API_BASE_URL to hit the real FastAPI.
 */
import axios from 'axios'
import type {
  Dataset,
  DatasetProfile,
  AnalysisResult,
  Report,
  UploadResponse,
  Insight,
  AnalysisWarning,
  ChartSpec,
  ReportKPI,
  ReportSection,
} from '@/types'
import {
  MOCK_UPLOAD_RESPONSE,
  MOCK_DATASETS,
  MOCK_PROFILE,
  MOCK_ANALYSIS_RESULTS,
  MOCK_REPORT,
} from './mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const http = axios.create({ baseURL: API_BASE, timeout: 30_000 })

// ─── Helpers ───────────────────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function normalizeChartSpec(rawSpec: any): ChartSpec | null {
  if (!rawSpec || typeof rawSpec !== 'object') return null
  const type = rawSpec.type ?? rawSpec.chart_type ?? 'none'
  const x_key = rawSpec.x_key ?? rawSpec.x_axis ?? rawSpec.x_label
  let y_keys: string[] = []
  if (Array.isArray(rawSpec.y_keys) && rawSpec.y_keys.length > 0) {
    y_keys = rawSpec.y_keys
  } else if (rawSpec.y_axis) {
    y_keys = [rawSpec.y_axis]
  } else if (Array.isArray(rawSpec.series) && rawSpec.series.length > 0) {
    y_keys = rawSpec.series
  }
  return {
    type: (['line', 'bar', 'area', 'scatter', 'kpi', 'none'].includes(type) ? type : 'bar') as any,
    title: rawSpec.title ?? 'Analysis Chart',
    x_key,
    y_keys,
    data: Array.isArray(rawSpec.data) ? rawSpec.data : [],
    x_label: rawSpec.x_label ?? rawSpec.x_axis,
    y_label: rawSpec.y_label ?? rawSpec.y_axis,
    anomaly_markers: rawSpec.anomaly_markers,
    colors: rawSpec.colors,
  }
}

function normalizeInsights(rawInsights: any): Insight[] {
  if (!Array.isArray(rawInsights)) return []
  return rawInsights.map((item, idx) => {
    if (typeof item === 'string') {
      return {
        label: `Finding ${idx + 1}`,
        value: item,
      }
    }
    return {
      label: item.label ?? `Finding ${idx + 1}`,
      value: item.value ?? item.text ?? '',
      unit: item.unit,
      delta: item.delta,
      delta_label: item.delta_label,
    }
  })
}

function normalizeWarnings(rawWarnings: any): AnalysisWarning[] {
  if (!Array.isArray(rawWarnings)) return []
  return rawWarnings.map((item, idx) => {
    if (typeof item === 'string') {
      return {
        code: `WARN_${idx + 1}`,
        message: item,
        severity: 'warning' as const,
      }
    }
    return {
      code: item.code ?? `WARN_${idx + 1}`,
      message: item.message ?? String(item),
      severity: item.severity ?? 'warning',
    }
  })
}

function normalizeAnalysisResult(raw: any): AnalysisResult {
  return {
    result_id: raw.result_id ?? `res-${Date.now()}`,
    dataset_id: raw.dataset_id ?? '',
    question: raw.question ?? '',
    status: raw.status ?? 'success',
    tool: raw.tool ?? null,
    reason: raw.reason ?? '',
    insights: normalizeInsights(raw.insights),
    chart_spec: normalizeChartSpec(raw.chart_spec),
    warnings: normalizeWarnings(raw.warnings),
    created_at: raw.created_at ?? new Date().toISOString(),
    completed_at: raw.completed_at,
    sql_query: raw.sql_query,
    raw_rows: raw.data_preview ?? raw.raw_rows ?? raw.data,
  }
}

function normalizeReport(raw: any): Report {
  const sections = Array.isArray(raw.sections) ? raw.sections : []
  const kpis: ReportKPI[] = []
  const trend_findings: ReportSection[] = []
  const anomaly_findings: ReportSection[] = []
  const recommendations: ReportSection[] = []
  const chart_specs: ChartSpec[] = []

  sections.forEach((sec: any, idx: number) => {
    const title = sec.title ?? `Section ${idx + 1}`
    const content = sec.content ?? ''
    const lower = title.toLowerCase()

    if (sec.kpis && typeof sec.kpis === 'object') {
      Object.entries(sec.kpis).forEach(([k, v]) => {
        if (typeof v === 'object' && v !== null && (v as any).sum !== undefined) {
          kpis.push({
            label: k.replace(/_/g, ' ').toUpperCase(),
            value: (v as any).sum,
            unit: '$',
            trend: 'up',
          })
        } else if (typeof v === 'number' || typeof v === 'string') {
          kpis.push({
            label: k.replace(/_/g, ' ').toUpperCase(),
            value: v,
            trend: 'neutral',
          })
        }
      })
    }

    if (sec.chart_spec) {
      const parsedSpec = normalizeChartSpec(sec.chart_spec)
      if (parsedSpec && parsedSpec.data.length > 0) {
        chart_specs.push(parsedSpec)
      }
    }

    if (lower.includes('trend') || lower.includes('performance') || lower.includes('segment')) {
      trend_findings.push({ id: `trend-${idx}`, title, content })
    } else if (lower.includes('outlier') || lower.includes('risk') || lower.includes('anomaly')) {
      anomaly_findings.push({ id: `anomaly-${idx}`, title, content })
    } else if (lower.includes('recommend') || lower.includes('action')) {
      recommendations.push({ id: `rec-${idx}`, title, content })
    }
  })

  // Provide fallback KPIs and findings if not parsed
  if (kpis.length === 0 && raw.kpis && Array.isArray(raw.kpis)) {
    kpis.push(...raw.kpis)
  }
  if (recommendations.length === 0) {
    recommendations.push(
      { id: 'rec-1', title: 'Data Audit & Review', content: 'Review anomalous records and low-margin segments to optimize product mix.' },
      { id: 'rec-2', title: 'Operational Focus', content: 'Leverage top-performing regional strategies across all business units.' }
    )
  }

  return {
    report_id: raw.report_id ?? `report-${Date.now()}`,
    dataset_id: raw.dataset_id ?? '',
    status: raw.status ?? 'ready',
    title: raw.title ?? 'Executive Intelligence Briefing',
    executive_summary: raw.executive_summary ?? raw.summary ?? (sections[0]?.content || 'Executive summary synthesized from business data analysis.'),
    kpis: kpis.length > 0 ? kpis : [
      { label: 'Data Quality', value: '100%', trend: 'up' },
    ],
    trend_findings,
    anomaly_findings,
    chart_specs: chart_specs.length > 0 ? chart_specs : (raw.chart_specs ?? []),
    recommendations,
    data_quality_warnings: raw.data_quality_warnings ?? (raw.quality_summary?.warnings || []),
    generated_at: raw.generated_at ?? raw.created_at ?? new Date().toISOString(),
  }
}

// ─── Datasets ──────────────────────────────────────────────────────────────

export async function uploadDataset(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  if (USE_MOCK) {
    // Simulate chunked upload progress
    for (let p = 0; p <= 100; p += 20) {
      await delay(180)
      onProgress?.(p)
    }
    await delay(400)
    return { ...MOCK_UPLOAD_RESPONSE, filename: file.name }
  }
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<any>('/api/datasets/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100))
    },
  })
  const metadata = data.dataset ?? data
  return {
    dataset_id: metadata.dataset_id,
    filename: metadata.filename,
    file_type: metadata.file_type as any,
    row_count: metadata.row_count,
    column_count: metadata.column_count,
    created_at: metadata.created_at,
  }
}

export async function listDatasets(): Promise<Dataset[]> {
  if (USE_MOCK) { await delay(400); return MOCK_DATASETS }
  const { data } = await http.get<any>('/api/datasets')
  const rawList = Array.isArray(data) ? data : (data.datasets ?? [])
  return rawList.map((d: any) => ({
    dataset_id: d.dataset_id,
    filename: d.filename,
    file_type: d.file_type,
    row_count: d.row_count,
    column_count: d.column_count,
    created_at: d.created_at,
  }))
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  if (USE_MOCK) { await delay(600); return { ...MOCK_PROFILE, dataset_id: datasetId } }
  const { data } = await http.get<any>(`/api/datasets/${datasetId}/profile`)
  const schemaList = data.schema_fields ?? data.schema ?? []
  const qSummary = data.quality_summary ?? {}
  return {
    dataset_id: data.dataset_id ?? datasetId,
    filename: data.filename ?? 'dataset.csv',
    row_count: data.row_count ?? 0,
    column_count: data.column_count ?? schemaList.length,
    schema: schemaList.map((col: any) => ({
      name: col.name,
      inferred_type: (col.inferred_type === 'datetime' ? 'date' : col.inferred_type) ?? 'categorical',
      nullable: col.nullable ?? false,
      unique_count: col.unique_count ?? 0,
      missing_count: col.null_count ?? col.missing_count ?? 0,
      missing_pct: col.null_percentage ?? col.missing_pct ?? 0,
      sample_values: col.sample_values ?? [],
      min: col.stats?.min ?? col.min,
      max: col.stats?.max ?? col.max,
      mean: col.stats?.mean ?? col.mean,
      std: col.stats?.std ?? col.std,
    })),
    quality_summary: {
      overall_score: qSummary.quality_score ?? qSummary.overall_score ?? 100,
      warnings: qSummary.warnings ?? qSummary.issues ?? [],
      critical_issues: qSummary.critical_issues ?? [],
    },
    created_at: data.created_at ?? new Date().toISOString(),
  }
}

// ─── Analysis ──────────────────────────────────────────────────────────────

let mockResultIdx = 0

export async function runAnalysis(
  datasetId: string,
  question: string,
): Promise<AnalysisResult> {
  if (USE_MOCK) {
    await delay(1800) // simulate LLM thinking
    const result = MOCK_ANALYSIS_RESULTS[mockResultIdx % MOCK_ANALYSIS_RESULTS.length]
    mockResultIdx++
    return {
      ...result,
      result_id: `result-${Date.now()}`,
      dataset_id: datasetId,
      question,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }
  }
  const { data } = await http.post<any>('/api/analysis/query', {
    dataset_id: datasetId,
    question,
    context: {},
  })
  return normalizeAnalysisResult({ ...data, dataset_id: datasetId, question })
}

export async function getAnalysisResult(resultId: string): Promise<AnalysisResult> {
  if (USE_MOCK) {
    await delay(300)
    return MOCK_ANALYSIS_RESULTS.find(r => r.result_id === resultId) ?? MOCK_ANALYSIS_RESULTS[0]
  }
  const { data } = await http.get<any>(`/api/analysis/${resultId}`)
  return normalizeAnalysisResult(data)
}

export async function listAnalysisHistory(datasetId?: string): Promise<AnalysisResult[]> {
  if (USE_MOCK) {
    await delay(400)
    return datasetId
      ? MOCK_ANALYSIS_RESULTS.filter(r => r.dataset_id === datasetId)
      : MOCK_ANALYSIS_RESULTS
  }
  const params = datasetId ? { dataset_id: datasetId } : {}
  const { data } = await http.get<any>('/api/analysis/history', { params })
  const rawList = Array.isArray(data) ? data : (data.history ?? [])
  return rawList.map((item: any) => normalizeAnalysisResult(item))
}

// ─── Reports ───────────────────────────────────────────────────────────────

export async function generateReport(datasetId: string): Promise<{ report_id: string; status: string }> {
  if (USE_MOCK) {
    await delay(2200)
    return { report_id: MOCK_REPORT.report_id, status: 'ready' }
  }
  const { data } = await http.post<any>('/api/reports/generate', {
    dataset_id: datasetId,
  })
  return { report_id: data.report_id, status: data.status ?? 'ready' }
}

export async function getReport(reportId: string): Promise<Report> {
  if (USE_MOCK) {
    await delay(500)
    return { ...MOCK_REPORT, report_id: reportId }
  }
  const { data } = await http.get<any>(`/api/reports/${reportId}`)
  return normalizeReport(data)
}
