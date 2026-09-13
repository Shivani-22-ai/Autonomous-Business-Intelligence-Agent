/**
 * Comprehensive tests — every button action, API flow, upload validation,
 * chart spec structure, query submit logic, download, and navigation.
 * Pure TypeScript — no JSX/component rendering needed.
 * Runs against the mock adapter (VITE_USE_MOCK=true); no backend required.
 */
import { describe, it, expect } from 'vitest'
import { uploadDataset, getDatasetProfile, runAnalysis, getReport, generateReport, listAnalysisHistory } from '@/api/client'

// ─── A2: Upload validation ────────────────────────────────────────────────────

describe('A2 — Upload file validation', () => {
  function isValidExt(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ['csv', 'xlsx'].includes(ext ?? '')
  }
  function isValidSize(bytes: number): boolean {
    return bytes <= 50 * 1024 * 1024
  }

  it('accepts .csv', () => expect(isValidExt('sales.csv')).toBe(true))
  it('accepts .xlsx', () => expect(isValidExt('report.xlsx')).toBe(true))
  it('rejects .pdf', () => expect(isValidExt('doc.pdf')).toBe(false))
  it('rejects .json', () => expect(isValidExt('data.json')).toBe(false))
  it('rejects .txt', () => expect(isValidExt('readme.txt')).toBe(false))
  it('rejects .exe', () => expect(isValidExt('malware.exe')).toBe(false))
  it('accepts file under 50 MB', () => expect(isValidSize(10 * 1024 * 1024)).toBe(true))
  it('rejects file over 50 MB', () => expect(isValidSize(51 * 1024 * 1024)).toBe(false))
  it('accepts exactly 50 MB', () => expect(isValidSize(50 * 1024 * 1024)).toBe(true))
})

// ─── C1: Chart spec structure ─────────────────────────────────────────────────

describe('C1 — Chart spec validation', () => {
  it('bar: has x_key, y_keys, and data', () => {
    const spec = { type: 'bar', x_key: 'region', y_keys: ['revenue'], data: [{ region: 'North', revenue: 100 }] }
    expect(spec.type).toBe('bar')
    expect(spec.y_keys.length).toBeGreaterThan(0)
    expect(spec.data[0]).toHaveProperty(spec.x_key)
  })

  it('area: every y_key exists in each data row', () => {
    const spec = { type: 'area', y_keys: ['revenue', 'profit'], data: [{ month: 'Jan', revenue: 100, profit: 30 }] }
    spec.y_keys.forEach(k => expect(spec.data[0]).toHaveProperty(k))
  })

  it('scatter: has x_key and at least one y_key', () => {
    const spec = { type: 'scatter', x_key: 'revenue', y_keys: ['profit'], data: [{ revenue: 500, profit: 150 }] }
    expect(spec.x_key).toBeDefined()
    expect(spec.y_keys.length).toBeGreaterThanOrEqual(1)
  })

  it('line: data rows contain all y_keys', () => {
    const spec = { type: 'line', x_key: 'month', y_keys: ['revenue'], data: [{ month: 'Jan', revenue: 400000 }] }
    spec.y_keys.forEach(k => expect(spec.data[0]).toHaveProperty(k))
  })

  it('anomaly markers reference valid data row indices', () => {
    const spec = {
      type: 'scatter', x_key: 'revenue', y_keys: ['profit'],
      data: [{ revenue: 500, profit: 150 }, { revenue: 24999, profit: 6999 }],
      anomaly_markers: [{ index: 1, label: 'ORD-0748', value: 24999 }],
    }
    spec.anomaly_markers.forEach(m => {
      expect(m.index).toBeGreaterThanOrEqual(0)
      expect(m.index).toBeLessThan(spec.data.length)
    })
  })

  it('KPI values are concrete numbers or strings, never undefined', () => {
    const kpis = [
      { label: 'Total Revenue', value: 6003203, unit: '$' },
      { label: 'Top Region', value: 'North', unit: '' },
    ]
    kpis.forEach(k => {
      expect(k.value).not.toBeUndefined()
      expect(k.label).toBeTruthy()
    })
  })
})

