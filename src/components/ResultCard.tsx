import { useState } from 'react'
import type { Paper, Bibliography } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

interface Props {
  paper: Paper
  bibliographies: Bibliography[]
  onAddToBibliography: (bibliographyId: number, paper: Paper) => Promise<void>
}

export default function ResultCard({ paper, bibliographies, onAddToBibliography }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedBibId, setSelectedBibId] = useState<number | ''>('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const handleAdd = async () => {
    if (!selectedBibId) return
    setAdding(true)
    try {
      await onAddToBibliography(Number(selectedBibId), paper)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch {
      // Adding failed — button resets to ready state
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '20px',
      marginBottom: 12, boxShadow: '0 1px 4px rgba(26,42,74,0.05)',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
        {paper.title}
      </div>
      <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 8 }}>
        {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
        {paper.journal && ` · ${paper.journal}`}
        {paper.year && ` · ${paper.year}`}
        {paper.doi && ` · DOI: ${paper.doi}`}
      </div>

      {paper.abstract && (
        <div style={{ fontSize: 13, color: '#5a6a8a', lineHeight: 1.7, marginBottom: 10 }}>
          {expanded ? paper.abstract : `${paper.abstract.slice(0, 200)}...`}
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 7, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Source badges — one per source this paper was found in */}
        {(paper.sources ?? [paper.source]).map(src => {
          const c = SOURCE_COLORS[src] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
          return (
            <span key={src} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>
              {SOURCE_LABELS[src] ?? src}
            </span>
          )
        })}
        {paper.type && (
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#f0f2f7', color: '#5a6a8a' }}>
            {paper.type}
          </span>
        )}
        {paper.citationCount !== undefined && (
          <span style={{ fontSize: 12, color: '#9aa5bf' }}>
            📊 {paper.citationCount} citations
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{
          padding: '6px 12px', borderRadius: 6, fontSize: 13, border: '1.5px solid #c8d4e8',
          background: '#fff', color: '#3a5a9a', fontWeight: 500, textDecoration: 'none',
        }}>
          View Source ↗
        </a>
        {bibliographies.length > 0 && (
          <>
            <select
              value={selectedBibId}
              onChange={e => setSelectedBibId(e.target.value ? Number(e.target.value) : '')}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', background: '#f7f9fc' }}
            >
              <option value="">Add to bibliography...</option>
              {bibliographies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedBibId || adding}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: 'pointer',
                background: added ? '#22c55e' : '#c8a84b', color: '#fff', fontWeight: 600,
                opacity: !selectedBibId ? 0.5 : 1, transition: 'background 0.2s',
              }}
            >
              {added ? '✓ Added!' : adding ? '...' : '+ Add'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
