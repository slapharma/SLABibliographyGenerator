import type { SavedSearch } from '../types'
import { useNavigate } from 'react-router-dom'

interface Props {
  search: SavedSearch
  onDelete: (id: number) => void
}

export default function SavedSearchCard({ search, onDelete }: Props) {
  const navigate = useNavigate()

  const handleLoadAndRun = () => {
    // Pass params via URL state — SearchPage reads from location.state
    navigate('/search', { state: { params: search.params } })
  }

  const paramSummary = [
    search.params.indication && `Indication: ${search.params.indication}`,
    search.params.keywords && `Keywords: ${search.params.keywords}`,
    search.params.paperType && `Type: ${search.params.paperType}`,
    `${search.params.dateFrom} – ${search.params.dateTo}`,
    `${search.params.sources.length} sources`,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 22px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(26,42,74,0.04)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 4 }}>{search.name}</div>
        <div style={{ fontSize: 13, color: '#7a8aaa' }}>{paramSummary}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={handleLoadAndRun} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#c8a84b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ▶ Load &amp; Run
        </button>
        <button onClick={() => onDelete(search.id)} style={{ padding: '7px 12px', border: '1.5px solid #fcc', borderRadius: 6, background: '#fff5f5', color: '#c0392b', fontSize: 13, cursor: 'pointer' }}>
          Delete
        </button>
      </div>
    </div>
  )
}
