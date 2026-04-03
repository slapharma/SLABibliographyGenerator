// src/components/SourcePanel.tsx
import { useEffect } from 'react'
import type { Paper } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

interface Props {
  paper: Paper | null
  onClose: () => void
}

export default function SourcePanel({ paper, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!paper) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [paper, onClose])

  if (!paper) return null

  const allSources = paper.sources ?? [paper.source]

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 900,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
        background: '#fff', zIndex: 901, boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paper Detail</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9aa5bf', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1 }}>
          {/* Open in new tab — guard against empty URL (Google Scholar can return '') */}
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center', padding: '10px 16px', marginBottom: 20,
                background: '#1a3a6b', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Open in Source ↗
            </a>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 16px', marginBottom: 20, background: '#f7f9fc', borderRadius: 8, fontSize: 14, color: '#9aa5bf' }}>
              No direct link available
            </div>
          )}

          {/* Title */}
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2035', lineHeight: 1.5, marginBottom: 10 }}>
            {paper.title}
          </div>

          {/* Authors */}
          {paper.authors?.length > 0 && (
            <div style={{ fontSize: 13, color: '#5a6a8a', marginBottom: 8 }}>
              {paper.authors.join(', ')}
            </div>
          )}

          {/* Metadata row */}
          <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {paper.journal && <span>{paper.journal}</span>}
            {paper.year && <span>· {paper.year}</span>}
            {paper.doi && (
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                style={{ color: '#1a3a6b', textDecoration: 'none', fontSize: 12 }}>
                DOI: {paper.doi} ↗
              </a>
            )}
          </div>

          {/* Source badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {allSources.map(src => {
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
              <span style={{ fontSize: 12, color: '#9aa5bf' }}>📊 {paper.citationCount} citations</span>
            )}
          </div>

          {/* Abstract */}
          {paper.abstract ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9aa5bf', marginBottom: 8 }}>Abstract</div>
              <div style={{ fontSize: 13, color: '#4a5a7a', lineHeight: 1.8, background: '#f7f9fc', borderRadius: 8, padding: '12px 14px' }}>
                {paper.abstract}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#9aa5bf', fontStyle: 'italic' }}>No abstract available for this paper.</div>
          )}
        </div>
      </div>
    </>
  )
}
