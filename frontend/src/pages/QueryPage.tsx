/** Tasks B1 + B2 — Natural-language query interface + Insight cards */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Send, FileText, Lightbulb, BookOpen, Sparkles } from 'lucide-react'
import { runAnalysis, generateReport } from '@/api/client'
import type { AnalysisResult } from '@/types'
import { InsightCard } from '@/components/InsightCard'
import { ChartRenderer } from '@/charts/ChartRenderer'
import { LoadingState, EmptyState, ErrorState, PageHeader } from '@/components/ui'

const EXAMPLE_QUESTIONS = [
  'Which region has the highest revenue?',
  'Show monthly revenue growth.',
  'Find unusual transactions.',
  'What is the average profit margin by product?',
  'Which customer segment generates the most profit?',
]

function ThinkingState() {
  return (
    <div className="card p-8 flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-brand-600/20 flex items-center justify-center">
          <Sparkles size={24} className="text-brand-400 animate-pulse-slow" />
        </div>
        <div className="absolute -inset-1 rounded-2xl border-2 border-brand-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-white">Agent is working…</p>
        <p className="text-sm text-surface-400 mt-1">
          Selecting analysis tool and computing results from your dataset
        </p>
        <p className="text-xs text-surface-500 mt-2">
          Results are computed by the analytics engine — not invented by the LLM
        </p>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export function QueryPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [results, setResults] = useState<AnalysisResult[]>([])

  const { mutate: ask, isPending, isError, error } = useMutation({
    mutationFn: (q: string) => runAnalysis(datasetId!, q),
    onSuccess: result => {
      setResults(prev => [result, ...prev])
      setQuestion('')
    },
  })

  const { mutate: requestReport, isPending: reportPending } = useMutation({
    mutationFn: () => generateReport(datasetId!),
    onSuccess: ({ report_id }) => navigate(`/reports/${report_id}`),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || isPending) return
    ask(q)
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Ask a Question"
        subtitle={`Analysing dataset: ${datasetId}`}
        actions={
          <button
            className="btn-secondary text-sm"
            onClick={() => navigate(`/datasets/${datasetId}/profile`)}
          >
            <FileText size={14} /> View Profile
          </button>
        }
      />

      {/* Query input — Task B1 */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center shrink-0 mt-1">
            <Lightbulb size={15} className="text-brand-400" />
          </div>
          <textarea
            id="question-input"
            className="textarea flex-1 min-h-[80px] text-sm"
            placeholder="e.g. Which region had the strongest revenue growth?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={isPending}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg bg-surface-700/60 hover:bg-surface-600/60 text-surface-300 hover:text-white border border-surface-600/40 transition-all"
                onClick={() => setQuestion(q)}
                disabled={isPending}
              >
                {q}
              </button>
            ))}
          </div>
          <button
            id="submit-question"
            type="submit"
            className="btn-primary shrink-0"
            disabled={!question.trim() || isPending}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Send size={15} /> Ask
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error state */}
      {isError && !isPending && (
        <ErrorState
          message={error instanceof Error ? error.message : 'Analysis failed. Please try again.'}
        />
      )}

      {/* Thinking state — shown during pending, never before backend responds */}
      {isPending && <ThinkingState />}

      {/* Results — Task B2 */}
      {results.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="section-label">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <button
              className="btn-secondary text-sm"
              onClick={() => requestReport()}
              disabled={reportPending}
            >
              {reportPending ? (
                <><div className="w-4 h-4 rounded-full border-2 border-surface-400/30 border-t-surface-200 animate-spin" /> Generating…</>
              ) : (
                <><BookOpen size={14} /> Generate Report</>
              )}
            </button>
          </div>

          {results.map(result => (
            <div key={result.result_id} className="space-y-4 animate-slide-up">
              <InsightCard result={result} />
              {result.chart_spec && result.chart_spec.type !== 'none' && (
                <div className="card p-6">
                  <ChartRenderer spec={result.chart_spec} height={300} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !isPending && (
        <EmptyState
          icon={<Lightbulb size={26} />}
          title="No analyses yet"
          description="Type a business question above or click one of the examples to get started."
        />
      )}
    </div>
  )
}
