// src/pages/QualityReviewPage.tsx
//
// Phase 2 UI shell. Drives the extract → assessQuality → review flow for
// a given protocol + paper set, then hands the results to
// QualityAssessmentDashboard. Self-contained: nothing in the existing
// bibliography pages is touched.
//
// Route: /quality/:protocolId   (papers come from location.state)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import QualityAssessmentDashboard, {
  type QualityAssessment,
  type BiasJudgement,
} from '../components/QualityAssessmentDashboard'

interface PaperInput {
  id: string
  title: string
  doi?: string
}

interface LocationState {
  papers?: PaperInput[]
}

interface ExtractResponse {
  success: boolean
  executionId: number
  processedCount: number
  skippedCount: number
  failedCount: number
}

interface AssessResponseResult {
  paperId: string
  biasDomains: QualityAssessment['biasDomains']
  biasReasoning: QualityAssessment['biasReasoning']
  overallQuality: number
  assessmentReasoning: string
}

interface AssessResponse {
  success: boolean
  executionId: number
  assessedCount: number
  results: AssessResponseResult[]
}

type Stage = 'idle' | 'extracting' | 'assessing' | 'ready' | 'error'

export default function QualityReviewPage() {
  const { protocolId } = useParams<{ protocolId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const papers = (location.state as LocationState | null)?.papers ?? []

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [executionId, setExecutionId] = useState<number | null>(null)
  const [assessments, setAssessments] = useState<QualityAssessment[]>([])

  const titleById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of papers) m[p.id] = p.title
    return m
  }, [papers])

  const runPipeline = useCallback(async () => {
    if (!protocolId || papers.length === 0) {
      setStage('error')
      setError('No protocol or papers supplied.')
      return
    }
    setStage('extracting')
    setError(null)
    try {
      // 1. Extract
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolId: Number(protocolId), papers }),
      })
      if (!extractRes.ok) throw new Error(`extract failed (${extractRes.status})`)
      const extractData: ExtractResponse = await extractRes.json()
      setExecutionId(extractData.executionId)

      // 2. Assess quality
      setStage('assessing')
      const assessRes = await fetch('/api/assessQuality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: extractData.executionId,
          paperTitles: titleById,
        }),
      })
      if (!assessRes.ok) throw new Error(`assessQuality failed (${assessRes.status})`)
      const assessData: AssessResponse = await assessRes.json()

      // 3. Shape into dashboard input
      const shaped: QualityAssessment[] = assessData.results.map((r) => ({
        paperId: r.paperId,
        paperTitle: titleById[r.paperId],
        biasDomains: r.biasDomains,
        biasReasoning: r.biasReasoning,
        overallQuality: r.overallQuality,
        assessmentReasoning: r.assessmentReasoning,
        userDecision: null,
      }))
      setAssessments(shaped)
      setStage('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage('error')
    }
  }, [protocolId, papers, titleById])

  useEffect(() => {
    if (stage === 'idle' && papers.length > 0) {
      void runPipeline()
    }
  }, [stage, papers.length, runPipeline])

  const postDecision = async (
    paperId: string,
    decision: 'approved' | 'overridden',
    overrides?: Partial<Record<keyof QualityAssessment['biasDomains'], BiasJudgement>>,
    reasoning?: string
  ) => {
    if (!executionId) return
    try {
      const res = await fetch('/api/qualityDecisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId, paperId, decision, overrides, reasoning }),
      })
      if (!res.ok) throw new Error(`decision failed (${res.status})`)
      // Optimistic local update
      setAssessments((prev) =>
        prev.map((a) =>
          a.paperId !== paperId
            ? a
            : {
                ...a,
                userDecision: decision,
                userOverrideReasoning: reasoning ?? null,
                biasDomains: overrides ? { ...a.biasDomains, ...overrides } : a.biasDomains,
              }
        )
      )
    } catch (e) {
      alert(`Failed to save decision: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleApprove = (paperId: string) => postDecision(paperId, 'approved')
  const handleOverride = (
    paperId: string,
    overrides: Partial<QualityAssessment['biasDomains']>,
    reasoning: string
  ) => postDecision(paperId, 'overridden', overrides, reasoning)

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: '#7a8aaa',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 18,
          padding: 0,
        }}
      >
        ← Back
      </button>

      {stage === 'extracting' && (
        <div style={{ padding: 32, textAlign: 'center', color: '#5a6a8a' }}>
          Retrieving papers and extracting fields… ({papers.length} paper{papers.length !== 1 ? 's' : ''})
        </div>
      )}
      {stage === 'assessing' && (
        <div style={{ padding: 32, textAlign: 'center', color: '#5a6a8a' }}>
          Running Cochrane RoB 2 assessment…
        </div>
      )}
      {stage === 'error' && (
        <div style={{ padding: 24, color: '#c0392b' }}>
          Error: {error}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                setStage('idle')
                setError(null)
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1.5px solid #dde3ef',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {stage === 'ready' && (
        <QualityAssessmentDashboard
          assessments={assessments}
          onApprove={handleApprove}
          onOverride={handleOverride}
        />
      )}
    </div>
  )
}
