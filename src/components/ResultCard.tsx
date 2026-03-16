import { useState } from 'react'
import type { Paper, Bibliography } from '../types'

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  pubmed:          { bg: '#e8f0fe', text: '#1a56c8' },
  europepmc:       { bg: '#e6f4ff', text: '#0a5fa0' },
  clinicaltrials:  { bg: '#e6f9f0', text: '#177a4a' },
  semanticscholar: { bg: '#fff0e6', text: '#a05a00' },
  crossref:        { bg: '#f0f7ee', text: '#2a6a1a' },
  openalex:        { bg: '#f5f0ff', text: '#5a2aa0' },
  lens:            { bg: '#fff5f0', text: '#b03a00' },
  scholar:         { bg: '#f3eefe', text: '#6b35c8' },
}

const SOURCE_LABELS: Record<string, string> = {
  pubmed: 'PubMed', europepmc: 'Europe PMC', clinicaltrials: 'ClinicalTrials',
  semanticscholar: 'Semantic Scholar', crossref: 'CrossRef',
  openalex: 'OpenAlex', lens: 'Lens.org', scholar: 'Google Scholar',
}

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

  const color = SOURCE_COLORS[paper.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }

  const handleAdd = async () => {
    if (!selectedBibId) return
    setAdding(true)
    await onAddToBibliography(Number(selectedBibId), paper)
    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
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
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: color.bg, color: color.text }}>
          {SOURCE_LABELS[paper.source] ?? paper.source}
        </span>
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
