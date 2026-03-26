import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { BibliographyWithPapers, BibliographyPaperRow } from '../types'
import { getBibliography, removePaperFromBibliography } from '../lib/api'
import { exportToExcel } from '../lib/export'
import { SOURCE_LABELS } from '../lib/sourceColors'
import PaperRow from '../components/PaperRow'

type SortKey = 'none' | 'date-desc' | 'date-asc' | 'az' | 'za'

export default function BibliographyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterSource, setFilterSource] = useState('')
  const [filterYearFrom, setFilterYearFrom] = useState('')
  const [filterYearTo, setFilterYearTo] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterType, setFilterType] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('none')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getBibliography(Number(id))
      .then(setBib)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, location.key])

  const handleRemove = async (rowId: number) => {
    if (!bib) return
    await removePaperFromBibliography(bib.id, rowId)
    setBib(b => b ? { ...b, papers: b.papers.filter(p => p.rowId !== rowId) } : null)
  }

  // Derive unique filter options from loaded papers
  const allRows = bib?.papers ?? []
  const sources = [...new Set(allRows.map(r => r.paper.source))].filter(Boolean)
  const types = [...new Set(allRows.map(r => r.paper.type ?? ''))].filter(Boolean)

  // Apply filters + sort
  const displayedRows: BibliographyPaperRow[] = allRows
    .filter(r => {
      const p = r.paper
      if (filterSource && p.source !== filterSource) return false
      if (filterYearFrom && (p.year ?? 0) < Number(filterYearFrom)) return false
      if (filterYearTo && (p.year ?? 9999) > Number(filterYearTo)) return false
      if (filterAuthor) {
        const q = filterAuthor.toLowerCase()
        if (!(p.authors ?? []).some(a => a.toLowerCase().includes(q))) return false
      }
      if (filterType && p.type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      const pa = a.paper, pb = b.paper
      switch (sortKey) {
        case 'date-desc': return (pb.year ?? 0) - (pa.year ?? 0)
        case 'date-asc':  return (pa.year ?? 0) - (pb.year ?? 0)
        case 'az':        return pa.title.localeCompare(pb.title)
        case 'za':        return pb.title.localeCompare(pa.title)
        default:          return 0
      }
    })

  const activeFilterCount = [filterSource, filterYearFrom, filterYearTo, filterAuthor, filterType].filter(Boolean).length

  const clearFilters = () => {
    setFilterSource(''); setFilterYearFrom(''); setFilterYearTo('')
    setFilterAuthor(''); setFilterType(''); setSortKey('none')
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9aa5bf', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</div>
  if (error) return <div style={{ padding: 32, color: '#c0392b', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Error: {error}</div>
  if (!bib) return null

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <button onClick={() => navigate('/bibliographies')} style={{ background: 'none', border: 'none', color: '#7a8aaa', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
        ← Back to Bibliographies
      </button>

      <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>{bib.name}</div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 24 }}>
        {allRows.length} paper{allRows.length !== 1 ? 's' : ''}
        {bib.description && ` · ${bib.description}`}
        {bib.creatorName && ` · Created by ${bib.creatorName}`}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => exportToExcel(displayedRows.map(r => r.paper), `${bib.name}.xlsx`)}
          disabled={displayedRows.length === 0}
          style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: displayedRows.length === 0 ? 0.5 : 1 }}
        >
          ⬇ Export Excel
        </button>

        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            padding: '10px 18px', border: '1.5px solid #dde3ef', borderRadius: 8,
            background: activeFilterCount > 0 ? '#1a2a4a' : '#fff',
            color: activeFilterCount > 0 ? '#fff' : '#4a5568',
            fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ⚙ Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          style={{ padding: '10px 14px', border: '1.5px solid #dde3ef', borderRadius: 8, fontSize: 13, background: '#fff', color: '#4a5568', cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif' }}
        >
          <option value="none">Sort: Default</option>
          <option value="date-desc">Sort: Newest first</option>
          <option value="date-asc">Sort: Oldest first</option>
          <option value="az">Sort: A → Z</option>
          <option value="za">Sort: Z → A</option>
        </select>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div style={{ background: '#f8faff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>

          {/* Source */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Source</span>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              <option value="">All sources</option>
              {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
            </select>
          </label>

          {/* Year from */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Year from</span>
            <input type="number" placeholder="e.g. 2018" value={filterYearFrom} onChange={e => setFilterYearFrom(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Year to */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Year to</span>
            <input type="number" placeholder="e.g. 2024" value={filterYearTo} onChange={e => setFilterYearTo(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Author */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Author</span>
            <input type="text" placeholder="Author name" value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Paper type */}
          {types.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paper type</span>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                <option value="">All types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {/* Results count when filtered */}
      {activeFilterCount > 0 && (
        <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 14 }}>
          Showing {displayedRows.length} of {allRows.length} papers
        </div>
      )}

      {allRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5bf', fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          No papers yet. Add papers from the Search page.
        </div>
      ) : displayedRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9aa5bf', fontSize: 15 }}>
          No papers match the current filters.{' '}
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>Clear filters</button>
        </div>
      ) : (
        displayedRows.map(row => (
          <PaperRow key={row.rowId} row={row} onRemove={handleRemove} />
        ))
      )}
    </div>
  )
}
