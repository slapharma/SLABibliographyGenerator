import { useState, useEffect } from 'react'
import type { SavedSearch } from '../types'
import { listSavedSearches, deleteSavedSearch } from '../lib/api'
import SavedSearchCard from '../components/SavedSearchCard'

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSavedSearches()
      .then(setSearches)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number) => {
    await deleteSavedSearch(id)
    setSearches(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: 26, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>Saved Searches</div>
        <div style={{ fontSize: 14, color: '#7a8aaa' }}>Reusable search templates — click Load &amp; Run to pre-fill the search form</div>
      </div>

      {error && <div style={{ color: '#c0392b', padding: '12px 16px', background: '#fff5f5', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>⚠ {error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9aa5bf' }}>Loading...</div>
      ) : searches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5bf', fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          No saved searches yet. Use the &ldquo;Save Search&rdquo; button on the Search page.
        </div>
      ) : (
        searches.map(s => (
          <SavedSearchCard key={s.id} search={s} onDelete={handleDelete} />
        ))
      )}
    </div>
  )
}
