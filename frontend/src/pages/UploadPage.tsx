/** Tasks A2 — Upload experience */
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { uploadDataset } from '@/api/client'
import type { UploadResponse } from '@/types'
import { PageHeader } from '@/components/ui'

const MAX_SIZE_MB = 50
const ACCEPTED_TYPES = { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }

type UploadState = 'idle' | 'validating' | 'uploading' | 'success' | 'error'

export function UploadPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setSelectedFile(file)

    // Client-side validation
    setState('validating')
    await new Promise(r => setTimeout(r, 300))

    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > MAX_SIZE_MB) {
      setError(`File too large (${sizeMB.toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`)
      setState('error')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setError(`Unsupported format ".${ext}". Please upload a CSV or XLSX file.`)
      setState('error')
      return
    }

    // Upload
    setState('uploading')
    setProgress(0)
    try {
      const response = await uploadDataset(file, pct => setProgress(pct))
      setResult(response)
      setState('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(msg)
      setState('error')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDropAccepted: ([file]) => handleFile(file),
    onDropRejected: ([rejection]) => {
      setError(rejection.errors[0]?.message ?? 'File rejected')
      setState('error')
    },
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    maxFiles: 1,
    disabled: state === 'uploading' || state === 'success',
  })

  const reset = () => {
    setState('idle')
    setError(null)
    setResult(null)
    setSelectedFile(null)
    setProgress(0)
  }

  const dropBorder =
    isDragReject ? 'border-accent-rose bg-accent-rose/5' :
    isDragActive  ? 'border-accent-cyan bg-accent-cyan/5' :
    state === 'success' ? 'border-accent-emerald bg-accent-emerald/5' :
    state === 'error'   ? 'border-accent-rose bg-accent-rose/5' :
    'border-surface-600/50 hover:border-brand-500/60 hover:bg-brand-500/5'

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto">
      <PageHeader
        title="Upload Dataset"
        subtitle="Supported formats: CSV, XLSX · Maximum size: 50 MB"
      />

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-200 ${dropBorder}
          ${state === 'uploading' || state === 'success' ? 'cursor-default' : ''}
        `}
      >
        <input {...getInputProps()} />

        {state === 'idle' || state === 'validating' ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-700/60 flex items-center justify-center mx-auto text-surface-400">
              <Upload size={28} className={isDragActive ? 'text-accent-cyan animate-bounce' : ''} />
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                {isDragActive ? 'Drop your file here' : 'Drag & drop a file, or click to browse'}
              </p>
              <p className="text-sm text-surface-400 mt-1">CSV or XLSX, up to 50 MB</p>
            </div>
            <div className="flex justify-center gap-3">
              <span className="badge badge-neutral">.csv</span>
              <span className="badge badge-neutral">.xlsx</span>
            </div>
            {state === 'validating' && (
              <p className="text-xs text-brand-400 animate-pulse">Validating file…</p>
            )}
          </div>
        ) : state === 'uploading' ? (
          <div className="space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-brand-600/20 flex items-center justify-center mx-auto">
              <FileText size={28} className="text-brand-400" />
            </div>
            <p className="text-base font-semibold text-white">{selectedFile?.name}</p>
            <div className="w-full bg-surface-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-accent-cyan rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-surface-400">{progress}% uploaded…</p>
          </div>
        ) : state === 'success' && result ? (
          <div className="space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-accent-emerald/15 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-accent-emerald" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Dataset accepted!</p>
              <p className="text-sm text-surface-400 mt-1">{result.filename}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Rows', value: result.row_count.toLocaleString() },
                { label: 'Columns', value: result.column_count },
                { label: 'Format', value: result.file_type.toUpperCase() },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-accent-emerald/10">
                  <p className="text-lg font-bold text-accent-emerald">{s.value}</p>
                  <p className="text-xs text-surface-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : state === 'error' ? (
          <div className="space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-accent-rose/15 flex items-center justify-center mx-auto">
              <XCircle size={28} className="text-accent-rose" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Upload failed</p>
              <p className="text-sm text-accent-rose mt-1">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {state === 'success' && result && (
          <>
            <button
              className="btn-primary flex-1"
              onClick={() => navigate(`/datasets/${result.dataset_id}/profile`)}
            >
              View Profile <ArrowRight size={15} />
            </button>
            <button
              className="btn-secondary flex-1"
              onClick={() => navigate(`/datasets/${result.dataset_id}/query`)}
            >
              Ask a Question
            </button>
          </>
        )}
        {(state === 'error' || state === 'success') && (
          <button className="btn-ghost" onClick={reset}>
            Upload another file
          </button>
        )}
      </div>

      {/* Tips */}
      {state === 'idle' && (
        <div className="mt-8 p-4 rounded-xl bg-surface-800/60 border border-surface-700/40 space-y-2">
          <p className="text-xs font-semibold text-surface-300 flex items-center gap-2">
            <AlertTriangle size={13} className="text-accent-amber" /> Tips
          </p>
          <ul className="space-y-1 text-xs text-surface-400 list-disc list-inside">
            <li>Include a header row with descriptive column names</li>
            <li>Date columns should use consistent ISO 8601 format (YYYY-MM-DD)</li>
            <li>Numeric columns should not contain currency symbols</li>
            <li>No personally identifiable information (PII)</li>
          </ul>
        </div>
      )}
    </div>
  )
}
