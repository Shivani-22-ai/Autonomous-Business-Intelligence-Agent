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

    // 4. Verify analysis query answers based on actual dataset and question
    // Query 1: Revenue by region
    const resRegion = await runAnalysis(uploadRes.dataset_id, 'Which region has the highest revenue?')
    expect(resRegion.status).toBe('success')
    expect(resRegion.tool).toBe('summarize_grouped_metrics')
    expect(resRegion.chart_spec?.x_key).toBe('region')
    // North has 1500 + 4200 = 5700
    const topRegionRow = resRegion.chart_spec?.data[0]
    expect(topRegionRow?.region).toBe('North')
    expect(topRegionRow?.revenue).toBe(5700)

    // Query 2: Units by product (different metric and dimension!)
    const resProduct = await runAnalysis(uploadRes.dataset_id, 'Show total units by product')
    expect(resProduct.status).toBe('success')
    expect(resProduct.chart_spec?.x_key).toBe('product')
    // Widget B has 8 + 12 = 20 units
    const topProductRow = resProduct.chart_spec?.data[0]
    expect(topProductRow?.product).toBe('Widget B')
    expect(topProductRow?.units).toBe(20)

    // Query 3: KPI sum calculation (total revenue = 1500+2400+3100+1800+4200 = 13000)
    const resKpi = await runAnalysis(uploadRes.dataset_id, 'What is the total revenue?')
    expect(resKpi.status).toBe('success')
    expect(resKpi.tool).toBe('calculate_kpis')
    const totalInsight = resKpi.insights.find(i => i.label.toLowerCase().includes('total'))
    expect(totalInsight?.value).toContain('13,000')
  })

  it('rejects invalid or empty files with clear error messages', async () => {
    // 1. Empty file (0 bytes)
    const emptyFile = new File([], 'empty.csv', { type: 'text/csv' })
    await expect(uploadDataset(emptyFile)).rejects.toThrow(/empty/i)

    // 2. Header-only file without data rows
    const headerOnlyFile = new File(['order_id,region,revenue\n'], 'headers_only.csv', { type: 'text/csv' })
    await expect(uploadDataset(headerOnlyFile)).rejects.toThrow(/0 data rows/i)

    // 3. Binary corrupted file
    const binaryFile = new File(['\u0000\u0001\u0002PK\u0003\u0004corrupted'], 'bad.csv', { type: 'text/csv' })
    await expect(uploadDataset(binaryFile)).rejects.toThrow(/binary|corrupted/i)
  })
})
