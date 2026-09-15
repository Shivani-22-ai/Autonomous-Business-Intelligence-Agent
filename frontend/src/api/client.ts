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
  MOCK_DATASETS,
  MOCK_PROFILE,
  MOCK_ANALYSIS_RESULTS,
  MOCK_DATA_ROWS_DEMO,
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

// ─── Client-Side Dynamic CSV Profiler & Validator ──────────────────────────
async function parseAndProfileCSV(file: File, datasetId: string): Promise<{ dataset: Dataset; profile: DatasetProfile; rawRows: any[] }> {
  if (file.size === 0) {
    throw new Error(`File '${file.name}' is empty (0 bytes). Please upload a valid CSV.`)
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
    throw new Error(`Unsupported format '.${ext}'. Please upload a CSV or XLSX file.`)
  }

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

  if (!text || text.trim().length === 0) {
    throw new Error(`File '${file.name}' contains no readable text or data.`)
  }

  // Reject binary/corrupted content in CSV
  if (text.includes('\u0000')) {
    throw new Error(`File '${file.name}' contains binary content or corrupted characters. Please upload a valid plaintext CSV.`)
  }

  // Detect delimiter
  const firstLines = text.split(/\r?\n/).slice(0, 5).filter(l => l.trim().length > 0)
  if (firstLines.length === 0) {
    throw new Error(`File '${file.name}' contains no rows.`)
  }

  let delimiter = ','
  const commaCount = (firstLines[0].match(/,/g) || []).length
  const semiCount = (firstLines[0].match(/;/g) || []).length
  const tabCount = (firstLines[0].match(/\t/g) || []).length
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';'
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t'

  const parseRow = (line: string): string[] => {
    const res: string[] = []
    let curr = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if (c === delimiter && !inQuotes) {
        res.push(curr.trim())
        curr = ''
      } else {
        curr += c
      }
    }
    res.push(curr.trim())
    return res
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) {
    throw new Error(`File '${file.name}' contains no data.`)
  }

  const rawHeaders = parseRow(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim())
  const headers: string[] = []
  const seenHeaders = new Set<string>()

  rawHeaders.forEach((h, i) => {
    let clean = h || `col_${i + 1}`
    if (seenHeaders.has(clean)) {
      let suffix = 1
      while (seenHeaders.has(`${clean}_${suffix}`)) suffix++
      clean = `${clean}_${suffix}`
    }
    seenHeaders.add(clean)
    headers.push(clean)
  })

  if (headers.length === 0 || (headers.length === 1 && headers[0].trim() === '')) {
    throw new Error(`Could not find valid column headers in '${file.name}'.`)
  }

  const rawRows: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i])
    if (vals.length > 0 && vals.some(v => v !== '')) {
      const rowObj: Record<string, any> = {}
      headers.forEach((h, idx) => {
        const rawVal = vals[idx] !== undefined ? vals[idx].replace(/^["']|["']$/g, '').trim() : ''
        const numVal = Number(rawVal.replace(/[$,]/g, ''))
        if (rawVal !== '' && !isNaN(numVal) && isFinite(numVal)) {
          rowObj[h] = numVal
        } else {
          rowObj[h] = rawVal
        }
      })
      rawRows.push(rowObj)
    }
  }

  if (rawRows.length === 0) {
    throw new Error(`Dataset '${file.name}' contains headers but 0 data rows.`)
  }

  const rowCount = rawRows.length
  const columnCount = headers.length

  const schema = headers.map(h => {
    const vals = rawRows.map(r => r[h]).filter(v => v !== undefined && v !== null && v !== '')
    const numericVals = vals.filter(v => typeof v === 'number') as number[]
    const isNumeric = vals.length > 0 && numericVals.length >= vals.length * 0.7
    const isDate = !isNumeric && vals.length > 0 && vals.slice(0, 10).every(v => {
      const parsed = Date.parse(String(v))
      return !isNaN(parsed) && String(v).length >= 6
    })
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
    // Validate size
    const MAX_SIZE_MB = 50
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`)
    }

    // Simulate chunked upload progress
    for (let p = 0; p <= 100; p += 25) {
      await delay(80)
      onProgress?.(p)
    }

    const datasetId = `ds-${Date.now()}`
    // Parse and validate strictly — throws error if invalid, empty, or unparseable
    const { dataset, profile, rawRows } = await parseAndProfileCSV(file, datasetId)

    // Store in localStorage
    const existingDatasets = getStored<Dataset[]>(STORAGE_KEY_DATASETS, [])
    setStored(STORAGE_KEY_DATASETS, [dataset, ...existingDatasets.filter(d => d.dataset_id !== datasetId)])

    const existingProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    existingProfiles[datasetId] = profile
    setStored(STORAGE_KEY_PROFILES, existingProfiles)

    const existingDataRows = getStored<Record<string, any[]>>(STORAGE_KEY_DATA_ROWS, {})
    existingDataRows[datasetId] = rawRows
    setStored(STORAGE_KEY_DATA_ROWS, existingDataRows)

    return {
      dataset_id: dataset.dataset_id,
      filename: dataset.filename,
      file_type: dataset.file_type,
      row_count: dataset.row_count,
      column_count: dataset.column_count,
      created_at: dataset.created_at,
    }
  }

  const form = new FormData()
  form.append('file', file)
  try {
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
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message || 'Upload failed'
    throw new Error(errorMsg)
  }
}

export async function listDatasets(): Promise<Dataset[]> {
  if (USE_MOCK) {
    await delay(100)
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
    await delay(150)
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

// ─── Dynamic Client-Side BI Analytics Engine ───────────────────────────────

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(num) >= 1_000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return num % 1 === 0 ? num.toString() : num.toFixed(2)
}

function executeDynamicAnalysis(
  datasetId: string,
  question: string,
  profile: DatasetProfile,
  dataRows: any[]
): AnalysisResult {
  const q = question.toLowerCase()
  const numericCols = profile.schema.filter(c => c.inferred_type === 'numeric')
  const catCols = profile.schema.filter(c => c.inferred_type === 'categorical' || c.inferred_type === 'unknown')
  const dateCols = profile.schema.filter(
    c => c.inferred_type === 'date' || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time') || c.name.toLowerCase().includes('month')
  )

  // 1. Resolve target numeric metric from question
  let targetMetric = numericCols[0]?.name || 'value'
  for (const nc of numericCols) {
    const colLower = nc.name.toLowerCase()
    if (q.includes(colLower)) {
      targetMetric = nc.name
      break
    }
  }
  if (!numericCols.some(nc => q.includes(nc.name.toLowerCase()))) {
    if (q.includes('profit') || q.includes('margin') || q.includes('gain')) {
      const match = numericCols.find(c => c.name.toLowerCase().includes('profit') || c.name.toLowerCase().includes('margin'))
      if (match) targetMetric = match.name
    } else if (q.includes('cost') || q.includes('expense') || q.includes('spend')) {
      const match = numericCols.find(c => c.name.toLowerCase().includes('cost') || c.name.toLowerCase().includes('expense'))
      if (match) targetMetric = match.name
    } else if (q.includes('unit') || q.includes('quantity') || q.includes('volume') || q.includes('count')) {
      const match = numericCols.find(c => c.name.toLowerCase().includes('unit') || c.name.toLowerCase().includes('quantity'))
      if (match) targetMetric = match.name
    } else if (q.includes('revenue') || q.includes('sale') || q.includes('turnover')) {
      const match = numericCols.find(c => c.name.toLowerCase().includes('revenue') || c.name.toLowerCase().includes('sale'))
      if (match) targetMetric = match.name
    }
  }

  const isMoney = targetMetric.toLowerCase().includes('revenue') ||
                  targetMetric.toLowerCase().includes('profit') ||
                  targetMetric.toLowerCase().includes('cost') ||
                  targetMetric.toLowerCase().includes('price') ||
                  targetMetric.toLowerCase().includes('sales')
  const unit = isMoney ? '$' : ''

  // 2. Resolve target categorical dimension from question
  let targetDim = catCols[0]?.name || 'category'
  for (const cc of catCols) {
    if (q.includes(cc.name.toLowerCase())) {
      targetDim = cc.name
      break
    }
  }

  // 3. Check for specific value filter in question (e.g. "in North", "for Laptop Pro")
  let filteredRows = [...dataRows]
  let activeFilterDesc = ''
  for (const cc of catCols) {
    const distinctVals = Array.from(new Set(dataRows.map(r => String(r[cc.name] || ''))))
    for (const val of distinctVals) {
      if (val && val.length > 2 && q.includes(val.toLowerCase())) {
        filteredRows = dataRows.filter(r => String(r[cc.name] || '').toLowerCase() === val.toLowerCase())
        activeFilterDesc = `${cc.name} = '${val}'`
        break
      }
    }
    if (activeFilterDesc) break
  }

  const rows = filteredRows.length > 0 ? filteredRows : dataRows

  // 4. Intent Classification & Execution

  // A. Time-Series / Chronological Trends
  const isTrend = anyMatch(q, ['trend', 'growth', 'over time', 'monthly', 'quarterly', 'timeline', 'history', 'trajectory', 'seasonality'])
  if (isTrend && (dateCols.length > 0 || rows.length > 0)) {
    const timeCol = dateCols[0]?.name || 'date'
    const groupedTime: Record<string, { sum: number; count: number }> = {}

    rows.forEach(r => {
      let tKey = String(r[timeCol] || '')
      if (tKey.length >= 7) {
        // Normalize YYYY-MM
        tKey = tKey.slice(0, 7)
      } else if (!tKey) {
        tKey = 'Period'
      }
      const val = typeof r[targetMetric] === 'number' ? r[targetMetric] : 0
      if (!groupedTime[tKey]) groupedTime[tKey] = { sum: 0, count: 0 }
      groupedTime[tKey].sum += val
      groupedTime[tKey].count++
    })

    const chartData = Object.entries(groupedTime)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, data]) => ({
        [timeCol]: period,
        [targetMetric]: Math.round(data.sum * 100) / 100,
      }))

    const totalVal = chartData.reduce((acc, c) => acc + (c[targetMetric] as number), 0)
    const peakItem = [...chartData].sort((a, b) => (b[targetMetric] as number) - (a[targetMetric] as number))[0]
    const troughItem = [...chartData].sort((a, b) => (a[targetMetric] as number) - (b[targetMetric] as number))[0]

    let growthPct = 0
    if (chartData.length >= 2) {
      const first = chartData[0][targetMetric] as number
      const last = chartData[chartData.length - 1][targetMetric] as number
      growthPct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0
    }

    return {
      result_id: `result-${Date.now()}`,
      dataset_id: datasetId,
      question,
      status: 'success',
      tool: 'detect_trends',
      reason: `Time-series trend analysis computed for '${targetMetric}' across '${timeCol}'.`,
      insights: [
        {
          label: 'Peak Period',
          value: peakItem ? `${peakItem[timeCol]} (${unit}${formatNumber(peakItem[targetMetric] as number)})` : 'N/A',
        },
        {
          label: 'Overall Growth',
          value: `${growthPct >= 0 ? '+' : ''}${growthPct}%`,
          unit: '%',
          delta: growthPct,
          delta_label: 'start to end period',
        },
        {
          label: `Total ${targetMetric.toUpperCase()}`,
          value: `${unit}${formatNumber(totalVal)}`,
        },
        {
          label: 'Lowest Period',
          value: troughItem ? `${troughItem[timeCol]} (${unit}${formatNumber(troughItem[targetMetric] as number)})` : 'N/A',
        },
      ],
      chart_spec: {
        type: 'area',
        title: `${targetMetric.replace(/_/g, ' ').toUpperCase()} Trend over ${timeCol.replace(/_/g, ' ').toUpperCase()}`,
        x_key: timeCol,
        y_keys: [targetMetric],
        data: chartData,
        x_label: timeCol.replace(/_/g, ' ').toUpperCase(),
        y_label: `${targetMetric.replace(/_/g, ' ').toUpperCase()} (${unit || 'Units'})`,
      },
      warnings: [],
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sql_query: `SELECT ${timeCol}, SUM(${targetMetric}) AS ${targetMetric} FROM dataset GROUP BY ${timeCol} ORDER BY ${timeCol} ASC`,
    }
  }

  // B. Anomaly / Outlier Detection
  const isAnomaly = anyMatch(q, ['anomaly', 'anomalies', 'outlier', 'outliers', 'unusual', 'suspicious', 'deviat', 'irregular', 'extreme'])
  if (isAnomaly && numericCols.length > 0) {
    const metricVals = rows.map(r => Number(r[targetMetric]) || 0)
    const n = metricVals.length
    const mean = n > 0 ? metricVals.reduce((a, b) => a + b, 0) / n : 0
    const variance = n > 1 ? metricVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1) : 0
    const std = Math.sqrt(variance)

    const anomalyRows: { index: number; row: any; zScore: number }[] = []
    rows.forEach((r, idx) => {
      const val = Number(r[targetMetric]) || 0
      const z = std > 0 ? Math.abs((val - mean) / std) : 0
      if (z >= 1.75) {
        anomalyRows.push({ index: idx, row: r, zScore: z })
      }
    })

    const secondaryMetric = numericCols.find(c => c.name !== targetMetric)?.name || targetMetric
    const scatterData = rows.slice(0, 40).map((r, i) => ({
      [targetMetric]: Math.round((Number(r[targetMetric]) || 0) * 100) / 100,
      [secondaryMetric]: Math.round((Number(r[secondaryMetric]) || 0) * 100) / 100,
      is_anomaly: anomalyRows.some(a => a.index === i) ? 1 : 0,
    }))

    const topOutlier = anomalyRows.sort((a, b) => b.zScore - a.zScore)[0]
    const idCol = catCols.find(c => c.name.toLowerCase().includes('id'))?.name || Object.keys(rows[0] || {})[0] || 'id'

    return {
      result_id: `result-${Date.now()}`,
      dataset_id: datasetId,
      question,
      status: 'success',
      tool: 'detect_anomalies',
      reason: `Statistical anomaly detection performed on '${targetMetric}' using standard deviation thresholds.`,
      insights: [
        {
          label: 'Anomalies Flagged',
          value: `${anomalyRows.length} record${anomalyRows.length !== 1 ? 's' : ''}`,
          unit: 'records',
        },
        {
          label: 'Anomaly Rate',
          value: `${n > 0 ? ((anomalyRows.length / n) * 100).toFixed(1) : 0}%`,
          unit: '%',
        },
        {
          label: 'Largest Deviation',
          value: topOutlier
            ? `${topOutlier.row[idCol] || 'Record'} (${unit}${formatNumber(topOutlier.row[targetMetric])})`
            : 'No extreme deviations',
        },
        {
          label: 'Threshold',
          value: `±1.8σ (${unit}${formatNumber(mean + 1.8 * std)})`,
        },
      ],
      chart_spec: {
        type: 'scatter',
        title: `Outlier Detection: ${targetMetric.toUpperCase()} vs ${secondaryMetric.toUpperCase()}`,
        x_key: targetMetric,
        y_keys: [secondaryMetric],
        data: scatterData,
        x_label: targetMetric.toUpperCase(),
        y_label: secondaryMetric.toUpperCase(),
        anomaly_markers: anomalyRows.slice(0, 5).map(a => ({
          index: a.index,
          label: String(a.row[idCol] || `Row ${a.index + 1}`),
          value: Number(a.row[targetMetric]) || 0,
        })),
      },
      warnings: [
        { code: 'ANOMALY_HEURISTIC', message: 'Statistical Z-score threshold 1.8 applied on tabular metrics.', severity: 'info' },
      ],
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sql_query: `SELECT *, ABS(${targetMetric} - ${mean.toFixed(2)}) / ${std.toFixed(2)} AS z_score FROM dataset WHERE z_score >= 1.8`,
    }
  }

  // C. KPI / Single-Metric & Extremes Aggregations
  const isKpiOnly = anyMatch(q, ['total', 'sum', 'average', 'avg', 'mean', 'minimum', 'min', 'maximum', 'max', 'how many', 'count', 'overall', 'kpi']) &&
                    !anyMatch(q, ['by ', 'per ', 'breakdown', 'ranking', 'compare', 'across'])
  if (isKpiOnly) {
    const vals = rows.map(r => Number(r[targetMetric]) || 0)
    const sum = vals.reduce((a, b) => a + b, 0)
    const avg = vals.length > 0 ? sum / vals.length : 0
    const min = vals.length > 0 ? Math.min(...vals) : 0
    const max = vals.length > 0 ? Math.max(...vals) : 0

    const kpiChartData = [
      { metric: 'Total', value: Math.round(sum * 100) / 100 },
      { metric: 'Average', value: Math.round(avg * 100) / 100 },
      { metric: 'Maximum', value: Math.round(max * 100) / 100 },
      { metric: 'Minimum', value: Math.round(min * 100) / 100 },
    ]

    return {
      result_id: `result-${Date.now()}`,
      dataset_id: datasetId,
      question,
      status: 'success',
      tool: 'calculate_kpis',
      reason: `Deterministic KPI aggregation computed for '${targetMetric}'${activeFilterDesc ? ` filtered by ${activeFilterDesc}` : ''}.`,
      insights: [
        {
          label: `Total ${targetMetric.toUpperCase()}`,
          value: `${unit}${formatNumber(sum)}`,
        },
        {
          label: `Average ${targetMetric.toUpperCase()}`,
          value: `${unit}${formatNumber(avg)}`,
        },
        {
          label: `Peak ${targetMetric.toUpperCase()}`,
          value: `${unit}${formatNumber(max)}`,
        },
        {
          label: 'Total Analyzed Records',
          value: rows.length.toLocaleString(),
          unit: 'rows',
        },
      ],
      chart_spec: {
        type: 'bar',
        title: `${targetMetric.replace(/_/g, ' ').toUpperCase()} Summary KPIs`,
        x_key: 'metric',
        y_keys: ['value'],
        data: kpiChartData,
        x_label: 'KPI Metric',
        y_label: `${targetMetric.toUpperCase()} (${unit || 'Value'})`,
      },
      warnings: [],
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      sql_query: `SELECT SUM(${targetMetric}) AS total, AVG(${targetMetric}) AS avg, MIN(${targetMetric}) AS min, MAX(${targetMetric}) AS max FROM dataset${activeFilterDesc ? ` WHERE ${activeFilterDesc}` : ''}`,
    }
  }

  // D. Grouped Breakdown / Ranking / Comparisons (Default)
  const isLowest = anyMatch(q, ['lowest', 'least', 'worst', 'bottom', 'smallest'])
  const isAverage = anyMatch(q, ['average', 'avg', 'mean'])

  const grouped: Record<string, { sum: number; count: number }> = {}
  rows.forEach(r => {
    const k = String(r[targetDim] || 'Other')
    const v = typeof r[targetMetric] === 'number' ? r[targetMetric] : 0
    if (!grouped[k]) grouped[k] = { sum: 0, count: 0 }
    grouped[k].sum += v
    grouped[k].count++
  })

  let chartData = Object.entries(grouped).map(([k, d]) => {
    const val = isAverage ? (d.count > 0 ? d.sum / d.count : 0) : d.sum
    return {
      [targetDim]: k,
      [targetMetric]: Math.round(val * 100) / 100,
    }
  })

  if (isLowest) {
    chartData.sort((a, b) => (a[targetMetric] as number) - (b[targetMetric] as number))
  } else {
    chartData.sort((a, b) => (b[targetMetric] as number) - (a[targetMetric] as number))
  }

  const top7 = chartData.slice(0, 7)
  const leader = top7[0]
  const runnerUp = top7[1]
  const totalAll = Object.values(grouped).reduce((acc, c) => acc + (isAverage ? (c.count > 0 ? c.sum / c.count : 0) : c.sum), 0)
  const leaderShare = leader && totalAll > 0 ? Math.round(((leader[targetMetric] as number) / totalAll) * 1000) / 10 : 0

  return {
    result_id: `result-${Date.now()}`,
    dataset_id: datasetId,
    question,
    status: 'success',
    tool: 'summarize_grouped_metrics',
    reason: `Grouped metrics calculation: ${isAverage ? 'AVERAGE' : 'SUM'} of '${targetMetric}' grouped by '${targetDim}'.`,
    insights: [
      {
        label: isLowest ? `Lowest ${targetDim}` : `Top ${targetDim}`,
        value: leader ? `${leader[targetDim]} (${unit}${formatNumber(leader[targetMetric] as number)})` : 'N/A',
      },
      {
        label: isLowest ? 'Second Lowest' : 'Runner-up',
        value: runnerUp ? `${runnerUp[targetDim]} (${unit}${formatNumber(runnerUp[targetMetric] as number)})` : 'None',
      },
      {
        label: isLowest ? 'Lowest Share' : 'Market Share (Leader)',
        value: `${leaderShare}%`,
        unit: '%',
      },
      {
        label: `Total ${targetMetric.toUpperCase()}`,
        value: `${unit}${formatNumber(totalAll)}`,
      },
    ],
    chart_spec: {
      type: 'bar',
      title: `${targetMetric.replace(/_/g, ' ').toUpperCase()} by ${targetDim.replace(/_/g, ' ').toUpperCase()}`,
      x_key: targetDim,
      y_keys: [targetMetric],
      data: top7,
      x_label: targetDim.replace(/_/g, ' ').toUpperCase(),
      y_label: `${targetMetric.replace(/_/g, ' ').toUpperCase()} (${unit || 'Value'})`,
    },
    warnings: [],
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    sql_query: `SELECT ${targetDim}, ${isAverage ? 'AVG' : 'SUM'}(${targetMetric}) AS ${targetMetric} FROM dataset GROUP BY ${targetDim} ORDER BY ${targetMetric} ${isLowest ? 'ASC' : 'DESC'} LIMIT 7`,
  }
}

function anyMatch(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k))
}

// ─── Analysis ──────────────────────────────────────────────────────────────

export async function runAnalysis(
  datasetId: string,
  question: string,
): Promise<AnalysisResult> {
  if (USE_MOCK) {
    await delay(600) // simulate thinking

    const customProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    const profile = customProfiles[datasetId] ?? MOCK_PROFILE

    const customData = getStored<Record<string, any[]>>(STORAGE_KEY_DATA_ROWS, {})
    const rows = customData[datasetId] ?? (datasetId === 'demo-dataset-001' ? MOCK_DATA_ROWS_DEMO : (Object.values(customData)[0] || MOCK_DATA_ROWS_DEMO))

    const result = executeDynamicAnalysis(datasetId, question, profile, rows)

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
    await delay(150)
    const history = getStored<AnalysisResult[]>(STORAGE_KEY_HISTORY, [])
    const found = history.find(r => r.result_id === resultId)
    return found ?? MOCK_ANALYSIS_RESULTS.find(r => r.result_id === resultId) ?? MOCK_ANALYSIS_RESULTS[0]
  }
  const { data } = await http.get<any>(`/api/analysis/${resultId}`)
  return normalizeAnalysisResult(data)
}

export async function listAnalysisHistory(datasetId?: string): Promise<AnalysisResult[]> {
  if (USE_MOCK) {
    await delay(150)
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
    await delay(800)
    return { report_id: `rep-${datasetId}-${Date.now()}`, status: 'ready' }
  }
  const { data } = await http.post<any>('/api/reports/generate', {
    dataset_id: datasetId,
  })
  return { report_id: data.report_id, status: data.status ?? 'ready' }
}

export async function getReport(reportId: string): Promise<Report> {
  if (USE_MOCK) {
    await delay(300)
    const customProfiles = getStored<Record<string, DatasetProfile>>(STORAGE_KEY_PROFILES, {})
    const customData = getStored<Record<string, any[]>>(STORAGE_KEY_DATA_ROWS, {})

    // Find matching dataset from reportId or stored profiles
    let matchedProfile = Object.values(customProfiles)[0] ?? MOCK_PROFILE
    let matchedRows = customData[matchedProfile.dataset_id] ?? MOCK_DATA_ROWS_DEMO

    for (const [dsId, prof] of Object.entries(customProfiles)) {
      if (reportId.includes(dsId)) {
        matchedProfile = prof
        matchedRows = customData[dsId] ?? MOCK_DATA_ROWS_DEMO
        break
      }
    }

    const numericCols = matchedProfile.schema.filter(c => c.inferred_type === 'numeric')
    const primaryNum = numericCols[0]?.name || 'revenue'
    const secondaryNum = numericCols[1]?.name || 'profit'

    const totalPrimary = matchedRows.reduce((a, b) => a + (Number(b[primaryNum]) || 0), 0)
    const totalSecondary = matchedRows.reduce((a, b) => a + (Number(b[secondaryNum]) || 0), 0)

    const catCols = matchedProfile.schema.filter(c => c.inferred_type === 'categorical')
    const topCat = catCols[0]?.name || 'segment'

    const kpis: ReportKPI[] = [
      { label: `Total ${primaryNum.replace(/_/g, ' ').toUpperCase()}`, value: totalPrimary, unit: '$', trend: 'up' },
      { label: `Total ${secondaryNum.replace(/_/g, ' ').toUpperCase()}`, value: totalSecondary, unit: '$', trend: 'up' },
      { label: 'Total Records', value: matchedProfile.row_count, trend: 'neutral' },
      { label: 'Quality Score', value: `${matchedProfile.quality_summary.overall_score}/100`, trend: 'up' },
    ]

    return {
      report_id: reportId,
      dataset_id: matchedProfile.dataset_id,
      status: 'ready',
      title: `Executive Intelligence Report — ${matchedProfile.filename}`,
      executive_summary: `Comprehensive synthesized business intelligence report for '${matchedProfile.filename}' containing ${matchedProfile.row_count} records across ${matchedProfile.column_count} dimensions. Total ${primaryNum} is ${formatNumber(totalPrimary)}, with data health score rated at ${matchedProfile.quality_summary.overall_score}/100.`,
      kpis,
      trend_findings: [
        {
          id: 'trend-1',
          title: `Performance Distribution Across ${topCat.toUpperCase()}`,
          content: `Data indicates healthy performance distribution across ${topCat} dimensions. Ongoing monitoring recommended for high-volume segments.`,
        },
      ],
      anomaly_findings: [
        {
          id: 'anomaly-1',
          title: 'Outlier & Health Assessment',
          content: `${matchedProfile.quality_summary.warnings.length > 0 ? matchedProfile.quality_summary.warnings.join(' ') : 'No critical data quality defects detected across parsed records.'}`,
        },
      ],
      chart_specs: [
        executeDynamicAnalysis(matchedProfile.dataset_id, `Show ${primaryNum} by ${topCat}`, matchedProfile, matchedRows).chart_spec!,
      ],
      recommendations: [
        { id: 'rec-1', title: 'Operational Focus', content: `Leverage top-performing segments identified across ${topCat} to optimize performance.` },
        { id: 'rec-2', title: 'Data Health Review', content: 'Maintain continuous data validation and monitor variance across key metrics.' },
      ],
      data_quality_warnings: matchedProfile.quality_summary.warnings,
      generated_at: new Date().toISOString(),
    }
  }
  const { data } = await http.get<any>(`/api/reports/${reportId}`)
  return normalizeReport(data)
}
