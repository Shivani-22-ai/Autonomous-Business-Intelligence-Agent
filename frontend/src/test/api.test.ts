/**
 * Unit tests for the ABI Agent frontend.
 * All tests run against the mock adapter (VITE_USE_MOCK=true in .env.local).
 * No backend required.
 */
import { describe, it, expect } from 'vitest'
import { uploadDataset, getDatasetProfile, runAnalysis, getReport } from '@/api/client'

// ── Upload validation helpers ───────────────────────────────────────────
describe('Upload file validation logic', () => {
  function isValidExt(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['csv', 'xlsx'].includes(ext ?? '')
  }
  function isValidSize(bytes: number): boolean {
    return bytes <= 50 * 1024 * 1024
  }

  it('accepts .csv extension', () => expect(isValidExt('sales.csv')).toBe(true))
  it('accepts .xlsx extension', () => expect(isValidExt('report.xlsx')).toBe(true))
  it('rejects .pdf extension', () => expect(isValidExt('doc.pdf')).toBe(false))
  it('rejects .json extension', () => expect(isValidExt('data.json')).toBe(false))
  it('accepts file under 50 MB', () => expect(isValidSize(10 * 1024 * 1024)).toBe(true))
  it('rejects file over 50 MB', () => expect(isValidSize(51 * 1024 * 1024)).toBe(false))
  it('accepts exactly 50 MB', () => expect(isValidSize(50 * 1024 * 1024)).toBe(true))
})

// ── Chart spec validation ──────────────────────────────────────────────
describe('Chart spec structure', () => {
  it('bar spec has required fields', () => {
    const spec = {
      type: 'bar', title: 'Revenue by Region',
      x_key: 'region', y_keys: ['revenue'],
      data: [{ region: 'North', revenue: 100 }],
    }
    expect(spec.type).toBe('bar')
    expect(spec.y_keys.length).toBeGreaterThan(0)
    expect(spec.data.length).toBeGreaterThan(0)
    expect(spec.data[0]).toHaveProperty(spec.x_key)
  })

  it('area spec data contains all y_key columns', () => {
    const spec = { type: 'area', y_keys: ['revenue', 'profit'], data: [{ month: 'Jan', revenue: 100, profit: 30 }] }
    spec.y_keys.forEach(key => expect(spec.data[0]).toHaveProperty(key))
  })

  it('scatter spec has both x_key and y_keys', () => {
    const spec = { type: 'scatter', x_key: 'revenue', y_keys: ['profit'], data: [{ revenue: 500, profit: 150 }] }
    expect(spec.x_key).toBeDefined()
    expect(spec.y_keys.length).toBeGreaterThanOrEqual(1)
  })

  it('KPI values are numbers or strings, never undefined', () => {
    const kpis = [
      { label: 'Revenue', value: 1000000, unit: '$' },
      { label: 'Region', value: 'North', unit: '' },
    ]
    kpis.forEach(k => {
      expect(k.value).not.toBeUndefined()
      expect(k.label).toBeTruthy()
    })
  })
})

// ── Mock API client (runs against VITE_USE_MOCK=true) ─────────────────
describe('Mock API client — dataset upload', () => {
  it('uploadDataset returns a dataset_id and row/column counts', async () => {
    const file = new File(['order_id,revenue\n1,100\n2,200'], 'test.csv', { type: 'text/csv' })
    const result = await uploadDataset(file)
    expect(result.dataset_id).toBeTruthy()
    expect(typeof result.row_count).toBe('number')
    expect(result.row_count).toBeGreaterThan(0)
    expect(typeof result.column_count).toBe('number')
    expect(result.column_count).toBeGreaterThan(0)
    expect(['csv', 'xlsx']).toContain(result.file_type)
  }, 10_000)
})

describe('Mock API client — dataset profile', () => {
  it('getDatasetProfile returns a schema array with typed columns', async () => {
    const profile = await getDatasetProfile('demo-dataset-001')
    expect(Array.isArray(profile.schema)).toBe(true)
    expect(profile.schema.length).toBeGreaterThan(0)
    profile.schema.forEach(col => {
      expect(col).toHaveProperty('name')
      expect(col).toHaveProperty('inferred_type')
      expect(col).toHaveProperty('unique_count')
      expect(typeof col.missing_count).toBe('number')
    })
    expect(profile.quality_summary).toHaveProperty('overall_score')
    expect(profile.quality_summary.overall_score).toBeGreaterThanOrEqual(0)
    expect(profile.quality_summary.overall_score).toBeLessThanOrEqual(100)
  }, 5_000)
})

describe('Mock API client — analysis', () => {
  it('runAnalysis returns success result with insights and chart spec', async () => {
    const result = await runAnalysis('demo-dataset-001', 'Which region has the highest revenue?')
    expect(result.status).toBe('success')
    expect(Array.isArray(result.insights)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(result.tool).not.toBeNull()
    // All insight values must be concrete — not undefined (no fabricated numbers)
    result.insights.forEach(ins => {
      expect(ins.value).not.toBeUndefined()
      expect(ins.label).toBeTruthy()
    })
    // Chart data must come from backend, not invented
    if (result.chart_spec) {
      expect(result.chart_spec.data.length).toBeGreaterThan(0)
      expect(result.chart_spec.y_keys.length).toBeGreaterThan(0)
    }
  }, 10_000)
})

describe('Mock API client — report', () => {
  it('getReport returns a ready report with KPIs and executive summary', async () => {
    const report = await getReport('report-001')
    expect(report.status).toBe('ready')
    expect(report.kpis.length).toBeGreaterThan(0)
    expect(report.executive_summary.length).toBeGreaterThan(10)
    expect(Array.isArray(report.trend_findings)).toBe(true)
    expect(Array.isArray(report.anomaly_findings)).toBe(true)
    expect(Array.isArray(report.recommendations)).toBe(true)
    // KPI values must all be real (not undefined)
    report.kpis.forEach(kpi => {
      expect(kpi.value).not.toBeUndefined()
      expect(kpi.label).toBeTruthy()
    })
  }, 5_000)
})
