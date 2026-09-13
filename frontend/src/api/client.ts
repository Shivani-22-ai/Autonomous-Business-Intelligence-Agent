/**
 * Typed API client.
 * When VITE_USE_MOCK=true (default), every call is intercepted by the mock
 * adapter so the frontend is fully demonstrable without a running backend.
 * Swap VITE_USE_MOCK=false and set VITE_API_BASE_URL to hit the real FastAPI.
 */
import axios from 'axios'
import type {
  Dataset,
  DatasetProfile,
  AnalysisResult,
  Report,
  UploadResponse,
} from '@/types'
import {
  MOCK_UPLOAD_RESPONSE,
  MOCK_DATASETS,
  MOCK_PROFILE,
  MOCK_ANALYSIS_RESULTS,
  MOCK_REPORT,
} from './mockData'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const http = axios.create({ baseURL: API_BASE, timeout: 30_000 })

// ─── Helper ────────────────────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
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
  const { data } = await http.post<UploadResponse>('/api/datasets/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function listDatasets(): Promise<Dataset[]> {
  if (USE_MOCK) { await delay(400); return MOCK_DATASETS }
  const { data } = await http.get<Dataset[]>('/api/datasets')
  return data
}

export async function getDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  if (USE_MOCK) { await delay(600); return { ...MOCK_PROFILE, dataset_id: datasetId } }
  const { data } = await http.get<DatasetProfile>(`/api/datasets/${datasetId}/profile`)
  return data
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
  const { data } = await http.post<AnalysisResult>('/api/analysis/query', {
    dataset_id: datasetId,
    question,
    context: {},
  })
  return data
}

export async function getAnalysisResult(resultId: string): Promise<AnalysisResult> {
  if (USE_MOCK) {
    await delay(300)
    return MOCK_ANALYSIS_RESULTS.find(r => r.result_id === resultId) ?? MOCK_ANALYSIS_RESULTS[0]
  }
  const { data } = await http.get<AnalysisResult>(`/api/analysis/${resultId}`)
  return data
}

export async function listAnalysisHistory(datasetId?: string): Promise<AnalysisResult[]> {
  if (USE_MOCK) {
    await delay(400)
    return datasetId
      ? MOCK_ANALYSIS_RESULTS.filter(r => r.dataset_id === datasetId)
      : MOCK_ANALYSIS_RESULTS
  }
  const params = datasetId ? { dataset_id: datasetId } : {}
  const { data } = await http.get<AnalysisResult[]>('/api/analysis', { params })
  return data
}

// ─── Reports ───────────────────────────────────────────────────────────────

export async function generateReport(datasetId: string): Promise<{ report_id: string; status: string }> {
  if (USE_MOCK) {
    await delay(2200)
    return { report_id: MOCK_REPORT.report_id, status: 'ready' }
  }
  const { data } = await http.post<{ report_id: string; status: string }>('/api/reports/generate', {
    dataset_id: datasetId,
  })
  return data
}

export async function getReport(reportId: string): Promise<Report> {
  if (USE_MOCK) {
    await delay(500)
    return { ...MOCK_REPORT, report_id: reportId }
  }
  const { data } = await http.get<Report>(`/api/reports/${reportId}`)
  return data
}
