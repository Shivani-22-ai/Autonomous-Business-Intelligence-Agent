import { describe, it, expect, beforeEach } from 'vitest'
import { uploadDataset, listDatasets, getDatasetProfile, runAnalysis } from '@/api/client'

describe('Upload Feature & Dynamic Dashboard Updation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uploads a new custom CSV and updates dataset list with real metadata', async () => {
    const csvContent = `order_id,region,product,revenue,cost,units
ORD-101,North,Widget A,1500,800,5
ORD-102,South,Widget B,2400,1200,8
ORD-103,East,Widget C,3100,1500,10
ORD-104,West,Widget A,1800,900,6
ORD-105,North,Widget B,4200,2100,12`

    const file = new File([csvContent], 'q4_custom_sales.csv', { type: 'text/csv' })

    // 1. Upload dataset
    const uploadRes = await uploadDataset(file)
    expect(uploadRes.filename).toBe('q4_custom_sales.csv')
    expect(uploadRes.row_count).toBe(5)
    expect(uploadRes.column_count).toBe(6)

    // 2. Verify dataset list includes newly uploaded dataset at the top
    const datasets = await listDatasets()
    expect(datasets.length).toBeGreaterThanOrEqual(2)
    expect(datasets[0].filename).toBe('q4_custom_sales.csv')
    expect(datasets[0].row_count).toBe(5)
    expect(datasets[0].column_count).toBe(6)

    // 3. Verify dataset profile is computed from the uploaded CSV
    const profile = await getDatasetProfile(uploadRes.dataset_id)
    expect(profile.filename).toBe('q4_custom_sales.csv')
    expect(profile.row_count).toBe(5)
    expect(profile.column_count).toBe(6)
    expect(profile.schema).toHaveLength(6)

    // Check inferred types
    const revCol = profile.schema.find(c => c.name === 'revenue')
    expect(revCol).toBeDefined()
    expect(revCol?.inferred_type).toBe('numeric')
    expect(revCol?.min).toBe(1500)
    expect(revCol?.max).toBe(4200)

    const regCol = profile.schema.find(c => c.name === 'region')
    expect(regCol).toBeDefined()
    expect(regCol?.inferred_type).toBe('categorical')
    expect(regCol?.unique_count).toBe(4)

    // 4. Verify analysis query works against the uploaded dataset
    const analysisRes = await runAnalysis(uploadRes.dataset_id, 'Show revenue by region')
    expect(analysisRes.status).toBe('success')
    expect(analysisRes.insights.length).toBeGreaterThan(0)
    expect(analysisRes.chart_spec?.data.length).toBeGreaterThan(0)
  })
})
