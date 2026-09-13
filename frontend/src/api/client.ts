/**
 * Typed API client.
 * Supports both standalone client-side dynamic intelligence (with localStorage persistence)
 * and live FastAPI backend integration (when VITE_USE_MOCK === 'false' or backend is available).
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

// ─── Local State Persistence (for Standalone / Demo Deployments) ───────────
const STORAGE_KEY_DATASETS = 'abi_datasets_v1'
const STORAGE_KEY_PROFILES = 'abi_profiles_v1'
const STORAGE_KEY_HISTORY = 'abi_history_v1'
const STORAGE_KEY_DATA_ROWS = 'abi_datarows_v1'

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('LocalStorage save error:', e)
  }
}

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
    type: (['line', 'bar', 'area', 'scatter', 'pie', 'kpi', 'none'].includes(type) ? type : 'bar') as any,
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

// ─── Client-Side Dynamic CSV Profiler ───────────────────────────────────────
async function parseAndProfileCSV(file: File, datasetId: string): Promise<{ dataset: Dataset; profile: DatasetProfile; rawRows: any[] }> {
  let text = ''
  if (typeof file.text === 'function') {
    text = await file.text()
  } else {
    text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = reject
      reader.readAsText(file)
    })
  }
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) {
    throw new Error('The uploaded file is empty.')
  }

  const parseRow = (line: string): string[] => {
    const res: string[] = []
    let curr = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if (c === ',' && !inQuotes) {
        res.push(curr.trim())
        curr = ''
      } else {
        curr += c
      }
    }
    res.push(curr.trim())
    return res
  }

  const headers = parseRow(lines[0]).map((h, i) => h.replace(/^["']|["']$/g, '').trim() || `col_${i + 1}`)
  const rawRows: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i])
    if (vals.length > 0) {
      const rowObj: Record<string, any> = {}
      headers.forEach((h, idx) => {
        const v = vals[idx] ?? ''
        const num = Number(v)
        rowObj[h] = !isNaN(num) && v !== '' ? num : v
      })
      rawRows.push(rowObj)
    }
  }

  const rowCount = rawRows.length
  const columnCount = headers.length

  const schema = headers.map(h => {
    const vals = rawRows.map(r => r[h]).filter(v => v !== undefined && v !== null && v !== '')
    const numericVals = vals.filter(v => typeof v === 'number') as number[]
    const isNumeric = vals.length > 0 && numericVals.length >= vals.length * 0.75
    const isDate = !isNumeric && vals.length > 0 && vals.slice(0, 10).every(v => !isNaN(Date.parse(String(v))))
    const inferred_type = isNumeric ? 'numeric' : (isDate ? 'date' : 'categorical')

    const uniqueSet = new Set(vals)
    const nullCount = rowCount - vals.length

    let min: number | undefined
    let max: number | undefined
    let mean: number | undefined
    if (isNumeric && numericVals.length > 0) {
      min = Math.min(...numericVals)
      max = Math.max(...numericVals)
      mean = Math.round((numericVals.reduce((a, b) => a + b, 0) / numericVals.length) * 100) / 100
    }

    return {
      name: h,
      inferred_type: inferred_type as any,
      nullable: nullCount > 0,
      unique_count: uniqueSet.size,
      missing_count: nullCount,
      missing_pct: rowCount > 0 ? Math.round((nullCount / rowCount) * 1000) / 10 : 0,
      sample_values: Array.from(uniqueSet).slice(0, 4),
      min,
      max,
      mean,
    }
  })

  const missingTotal = schema.reduce((acc, c) => acc + c.missing_count, 0)
  const totalCells = rowCount * columnCount
  const missingPct = totalCells > 0 ? (missingTotal / totalCells) * 100 : 0
  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - missingPct * 2)))

  const profile: DatasetProfile = {
    dataset_id: datasetId,
    filename: file.name,
    row_count: rowCount,
    column_count: columnCount,
    quality_summary: {
      overall_score: qualityScore,
      warnings: missingTotal > 0 ? [`${missingTotal} missing values detected across dataset.`] : [],
      critical_issues: [],
    },
    schema,
    created_at: new Date().toISOString(),
  }

  const dataset: Dataset = {
    dataset_id: datasetId,
    filename: file.name,
    file_type: file.name.endsWith('.xlsx') ? 'xlsx' : 'csv',
    row_count: rowCount,
    column_count: columnCount,
    created_at: new Date().toISOString(),
  }

  return { dataset, profile, rawRows }
}

// ─── Datasets ──────────────────────────────────────────────────────────────

export async function uploadDataset(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  if (USE_MOCK) {
    // Simulate chunked upload progress
    for (let p = 0; p <= 100; p += 25) {
      await delay(120)
      onProgress?.(p)
    }

    try {
      const datasetId = `ds-${Date.now()}`
      const { dataset, profile, rawRows } = await parseAndProfileCSV(file, datasetId)

      // Store in localStorage
      const existingDatasets = getStored<Dataset[]>(STORAGE_KEY_DATASETS, [])
      setStored(STORAGE_KEY_DATASETS, [dataset, ...existingDatasets.filter(d => d.dataset_id !== datasetId)])

      const existingProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
      existingProfiles[datasetId] = profile
      setStored(STORAGE_KEY_PROFILES, existingProfiles)

      const existingDataRows = getStored<Record<string, any[]>>(STORAGE_KEY_DATA_ROWS, {})
      existingDataRows[datasetId] = rawRows.slice(0, 500)
      setStored(STORAGE_KEY_DATA_ROWS, existingDataRows)

      return {
        dataset_id: dataset.dataset_id,
        filename: dataset.filename,
        file_type: dataset.file_type,
        row_count: dataset.row_count,
        column_count: dataset.column_count,
        created_at: dataset.created_at,
      }
    } catch {
      // Fallback
      return { ...MOCK_UPLOAD_RESPONSE, filename: file.name }
    }
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
  if (USE_MOCK) {
    await delay(200)
    const customDatasets = getStored<Dataset[]>(STORAGE_KEY_DATASETS, [])
    const combined = [...customDatasets]
    MOCK_DATASETS.forEach(m => {
      if (!combined.some(d => d.dataset_id === m.dataset_id)) {
        combined.push(m)
      }
    })
    return combined
  }
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
  if (USE_MOCK) {
    await delay(300)
    const customProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    if (customProfiles[datasetId]) {
      return customProfiles[datasetId]
    }
    return { ...MOCK_PROFILE, dataset_id: datasetId }
  }
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
    await delay(1200) // simulate LLM thinking

    const customProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    const customProfile = customProfiles[datasetId]
    const customData = getStored<Record<string, any[]>>(STORAGE_KEY_DATA_ROWS, {})[datasetId]

    let result: AnalysisResult

    if (customProfile && customData && customData.length > 0) {
      // Dynamic computation from user's uploaded dataset
      const numericCols = customProfile.schema.filter(c => c.inferred_type === 'numeric')
      const catCols = customProfile.schema.filter(c => c.inferred_type === 'categorical')
      const numCol = numericCols[0]?.name || 'value'
      const catCol = catCols[0]?.name || 'category'

      // Aggregate top categories
      const grouped: Record<string, number> = {}
      customData.forEach(r => {
        const k = String(r[catCol] || 'Other')
        const v = typeof r[numCol] === 'number' ? r[numCol] : 1
        grouped[k] = (grouped[k] || 0) + v
      })

      const chartData = Object.entries(grouped)
        .map(([k, v]) => ({ [catCol]: k, [numCol]: Math.round(v * 100) / 100 }))
        .slice(0, 7)

      const topItem = chartData[0]

      result = {
        result_id: `result-${Date.now()}`,
        dataset_id: datasetId,
        question,
        status: 'success',
        tool: 'summarize_grouped_metrics',
        reason: `Grouped calculation for '${numCol}' across '${catCol}' from uploaded dataset.`,
        insights: [
          {
            label: `Top ${catCol}`,
            value: `${topItem ? topItem[catCol] : 'Leading segment'} (${topItem ? topItem[numCol].toLocaleString() : 0})`,
          },
          {
            label: `Total ${numCol}`,
            value: Object.values(grouped).reduce((a, b) => a + b, 0).toLocaleString(),
          },
        ],
        chart_spec: {
          type: 'bar',
          title: `${numCol.toUpperCase()} by ${catCol.toUpperCase()}`,
          x_key: catCol,
          y_keys: [numCol],
          data: chartData,
        },
        warnings: [],
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }
    } else {
      const template = MOCK_ANALYSIS_RESULTS[mockResultIdx % MOCK_ANALYSIS_RESULTS.length]
      mockResultIdx++
      result = {
        ...template,
        result_id: `result-${Date.now()}`,
        dataset_id: datasetId,
        question,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }
    }

    // Persist to history
    const history = getStored<AnalysisResult[]>(STORAGE_KEY_HISTORY, [])
    setStored(STORAGE_KEY_HISTORY, [result, ...history])

    return result
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
    await delay(200)
    const history = getStored<AnalysisResult[]>(STORAGE_KEY_HISTORY, [])
    const found = history.find(r => r.result_id === resultId)
    return found ?? MOCK_ANALYSIS_RESULTS.find(r => r.result_id === resultId) ?? MOCK_ANALYSIS_RESULTS[0]
  }
  const { data } = await http.get<any>(`/api/analysis/${resultId}`)
  return normalizeAnalysisResult(data)
}

export async function listAnalysisHistory(datasetId?: string): Promise<AnalysisResult[]> {
  if (USE_MOCK) {
    await delay(300)
    const storedHistory = getStored<AnalysisResult[]>(STORAGE_KEY_HISTORY, [])
    const combined = [...storedHistory]
    MOCK_ANALYSIS_RESULTS.forEach(m => {
      if (!combined.some(r => r.result_id === m.result_id)) {
        combined.push(m)
      }
    })
    return datasetId ? combined.filter(r => r.dataset_id === datasetId) : combined
  }
  const params = datasetId ? { dataset_id: datasetId } : {}
  const { data } = await http.get<any>('/api/analysis/history', { params })
  const rawList = Array.isArray(data) ? data : (data.history ?? [])
  return rawList.map((item: any) => normalizeAnalysisResult(item))
}

// ─── Reports ───────────────────────────────────────────────────────────────

export async function generateReport(datasetId: string): Promise<{ report_id: string; status: string }> {
  if (USE_MOCK) {
    await delay(1500)
    return { report_id: `rep-${datasetId}-${Date.now()}`, status: 'ready' }
  }
  const { data } = await http.post<any>('/api/reports/generate', {
    dataset_id: datasetId,
  })
  return { report_id: data.report_id, status: data.status ?? 'ready' }
}

export async function getReport(reportId: string): Promise<Report> {
  if (USE_MOCK) {
    await delay(400)
    const customProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    const matchedProfile = Object.values(customProfiles)[0]

    if (matchedProfile) {
      return {
        ...MOCK_REPORT,
        report_id: reportId,
        dataset_id: matchedProfile.dataset_id,
        title: `Executive Intelligence Report: ${matchedProfile.filename}`,
        executive_summary: `Synthesized intelligence report for '${matchedProfile.filename}' containing ${matchedProfile.row_count} records across ${matchedProfile.column_count} dimensions. Quality health index is ${matchedProfile.quality_summary.overall_score}/100.`,
      }
    }
    return { ...MOCK_REPORT, report_id: reportId }
  }
  const { data } = await http.get<any>(`/api/reports/${reportId}`)
  return normalizeReport(data)
}
