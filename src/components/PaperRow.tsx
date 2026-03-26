import type { BibliographyPaperRow } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

interface Props {
  row: BibliographyPaperRow
  onRemove: (rowId: number) => void
}

export default function PaperRow({ row, onRemove }: Props) {
  const p = row.paper
  const color = SOURCE_COLORS[p.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, boxShadow: '0 1px 3px rgba(26,42,74,0.04)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{p.title}</div>
        <div style={{ fontSize: 13, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      </div>
      <button
        onClick={() => onRemove(row.rowId)}
        style={{ background: '#fff5f5', border: '1.5px solid #fcc', color: '#c0392b', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}
      >
        Remove
      </button>
    </div>
  )
}
