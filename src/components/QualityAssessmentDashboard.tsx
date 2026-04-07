// src/components/QualityAssessmentDashboard.tsx
//
// Phase 2 UI: review per-paper Cochrane RoB 2 assessments produced by the
// /assessQuality endpoint. Pure presentational component — caller fetches
// the data and supplies callbacks for approve/override so this slots into
// any parent route without coupling to the API layer.

import { useMemo, useState } from 'react'

export type BiasJudgement = 'low' | 'some_concern' | 'high'

export interface QualityAssessment {
  paperId: string
  paperTitle?: string
  biasDomains: {
    selection: BiasJudgement
    performance: BiasJudgement
    detection: BiasJudgement
    attrition: BiasJudgement
    reporting: BiasJudgement
  }
  biasReasoning: {
    selection: string
    performance: string
    detection: string
    attrition: string
    reporting: string
  }
  overallQuality: number // 0-10
  assessmentReasoning: string
  userDecision?: 'approved' | 'overridden' | null
  userOverrideReasoning?: string | null
}

interface Props {
  assessments: QualityAssessment[]
  onApprove?: (paperId: string) => void
  onOverride?: (
    paperId: string,
    overrides: Partial<QualityAssessment['biasDomains']>,
    reasoning: string
  ) => void
}

const DOMAINS: Array<{ key: keyof QualityAssessment['biasDomains']; label: string }> = [
  { key: 'selection', label: 'Selection' },
  { key: 'performance', label: 'Performance' },
  { key: 'detection', label: 'Detection' },
  { key: 'attrition', label: 'Attrition' },
  { key: 'reporting', label: 'Reporting' },
]

const BIAS_STYLES: Record<BiasJudgement, string> = {
  low: 'bg-green-100 text-green-900 border-green-300',
  some_concern: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  high: 'bg-red-100 text-red-900 border-red-300',
}

const BIAS_LABEL: Record<BiasJudgement, string> = {
  low: 'Low',
  some_concern: 'Some concern',
  high: 'High',
}

function qualityBarColor(q: number): string {
  if (q >= 8) return 'bg-green-500'
  if (q >= 6) return 'bg-lime-500'
  if (q >= 4) return 'bg-yellow-500'
  if (q >= 2) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function QualityAssessmentDashboard({
  assessments,
  onApprove,
  onOverride,
}: Props) {
  const [domainFilter, setDomainFilter] = useState<'all' | BiasJudgement>('all')
  const [minQuality, setMinQuality] = useState(0)
  const [overrideTarget, setOverrideTarget] = useState<QualityAssessment | null>(null)

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (a.overallQuality < minQuality) return false
      if (domainFilter === 'all') return true
      return Object.values(a.biasDomains).some((d) => d === domainFilter)
    })
  }, [assessments, domainFilter, minQuality])

  const summary = useMemo(() => {
    const total = assessments.length
    const approved = assessments.filter((a) => a.userDecision === 'approved').length
    const overridden = assessments.filter((a) => a.userDecision === 'overridden').length
    const avgQuality =
      total === 0 ? 0 : assessments.reduce((sum, a) => sum + a.overallQuality, 0) / total
    return { total, approved, overridden, avgQuality }
  }, [assessments])

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quality Assessment</h2>
            <p className="text-sm text-slate-600">
              Cochrane RoB 2 review · {summary.total} papers · avg quality{' '}
              {summary.avgQuality.toFixed(1)}/10
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="rounded bg-green-100 px-2 py-1 text-green-900">
              {summary.approved} approved
            </span>
            <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
              {summary.overridden} overridden
            </span>
            <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
              {summary.total - summary.approved - summary.overridden} pending
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <label className="text-sm">
          Filter by bias level:{' '}
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value as 'all' | BiasJudgement)}
            className="ml-1 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="low">Has low</option>
            <option value="some_concern">Has some concern</option>
            <option value="high">Has high</option>
          </select>
        </label>
        <label className="text-sm">
          Min quality:{' '}
          <input
            type="number"
            min={0}
            max={10}
            value={minQuality}
            onChange={(e) => setMinQuality(Number(e.target.value))}
            className="ml-1 w-16 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <span className="text-sm text-slate-500">
          Showing {filtered.length} of {assessments.length}
        </span>
      </div>

      {/* Per-paper cards */}
      <div className="space-y-4">
        {filtered.map((a) => (
          <article
            key={a.paperId}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-slate-900">
                  {a.paperTitle ?? a.paperId}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{a.paperId}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{a.overallQuality}/10</div>
                  <div className="text-xs text-slate-500">Overall quality</div>
                </div>
                <div className="h-12 w-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`w-full ${qualityBarColor(a.overallQuality)}`}
                    style={{ height: `${a.overallQuality * 10}%`, marginTop: 'auto' }}
                  />
                </div>
              </div>
            </div>

            {/* Domain heatmap */}
            <div className="mt-4 grid grid-cols-5 gap-2">
              {DOMAINS.map(({ key, label }) => {
                const judgement = a.biasDomains[key]
                return (
                  <div
                    key={key}
                    className={`rounded border px-2 py-2 text-center text-xs ${BIAS_STYLES[judgement]}`}
                    title={a.biasReasoning[key]}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="mt-1 font-semibold">{BIAS_LABEL[judgement]}</div>
                  </div>
                )
              })}
            </div>

            {/* Reasoning */}
            <p className="mt-3 text-sm text-slate-700">{a.assessmentReasoning}</p>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              {a.userDecision === 'approved' ? (
                <span className="text-sm text-green-700">✓ Approved</span>
              ) : a.userDecision === 'overridden' ? (
                <span className="text-sm text-amber-700">
                  ⚑ Overridden — {a.userOverrideReasoning}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => onApprove?.(a.paperId)}
                    className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setOverrideTarget(a)}
                    className="rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Override
                  </button>
                </>
              )}
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No assessments match the current filters.
          </div>
        )}
      </div>

      {/* Override modal */}
      {overrideTarget && (
        <OverrideModal
          assessment={overrideTarget}
          onCancel={() => setOverrideTarget(null)}
          onSave={(overrides, reasoning) => {
            onOverride?.(overrideTarget.paperId, overrides, reasoning)
            setOverrideTarget(null)
          }}
        />
      )}
    </div>
  )
}

// ── Override modal ────────────────────────────────────────

interface OverrideModalProps {
  assessment: QualityAssessment
  onCancel: () => void
  onSave: (overrides: Partial<QualityAssessment['biasDomains']>, reasoning: string) => void
}

function OverrideModal({ assessment, onCancel, onSave }: OverrideModalProps) {
  const [domains, setDomains] = useState({ ...assessment.biasDomains })
  const [reasoning, setReasoning] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Override assessment</h3>
        <p className="mt-1 text-xs text-slate-500">{assessment.paperTitle ?? assessment.paperId}</p>

        <div className="mt-4 space-y-2">
          {DOMAINS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <select
                value={domains[key]}
                onChange={(e) =>
                  setDomains({ ...domains, [key]: e.target.value as BiasJudgement })
                }
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="low">Low</option>
                <option value="some_concern">Some concern</option>
                <option value="high">High</option>
              </select>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Reasoning (required)</span>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Why are you overriding the AI assessment?"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(domains, reasoning)}
            disabled={!reasoning.trim()}
            className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save override
          </button>
        </div>
      </div>
    </div>
  )
}
