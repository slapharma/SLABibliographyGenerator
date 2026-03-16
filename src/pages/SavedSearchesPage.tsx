import { useState, useEffect } from 'react'
import type { SavedSearch } from '../types'
import { listSavedSearches, deleteSavedSearch } from '../lib/api'
import SavedSearchCard from '../components/SavedSearchCard'

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSavedSearches()
      .then(setSearches)
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number) => {
    await deleteSavedSearch(id)
    setSearches(s => s.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>Saved Searches</div>
        <div style={{ fontSize: 14, color: '#7a8aaa' }}>Reusable search templates — click Load &amp; Run to pre-fill the search form</div>
      </div>

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
