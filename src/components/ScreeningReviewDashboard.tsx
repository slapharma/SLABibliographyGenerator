import { useState, useMemo } from 'react'

export interface ScreeningDecision {
  paperId: string
  title: string
  authors: string[]
  year?: number
  journal?: string
  aiDecision: 'relevant' | 'irrelevant'
  aiReasoning: string
  confidence: number
  userDecision?: 'approved' | 'rejected' | 'override'
  userNote?: string
  abstract?: string
  doi?: string
}

interface Props {
  decisions: ScreeningDecision[]
  onSaveDecisions: (decisions: ScreeningDecision[]) => void
  isLoading?: boolean
}

type SortOption = 'confidence-asc' | 'confidence-desc' | 'title' | 'year'
type FilterOption = 'all' | 'relevant' | 'irrelevant' | 'low-confidence'

export default function ScreeningReviewDashboard({ decisions, onSaveDecisions, isLoading = false }: Props) {
  const [localDecisions, setLocalDecisions] = useState<ScreeningDecision[]>(decisions)
  const [sortBy, setSortBy] = useState<SortOption>('confidence-asc')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null)

  const filteredAndSorted = useMemo(() => {
    let filtered = localDecisions

    if (filterBy === 'relevant') {
      filtered = filtered.filter((d) => d.aiDecision === 'relevant')
    } else if (filterBy === 'irrelevant') {
      filtered = filtered.filter((d) => d.aiDecision === 'irrelevant')
    } else if (filterBy === 'low-confidence') {
      filtered = filtered.filter((d) => d.confidence < 0.6)
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'confidence-asc') return a.confidence - b.confidence
      if (sortBy === 'confidence-desc') return b.confidence - a.confidence
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'year') return (b.year ?? 0) - (a.year ?? 0)
      return 0
    })
  }, [localDecisions, sortBy, filterBy])

  const stats = useMemo(() => {
    const total = localDecisions.length
    const relevant = localDecisions.filter((d) => d.aiDecision === 'relevant').length
    const irrelevant = localDecisions.filter((d) => d.aiDecision === 'irrelevant').length
    const lowConfidence = localDecisions.filter((d) => d.confidence < 0.6).length
    return { total, relevant, irrelevant, lowConfidence }
  }, [localDecisions])

  const handleToggleOverride = (paperId: string, _currentDecision: string) => {
    setLocalDecisions((prev) =>
      prev.map((d) =>
        d.paperId === paperId
          ? {
              ...d,
              userDecision:
                d.userDecision === 'override'
                  ? undefined
                  : ('override' as const),
            }
          : d
      )
    )
  }

  const handleApprove = (paperId: string) => {
    setLocalDecisions((prev) =>
      prev.map((d) =>
        d.paperId === paperId ? { ...d, userDecision: 'approved' } : d
      )
    )
  }

  const handleReject = (paperId: string) => {
    setLocalDecisions((prev) =>
      prev.map((d) =>
        d.paperId === paperId ? { ...d, userDecision: 'rejected' } : d
      )
    )
  }

  const handleNoteChange = (paperId: string, note: string) => {
    setLocalDecisions((prev) =>
      prev.map((d) =>
        d.paperId === paperId ? { ...d, userNote: note } : d
      )
    )
  }

  const handleSave = () => {
    onSaveDecisions(localDecisions)
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#059669' // green
    if (confidence >= 0.6) return '#f59e0b' // amber
    return '#dc2626' // red
  }

  return (
    <div className="screening-dashboard">
      <div className="dashboard-header">
        <h2>Screening Review Dashboard</h2>
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat relevant">
            <span className="stat-label">Relevant</span>
            <span className="stat-value">{stats.relevant}</span>
          </div>
          <div className="stat irrelevant">
            <span className="stat-label">Irrelevant</span>
            <span className="stat-value">{stats.irrelevant}</span>
          </div>
          <div className="stat low-confidence">
            <span className="stat-label">Needs Review</span>
            <span className="stat-value">{stats.lowConfidence}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="control-group">
          <label htmlFor="filter">Filter:</label>
          <select
            id="filter"
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
          >
            <option value="all">All Papers</option>
            <option value="relevant">AI Classified as Relevant</option>
            <option value="irrelevant">AI Classified as Irrelevant</option>
            <option value="low-confidence">Low Confidence (&lt;0.6)</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="sort">Sort by:</label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="confidence-asc">Confidence (Lowest First)</option>
            <option value="confidence-desc">Confidence (Highest First)</option>
            <option value="title">Title (A-Z)</option>
            <option value="year">Year (Newest First)</option>
          </select>
        </div>
      </div>

      <div className="papers-list">
        {filteredAndSorted.map((decision) => (
          <div key={decision.paperId} className="paper-card">
            <div
              className="paper-header"
              onClick={() =>
                setExpandedPaperId(
                  expandedPaperId === decision.paperId ? null : decision.paperId
                )
              }
            >
              <div className="paper-title-section">
                <h3>{decision.title}</h3>
                <p className="paper-meta">
                  {decision.authors?.slice(0, 2).join(', ')}
                  {decision.authors && decision.authors.length > 2 ? ' et al.' : ''}
                  {decision.year && ` (${decision.year})`}
                </p>
              </div>

              <div className="paper-decision">
                <div
                  className="confidence-badge"
                  style={{ backgroundColor: getConfidenceColor(decision.confidence) }}
                >
                  <span className="confidence-value">
                    {(decision.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="confidence-label">confidence</span>
                </div>

                <div className="ai-decision">
                  <span className={`decision-badge ${decision.aiDecision}`}>
                    {decision.aiDecision.charAt(0).toUpperCase() +
                      decision.aiDecision.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {expandedPaperId === decision.paperId && (
              <div className="paper-details">
                <div className="ai-reasoning">
                  <h4>AI Reasoning</h4>
                  <p>{decision.aiReasoning}</p>
                </div>

                {decision.abstract && (
                  <div className="abstract-section">
                    <h4>Abstract</h4>
                    <p>{decision.abstract}</p>
                  </div>
                )}

                <div className="metadata-section">
                  {decision.journal && (
                    <p>
                      <strong>Journal:</strong> {decision.journal}
                    </p>
                  )}
                  {decision.doi && (
                    <p>
                      <strong>DOI:</strong>{' '}
                      <a
                        href={`https://doi.org/${decision.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {decision.doi}
                      </a>
                    </p>
                  )}
                </div>

                <div className="review-section">
                  <h4>Your Decision</h4>
                  <div className="decision-buttons">
                    <button
                      className={`btn-decision ${
                        decision.userDecision === 'approved' ? 'active' : ''
                      }`}
                      onClick={() => handleApprove(decision.paperId)}
                      disabled={isLoading}
                    >
                      ✓ Include
                    </button>
                    <button
                      className={`btn-decision ${
                        decision.userDecision === 'rejected' ? 'active' : ''
                      }`}
                      onClick={() => handleReject(decision.paperId)}
                      disabled={isLoading}
                    >
                      ✕ Exclude
                    </button>
                    {decision.userDecision !== undefined && (
                      <button
                        className={`btn-override ${
                          decision.userDecision === 'override' ? 'active' : ''
                        }`}
                        onClick={() =>
                          handleToggleOverride(
                            decision.paperId,
                            decision.aiDecision
                          )
                        }
                        disabled={isLoading}
                      >
                        🔄 Override AI
                      </button>
                    )}
                  </div>

                  <textarea
                    className="note-input"
                    placeholder="Add a note about your decision (optional)"
                    value={decision.userNote ?? ''}
                    onChange={(e) =>
                      handleNoteChange(decision.paperId, e.target.value)
                    }
                    disabled={isLoading}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-footer">
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Decisions'}
        </button>
      </div>

      <style>{`
        .screening-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
        }

        .dashboard-header h2 {
          margin: 0;
          font-size: 2rem;
        }

        .stats {
          display: flex;
          gap: 1rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background-color: #f3f4f6;
          border-radius: 0.5rem;
          min-width: 100px;
        }

        .stat.relevant {
          background-color: #dcfce7;
        }

        .stat.irrelevant {
          background-color: #fee2e2;
        }

        .stat.low-confidence {
          background-color: #fef3c7;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .stat-value {
          font-size: 1.875rem;
          font-weight: bold;
        }

        .dashboard-controls {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 0.5rem;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .control-group label {
          font-weight: 500;
        }

        .control-group select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 1rem;
        }

        .papers-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .paper-card {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .paper-header {
          padding: 1rem;
          background-color: #f9fafb;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          transition: background-color 0.2s;
        }

        .paper-header:hover {
          background-color: #f3f4f6;
        }

        .paper-title-section {
          flex: 1;
        }

        .paper-title-section h3 {
          margin: 0;
          font-size: 1.125rem;
          line-height: 1.4;
        }

        .paper-meta {
          margin: 0.5rem 0 0 0;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .paper-decision {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .confidence-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          color: white;
          font-weight: 600;
        }

        .confidence-value {
          font-size: 1.25rem;
        }

        .confidence-label {
          font-size: 0.75rem;
        }

        .ai-decision {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .decision-badge {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 600;
          text-align: center;
          min-width: 100px;
        }

        .decision-badge.relevant {
          background-color: #dcfce7;
          color: #166534;
        }

        .decision-badge.irrelevant {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .paper-details {
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .ai-reasoning h4,
        .abstract-section h4,
        .metadata-section h4,
        .review-section h4 {
          margin: 0 0 0.5rem 0;
          font-weight: 600;
        }

        .ai-reasoning p,
        .abstract-section p {
          margin: 0;
          line-height: 1.6;
          color: #374151;
        }

        .abstract-section p {
          max-height: 200px;
          overflow-y: auto;
        }

        .metadata-section p {
          margin: 0.5rem 0;
          font-size: 0.875rem;
        }

        .metadata-section a {
          color: #3b82f6;
        }

        .decision-buttons {
          display: flex;
          gap: 0.75rem;
        }

        .btn-decision,
        .btn-override {
          padding: 0.75rem 1.5rem;
          border: 2px solid #d1d5db;
          background-color: white;
          border-radius: 0.375rem;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-decision:hover {
          border-color: #3b82f6;
        }

        .btn-decision.active {
          background-color: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }

        .btn-override {
          background-color: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
        }

        .btn-override.active {
          background-color: #fcd34d;
          border-color: #d97706;
        }

        .note-input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-family: inherit;
          font-size: 0.875rem;
          resize: vertical;
        }

        .dashboard-footer {
          display: flex;
          justify-content: center;
          padding: 2rem 0;
          border-top: 1px solid #e5e7eb;
        }

        .btn-save {
          padding: 1rem 3rem;
          background-color: #059669;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-save:hover:not(:disabled) {
          background-color: #047857;
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
