import { useState, useEffect } from 'react'
import type { HistoryEntry } from '../types'
import { listHistory, deleteHistoryEntry, clearHistory } from '../lib/api'
import HistoryRow from '../components/HistoryRow'

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listHistory()
      .then(setEntries)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number) => {
    await deleteHistoryEntry(id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const handleClearAll = async () => {
    if (!confirm('Clear all search history?')) return
    await clearHistory()
    setEntries([])
  }

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>Search History</div>
          <div style={{ fontSize: 14, color: '#7a8aaa' }}>Every search is automatically logged</div>
        </div>
        {entries.length > 0 && (
          <button onClick={handleClearAll} style={{ padding: '10px 18px', border: '1.5px solid #fcc', borderRadius: 8, background: '#fff5f5', color: '#c0392b', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Clear All History
          </button>
        )}
      </div>

      {error && <div style={{ color: '#c0392b', padding: '12px 16px', background: '#fff5f5', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>⚠ {error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9aa5bf' }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5bf', fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕐</div>
          No search history yet.
        </div>
      ) : (
        entries.map(e => (
          <HistoryRow key={e.id} entry={e} onDelete={handleDelete} />
        ))
      )}
    </div>
  )
}
