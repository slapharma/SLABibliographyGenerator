import { useState, useCallback, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { SearchParams, SearchResponse, Bibliography, SavedSearch } from '../types'
import { searchAll, listBibliographies, createSavedSearch, addPaperToBibliography, updateSavedSearchResultIds } from '../lib/api'
import SearchForm from '../components/SearchForm'
import ResultsList from '../components/ResultsList'
import type { Paper } from '../types'

export default function SearchPage() {
  const location = useLocation()
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bibliographies, setBibliographies] = useState<Bibliography[]>([])
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [pendingSaveParams, setPendingSaveParams] = useState<SearchParams | null>(null)

  const [searchParams] = useSearchParams()
  const [savedId, setSavedId] = useState<number | null>(null)
  const [lastResultIds, setLastResultIds] = useState<string[]>([])
  const [autoRunDone, setAutoRunDone] = useState(false)

  useEffect(() => {
    const id = parseInt(searchParams.get('savedId') ?? '0')
    if (!id || autoRunDone) return
    setAutoRunDone(true)
    setSavedId(id)
    fetch('/api/saved-searches')
      .then(r => r.json())
      .then((searches: SavedSearch[]) => {
        const found = searches.find(s => s.id === id)
        if (!found) return
        setLastResultIds(found.lastResultIds ?? [])
        handleSearch(found.params, id)
      })
      .catch(() => {}) // silently ignore — user can run manually
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadBibliographies = useCallback(async () => {
    try {
      const bibs = await listBibliographies()
      setBibliographies(bibs)
    } catch {
      // Non-blocking — bibliographies just won't show in dropdowns
    }
  }, [])

  const handleSearch = async (params?: SearchParams, runForSavedId?: number) => {
    setIsLoading(true)
    setError(null)
    try {
      await loadBibliographies()
      const response = await searchAll(params)
      setResults(response)
      // If this was a saved search re-run, update lastResultIds
      if (runForSavedId) {
        const allPapers = response.results.flatMap((r: any) => r.papers)
        const ids = allPapers.map((p: any) => p.doi ?? p.id)
        updateSavedSearchResultIds(runForSavedId, ids).catch(() => {})
        setLastResultIds(ids)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveRequest = (params: SearchParams) => {
    setPendingSaveParams(params)
    setSaveModalOpen(true)
  }

  const handleSaveConfirm = async () => {
    if (!saveName.trim() || !pendingSaveParams) return
    try {
      await createSavedSearch(saveName.trim(), pendingSaveParams)
      setSaveModalOpen(false)
      setSaveName('')
    } catch {
      // Silently ignore
    }
  }

  const handleAddToBibliography = async (bibliographyId: number, paper: Paper) => {
    await addPaperToBibliography(bibliographyId, paper)
  }

  const handleBibliographyCreated = useCallback(async () => {
    await loadBibliographies()
  }, [loadBibliographies])

  const cardStyle: React.CSSProperties = {
    fontFamily: 'Montserrat, system-ui, sans-serif',
  }

  return (
    <div className="page-content" style={{ maxWidth: 960, ...cardStyle }}>
      <div style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: 26, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>
        Literature Search
      </div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 28 }}>
        Search 8 clinical and academic databases simultaneously
      </div>

      <SearchForm
        onSearch={handleSearch}
        onSave={handleSaveRequest}
        isLoading={isLoading}
        initialParams={location.state?.params}
        key={JSON.stringify(location.state?.params)}
      />

      {error && (
        <div style={{ background: '#fff5f5', border: '1.5px solid #fcc', borderRadius: 8, padding: '12px 16px', color: '#c0392b', marginBottom: 16, fontSize: 14 }}>
          ⚠ {error}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#7a8aaa', fontSize: 15 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Searching 8 databases simultaneously...
        </div>
      )}

      {results && !isLoading && (
        <ResultsList
          results={results.results}
          totalCount={results.totalCount}
          bibliographies={bibliographies}
          onAddToBibliography={handleAddToBibliography}
          onBibliographyCreated={handleBibliographyCreated}
          lastResultIds={lastResultIds}
        />
      )}

      {/* Save search modal */}
      {saveModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: 20, fontWeight: 800, color: '#1a2035', marginBottom: 16 }}>
              Save Search
            </div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Name this search..."
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #dde3ef', borderRadius: 8, fontSize: 15, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit' }}
              onKeyDown={e => e.key === 'Enter' && handleSaveConfirm()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSaveModalOpen(false)} style={{ padding: '10px 18px', border: '1.5px solid #dde3ef', borderRadius: 8, background: '#fff', color: '#5a6a8a', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={handleSaveConfirm} disabled={!saveName.trim()} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#1a3a6b', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
