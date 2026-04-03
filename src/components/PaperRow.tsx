import { useState } from 'react'
import type { BibliographyPaperRow, CitationStyle } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'
import { formatCitation } from '../lib/citations'
import { updateBibliographyNote } from '../lib/api'
import type { Paper } from '../types'

interface Props {
  row: BibliographyPaperRow
  onRemove: (rowId: number) => void
  citationStyle: CitationStyle
  onViewSource: (paper: Paper) => void
}

const BIB_TYPE_LABELS: Record<string, string> = {
  'clinical': 'Clinical Papers',
  'guidelines': 'Consensus Guidelines',
  'health-economics': 'Health Economics',
  'prevalence': 'Indication Prevalence',
}

export default function PaperRow({ row, onRemove, citationStyle, onViewSource }: Props) {
  const p = row.paper
  const color = SOURCE_COLORS[p.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }

  const [abstractOpen, setAbstractOpen] = useState(false)
  const [noteText, setNoteText] = useState(row.note ?? '')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState('')

  const saveNote = async () => {
    setNoteSaving(true)
    setNoteError('')
    try {
      await updateBibliographyNote(row.rowId, noteText)
      setNoteEditing(false)
    } catch {
      setNoteError('Failed to save note — try again')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) saveNote()
  }

  const [copied, setCopied] = useState(false)
  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(formatCitation(p, citationStyle))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  const addedDate = row.addedAt
    ? new Date(row.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const sp = row.searchParams

  return (
    <div style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(26,42,74,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{p.title}</div>

          <div style={{ fontSize: 13, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {(p.authors ?? []).slice(0, 3).join(', ')}{(p.authors ?? []).length > 3 ? ' et al.' : ''}
            {p.journal && ` · ${p.journal}`}
            {p.year && ` · ${p.year}`}
            {addedDate && <span style={{ color: '#b0bccc' }}>· Added {addedDate}</span>}
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color.bg, color: color.text }}>
              {SOURCE_LABELS[p.source] ?? p.source}
            </span>
          </div>

          {/* Search criteria chips */}
          {sp && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9aa5bf', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search:</span>
              {sp.bibliographyType && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#eef3ff', color: '#1a3a6b', fontWeight: 600 }}>
                  {BIB_TYPE_LABELS[sp.bibliographyType] ?? sp.bibliographyType}
                </span>
              )}
              {sp.indication && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f0f2f7', color: '#5a6a8a' }}>{sp.indication}</span>
              )}
              {sp.keywords && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f0f2f7', color: '#5a6a8a' }}>{sp.keywords}</span>
              )}
              {sp.author && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f0f2f7', color: '#5a6a8a' }}>by {sp.author}</span>
              )}
              {sp.country && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#f0f2f7', color: '#5a6a8a' }}>{sp.country}</span>
              )}
            </div>
          )}

          {p.abstract && (
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => setAbstractOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 500 }}>
                {abstractOpen ? 'Hide abstract ▲' : 'Show abstract ▼'}
              </button>
              {abstractOpen && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#f7f9fc', borderRadius: 8, fontSize: 13, color: '#5a6a8a', lineHeight: 1.7 }}>
                  {p.abstract}
                </div>
              )}
            </div>
          )}

          {noteText && !noteEditing && (
            <div style={{ fontSize: 12, color: '#9aa5bf', fontStyle: 'italic', marginBottom: 6 }}>📝 {noteText}</div>
          )}
          {noteEditing && (
            <div style={{ marginBottom: 8 }}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} onBlur={() => { if (!noteSaving) saveNote() }} onKeyDown={handleNoteKeyDown} rows={4} maxLength={2000} placeholder="Add a note about this paper..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} autoFocus />
              {noteSaving && <div style={{ fontSize: 12, color: '#9aa5bf' }}>Saving…</div>}
              {noteError && <div style={{ fontSize: 12, color: '#c0392b' }}>{noteError}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
            <button onClick={() => onViewSource(p)} style={{ background: 'none', border: '1px solid #c8d4e8', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#3a5a9a', cursor: 'pointer', fontWeight: 500 }}>
              View Source ↗
            </button>
            {p.doi && (
              <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1a3a6b', fontSize: 12, textDecoration: 'none', border: '1px solid #c8d4e8', borderRadius: 5, padding: '3px 10px' }}>
                DOI ↗
              </a>
            )}
            <button onClick={() => setNoteEditing(e => !e)} disabled={noteSaving} style={{ background: 'none', border: '1px solid #dde3ef', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#7a8aaa', cursor: 'pointer' }}>
              {noteSaving ? 'Saving…' : noteText ? '✏️ Edit note' : '✏️ Add note'}
            </button>
            <button onClick={copyCitation} style={{ background: 'none', border: '1px solid #dde3ef', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: copied ? '#22c55e' : '#7a8aaa', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy citation'}
            </button>
          </div>
        </div>

        <button onClick={() => onRemove(row.rowId)} style={{ background: '#fff5f5', border: '1.5px solid #fcc', color: '#c0392b', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
          Remove
        </button>
      </div>
    </div>
  )
}
