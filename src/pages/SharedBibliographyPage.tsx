// src/pages/SharedBibliographyPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { BibliographyWithPapers } from '../types'
import { getSharedBibliography } from '../lib/api'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

export default function SharedBibliographyPage() {
  const { token } = useParams<{ token: string }>()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'not-found' | 'network' | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    getSharedBibliography(token)
      .then(setBib)
      .catch(e => {
        if (e.message?.includes('404')) setError('not-found')
        else setError('network')
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(load, [load])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ color: '#9aa5bf', fontSize: 15 }}>Loading bibliography…</div>
    </div>
  )

  if (error === 'not-found') return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, color: '#1a2035', marginBottom: 8 }}>Bibliography Not Available</h2>
        <p style={{ color: '#7a8aaa', fontSize: 14 }}>This bibliography is not available. The link may have been deactivated.</p>
      </div>
    </div>
  )

  if (error === 'network' || !bib) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#c0392b', fontSize: 14 }}>Unable to load — please try again.</p>
        <button onClick={load} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: '1.5px solid #dde3ef', cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1.5px solid #dde3ef' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2035', margin: 0 }}>{bib.name}</h1>
          <div style={{ fontSize: 13, color: '#7a8aaa', marginTop: 4 }}>
            {bib.creatorName && `By ${bib.creatorName} · `}
            {bib.papers.length} paper{bib.papers.length !== 1 ? 's' : ''}
            {' · '}Shared bibliography (read-only)
          </div>
          {bib.description && (
            <div style={{ fontSize: 13, color: '#5a6a8a', marginTop: 6 }}>{bib.description}</div>
          )}
        </div>
      </div>

      {/* Papers */}
      {bib.papers.map(row => {
        const p = row.paper
        const color = SOURCE_COLORS[p.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
        return (
          <div key={row.rowId} style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(26,42,74,0.04)' }}>
            <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{p.title}</div>
            <div style={{ fontSize: 13, color: '#7a8aaa', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {(p.authors ?? []).slice(0, 3).join(', ')}{(p.authors ?? []).length > 3 ? ' et al.' : ''}
              {p.journal && ` · ${p.journal}`}
              {p.year && ` · ${p.year}`}
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color.bg, color: color.text }}>
                {SOURCE_LABELS[p.source] ?? p.source}
              </span>
              {p.doi && (
                <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1a3a6b', fontSize: 12, textDecoration: 'none' }}>
                  DOI ↗
                </a>
              )}
            </div>
            {p.abstract && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 12, color: '#1a3a6b', cursor: 'pointer', fontWeight: 500 }}>Show abstract</summary>
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#f7f9fc', borderRadius: 8, fontSize: 13, color: '#5a6a8a', lineHeight: 1.7 }}>
                  {p.abstract}
                </div>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
