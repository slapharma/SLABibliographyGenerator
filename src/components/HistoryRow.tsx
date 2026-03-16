import type { HistoryEntry } from '../types'
import { useNavigate } from 'react-router-dom'

interface Props {
  entry: HistoryEntry
  onDelete: (id: number) => void
}

export default function HistoryRow({ entry, onDelete }: Props) {
  const navigate = useNavigate()

  const querySummary = [
    entry.params.indication,
    entry.params.keywords,
    entry.params.paperType,
    `${entry.params.dateFrom} – ${entry.params.dateTo}`,
  ].filter(Boolean).join(' · ')

  const formatDate = (str: string) => {
    try {
      return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch { return str }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '16px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(26,42,74,0.04)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 3 }}>{querySummary}</div>
        <div style={{ fontSize: 13, color: '#9aa5bf' }}>{formatDate(entry.searchedAt)} · {entry.params.sources.length} sources</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#5a6a8a', fontWeight: 600, background: '#f0f2f7', padding: '4px 12px', borderRadius: 20 }}>
          {entry.resultCount} results
        </span>
        <button
          onClick={() => navigate('/search', { state: { params: entry.params } })}
          style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          ↻ Re-run
        </button>
        <button onClick={() => onDelete(entry.id)} style={{ padding: '7px 12px', border: '1.5px solid #fcc', borderRadius: 6, background: '#fff5f5', color: '#c0392b', fontSize: 13, cursor: 'pointer' }}>
          ✕
        </button>
      </div>
    </div>
  )
}
