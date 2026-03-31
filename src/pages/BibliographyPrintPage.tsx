// src/pages/BibliographyPrintPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { BibliographyWithPapers, CitationStyle } from '../types'
import { getBibliography } from '../lib/api'
import { formatCitation } from '../lib/citations'

export default function BibliographyPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const citationStyle: CitationStyle =
    (localStorage.getItem('sla-citation-style') as CitationStyle | null) ?? 'vancouver'

  useEffect(() => {
    if (!id) return
    getBibliography(Number(id))
      .then(setBib)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9aa5bf' }}>Loading…</div>
  if (error || !bib) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: '#c0392b' }}>Unable to load bibliography.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: '1.5px solid #dde3ef', cursor: 'pointer' }}>Retry</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: 'Georgia, serif' }}>
      {/* Print controls — hidden on print */}
      <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <button onClick={() => navigate(`/bibliographies/${id}`)} style={{ padding: '7px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          ← Back
        </button>
        <button onClick={() => window.print()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: '#1a3a6b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #1a2a4a', paddingBottom: 16, marginBottom: 24 }}>
        <img src="/sla-logo.png" alt="SLA Pharma" style={{ height: 48, marginBottom: 12, display: 'block' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2035', margin: 0 }}>{bib.name}</h1>
        {bib.creatorName && <p style={{ margin: '4px 0 0', color: '#7a8aaa', fontSize: 13 }}>Created by {bib.creatorName}</p>}
        {bib.description && <p style={{ margin: '6px 0 0', color: '#5a6a8a', fontSize: 13 }}>{bib.description}</p>}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9aa5bf' }}>
          Exported {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{bib.papers.length} reference{bib.papers.length !== 1 ? 's' : ''}
          {' · '}{citationStyle.toUpperCase()}
        </p>
        {/* Tag chips */}
        {bib.tags && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {bib.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#f0f4ff', color: '#1a3a6b' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Reference list — force page break after every 30 items */}
      <ol style={{ paddingLeft: 24, margin: 0 }}>
        {bib.papers.map((row, i) => (
          <li
            key={row.rowId}
            style={{
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.7,
              color: '#1a2035',
              breakInside: 'avoid',
              // Insert a forced page break before every 31st item (after every 30)
              ...((i > 0 && i % 30 === 0) ? { breakBefore: 'page' } : {}),
            }}
          >
            {formatCitation(row.paper, citationStyle)}
          </li>
        ))}
      </ol>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          li { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