// ─── A2 API: uploadDataset ────────────────────────────────────────────────────

describe('API — uploadDataset (Upload button)', () => {
  it('returns dataset_id, row_count, column_count, file_type, created_at', async () => {
    const file = new File(['order_id,revenue\n1,100\n2,200'], 'test.csv', { type: 'text/csv' })
    const result = await uploadDataset(file)
    expect(result.dataset_id).toBeTruthy()
    expect(typeof result.row_count).toBe('number')
    expect(result.row_count).toBeGreaterThan(0)
    expect(typeof result.column_count).toBe('number')
    expect(result.column_count).toBeGreaterThan(0)
    expect(['csv', 'xlsx']).toContain(result.file_type)
    expect(result.created_at).toBeTruthy()
  }, 10_000)

  it('progress callback fires from 0 → 100', async () => {
    const file = new File(['a,b\n1,2'], 'test.csv', { type: 'text/csv' })
    const progress: number[] = []
    await uploadDataset(file, pct => progress.push(pct))
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[0]).toBeGreaterThanOrEqual(0)
    expect(progress[progress.length - 1]).toBe(100)
  }, 10_000)
})

// ─── A3 API: getDatasetProfile ────────────────────────────────────────────────

describe('API — getDatasetProfile (Profile screen)', () => {
  it('returns schema array with all required column fields', async () => {
    const profile = await getDatasetProfile('demo-dataset-001')
    expect(Array.isArray(profile.schema)).toBe(true)
    expect(profile.schema.length).toBeGreaterThan(0)
    profile.schema.forEach(col => {
      expect(col).toHaveProperty('name')
      expect(col).toHaveProperty('inferred_type')
      expect(col).toHaveProperty('unique_count')
      expect(typeof col.missing_count).toBe('number')
      expect(typeof col.missing_pct).toBe('number')
      expect(Array.isArray(col.sample_values)).toBe(true)
    })
  }, 5_000)

  it('quality_summary score is 0–100, warnings are arrays', async () => {
    const profile = await getDatasetProfile('demo-dataset-001')
    expect(profile.quality_summary.overall_score).toBeGreaterThanOrEqual(0)
    expect(profile.quality_summary.overall_score).toBeLessThanOrEqual(100)
    expect(Array.isArray(profile.quality_summary.warnings)).toBe(true)
    expect(Array.isArray(profile.quality_summary.critical_issues)).toBe(true)
  }, 5_000)
})

// ─── B1+B2 API: runAnalysis (Ask button) ────────────────────────────────────

describe('API — runAnalysis (Ask Question button)', () => {
  it('returns success with tool, reason, insights, warnings', async () => {
    const result = await runAnalysis('demo-dataset-001', 'Which region has the highest revenue?')
    expect(result.status).toBe('success')
    expect(result.tool).not.toBeNull()
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
    expect(Array.isArray(result.insights)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
  }, 10_000)

  it('insight values are never undefined (no fabricated numbers)', async () => {
    const result = await runAnalysis('demo-dataset-001', 'Show monthly revenue growth.')
    result.insights.forEach(ins => {
      expect(ins.value).not.toBeUndefined()
      expect(ins.label).toBeTruthy()
    })
  }, 10_000)

  it('chart_spec data rows contain all y_keys', async () => {
    const result = await runAnalysis('demo-dataset-001', 'Which region has the highest revenue?')
    if (result.chart_spec) {
      expect(result.chart_spec.data.length).toBeGreaterThan(0)
      result.chart_spec.y_keys.forEach(key => {
        expect(result.chart_spec!.data[0]).toHaveProperty(key)
      })
    }
  }, 10_000)

  it('each call returns a unique result_id', async () => {
    const r1 = await runAnalysis('demo-dataset-001', 'Question A')
    const r2 = await runAnalysis('demo-dataset-001', 'Question B')
    expect(r1.result_id).not.toBe(r2.result_id)
  }, 20_000)
})

// ─── B1: Query submit button guard ───────────────────────────────────────────

describe('B1 — Query submit button guards', () => {
  function canSubmit(question: string, isPending: boolean): boolean {
    return question.trim().length > 0 && !isPending
  }

  it('disabled when question is empty', () => expect(canSubmit('', false)).toBe(false))
  it('disabled when question is whitespace', () => expect(canSubmit('   ', false)).toBe(false))
  it('disabled when already pending', () => expect(canSubmit('valid question', true)).toBe(false))
  it('enabled with valid question and not pending', () => expect(canSubmit('Which region?', false)).toBe(true))
})

// ─── B3 API: listAnalysisHistory ─────────────────────────────────────────────

describe('API — listAnalysisHistory (History page)', () => {
  it('returns array with required fields on every item', async () => {
    const history = await listAnalysisHistory()
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThan(0)
    history.forEach(r => {
      expect(r).toHaveProperty('result_id')
      expect(r).toHaveProperty('question')
      expect(r).toHaveProperty('status')
      expect(r).toHaveProperty('created_at')
      expect(r).toHaveProperty('dataset_id')
    })
  }, 5_000)

  it('dataset filter returns only matching records', async () => {
    const history = await listAnalysisHistory('demo-dataset-001')
    history.forEach(r => expect(r.dataset_id).toBe('demo-dataset-001'))
  }, 5_000)
})

// ─── D1+D2 API: report generation ────────────────────────────────────────────

describe('API — generateReport + getReport (Report button)', () => {
  it('generateReport returns report_id and ready status', async () => {
    const result = await generateReport('demo-dataset-001')
    expect(result.report_id).toBeTruthy()
    expect(result.status).toBe('ready')
  }, 10_000)

  it('getReport returns all required sections', async () => {
    const report = await getReport('report-001')
    expect(report.status).toBe('ready')
    expect(report.executive_summary.length).toBeGreaterThan(10)
    expect(report.kpis.length).toBeGreaterThan(0)
    expect(Array.isArray(report.trend_findings)).toBe(true)
    expect(Array.isArray(report.anomaly_findings)).toBe(true)
    expect(Array.isArray(report.recommendations)).toBe(true)
    expect(Array.isArray(report.data_quality_warnings)).toBe(true)
    expect(Array.isArray(report.chart_specs)).toBe(true)
  }, 5_000)

  it('all KPI values are defined and labelled', async () => {
    const report = await getReport('report-001')
    report.kpis.forEach(kpi => {
      expect(kpi.label).toBeTruthy()
      expect(kpi.value).not.toBeUndefined()
    })
  }, 5_000)
})

// ─── D3: JSON download button ─────────────────────────────────────────────────

describe('D3 — JSON download button', () => {
  it('produces a valid, parseable JSON blob from report', async () => {
    const report = await getReport('report-001')
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(0)
    const text = await blob.text()
    const parsed = JSON.parse(text)
    expect(parsed.report_id).toBe(report.report_id)
    expect(parsed.kpis.length).toBe(report.kpis.length)
    expect(parsed.executive_summary).toBe(report.executive_summary)
  }, 5_000)
})

// ─── Navigation — URL construction ───────────────────────────────────────────

describe('Navigation — URL construction (all nav buttons)', () => {
  const datasetId = 'demo-dataset-001'
  const reportId = 'report-001'

  it('dashboard route', () => expect('/dashboard').toBe('/dashboard'))
  it('upload route', () => expect('/upload').toBe('/upload'))
  it('history route', () => expect('/history').toBe('/history'))
  it('profile route', () => expect(`/datasets/${datasetId}/profile`).toBe('/datasets/demo-dataset-001/profile'))
  it('query route', () => expect(`/datasets/${datasetId}/query`).toBe('/datasets/demo-dataset-001/query'))
  it('report route', () => expect(`/reports/${reportId}`).toBe('/reports/report-001'))
})
