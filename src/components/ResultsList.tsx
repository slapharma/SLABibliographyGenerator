import { useState } from 'react'
import type { SourceResult, Bibliography, Paper, BibliographyType } from '../types'
import { useWindowWidth } from '../hooks/useWindowWidth'
import ResultCard from './ResultCard'
import { exportToExcel } from '../lib/export'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'
import { createBibliography } from '../lib/api'

interface Props {
  results: SourceResult[]
  totalCount: number
  bibliographies: Bibliography[]
  onAddToBibliography: (bibliographyId: number, paper: Paper) => Promise<void>
  onBibliographyCreated: (bib: Bibliography) => void
  lastResultIds: string[]
  onViewSource: (paper: Paper) => void
  searchNotes: Record<string, string>
  onNoteChange: (paperId: string, note: string) => void
  bibliographyType: BibliographyType
}

const PAGE_SIZE_OPTIONS = [50, 100, 300]

export default function ResultsList({ results, totalCount, bibliographies, onAddToBibliography, onBibliographyCreated, lastResultIds, onViewSource, searchNotes, onNoteChange, bibliographyType }: Props) {
  const isMobile = useWindowWidth() < 768
  const allPapers = results.flatMap(r => r.papers)
  const errors = results.filter(r => r.error)

  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBibId, setBulkBibId] = useState<number | '' | '__new__'>('')
  const [bulkNewBibName, setBulkNewBibName] = useState('')
  const [bulkAdding, setBulkAdding] = useState(false)
  const [bulkAdded, setBulkAdded] = useState(false)

  const totalPages = Math.max(1, Math.ceil(allPapers.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedPapers = allPapers.slice(safePage * pageSize, (safePage + 1) * pageSize)

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(0)
  }

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      pagedPapers.forEach(p => next.add(p.id))
      return next
    })
  }

  const selectAllResults = () => {
    setSelectedIds(new Set(allPapers.map(p => p.id)))
  }

  const deselectAll = () => setSelectedIds(new Set())

  const handleBulkAdd = async () => {
    if (!bulkBibId) return
    const papers = allPapers.filter(p => selectedIds.has(p.id))
    if (papers.length === 0) return

    setBulkAdding(true)
    try {
      if (bulkBibId === '__new__') {
        if (!bulkNewBibName.trim()) return
        const newBib = await createBibliography(bulkNewBibName.trim(), '')
        await Promise.all(papers.map(p => onAddToBibliography(newBib.id, p)))
        setBulkNewBibName('')
        setBulkBibId(newBib.id)
      } else {
        await Promise.all(papers.map(p => onAddToBibliography(Number(bulkBibId), p)))
      }
      setBulkAdded(true)
      setTimeout(() => setBulkAdded(false), 2000)
    } catch {
      // Bulk add failed
    } finally {
      setBulkAdding(false)
    }
  }

  const isBulkAddDisabled = !bulkBibId || bulkAdding || (bulkBibId === '__new__' && !bulkNewBibName.trim())

  return (
    <div>
      {/* Header row */}
      <div className="results-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: '#5a6a8a' }}>
            <strong style={{ color: '#1a2035', fontSize: 16 }}>{totalCount} unique results</strong>{' '}across {results.filter(r => r.papers.length > 0).length} sources
          </div>
          {/* Per-source tallies — hidden on mobile */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {results.filter(r => r.papers.length > 0).map(r => {
                const color = SOURCE_COLORS[r.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
                return (
                  <span key={r.source} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 500, background: color.bg, color: color.text }}>
                    {SOURCE_LABELS[r.source] ?? r.source} {r.papers.length}
                  </span>
                )
              })}
            </div>
          )}
          {/* Errors */}
          {errors.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#c0392b' }}>
              ⚠ {errors.map(r => SOURCE_LABELS[r.source]).join(', ')} failed to respond
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Per-page selector */}
          <select
            value={pageSize}
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #dde3ef', background: '#f7f9fc', fontSize: 13, color: '#5a6a8a', cursor: 'pointer' }}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
          <button onClick={() => exportToExcel(allPapers)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            ⬇ Export Excel
          </button>
        </div>
      </div>

      {/* Sticky bulk selection bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, background: '#fff',
          border: '1.5px solid #1a3a6b', borderRadius: 10, padding: '12px 16px',
          marginBottom: 12, boxShadow: '0 2px 8px rgba(26,42,74,0.12)',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a3a6b', marginRight: 4 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={selectAllOnPage}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #dde3ef', background: '#f7f9fc', color: '#5a6a8a', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            Select all on page
          </button>
          <button
            onClick={selectAllResults}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #dde3ef', background: '#f7f9fc', color: '#5a6a8a', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            Select all {allPapers.length} results
          </button>
          <button
            onClick={deselectAll}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e8d4d4', background: '#fff5f5', color: '#c0392b', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            Deselect all
          </button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8, flexWrap: 'wrap' }}>
            <select
              value={bulkBibId}
              onChange={e => {
                const val = e.target.value
                setBulkBibId(val === '__new__' ? '__new__' : val ? Number(val) : '')
              }}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', background: '#f7f9fc' }}
            >
              <option value="">Add selected to bibliography...</option>
              <option value="__new__">+ Create new bibliography...</option>
              {bibliographies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {bulkBibId === '__new__' && (
              <input
                type="text"
                value={bulkNewBibName}
                onChange={e => setBulkNewBibName(e.target.value)}
                placeholder="Bibliography name..."
                style={{
                  padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef',
                  fontSize: 13, color: '#1a2035', background: '#fff',
                  outline: 'none', minWidth: 160,
                }}
              />
            )}
            <button
              onClick={handleBulkAdd}
              disabled={isBulkAddDisabled}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13,
                cursor: isBulkAddDisabled ? 'not-allowed' : 'pointer',
                background: bulkAdded ? '#22c55e' : '#c8a84b', color: '#fff', fontWeight: 600,
                opacity: isBulkAddDisabled ? 0.5 : 1, transition: 'background 0.2s',
              }}
            >
              {bulkAdded ? '✓ Added!' : bulkAdding ? '...' : '+ Add to bibliography'}
            </button>
          </div>
        </div>
      )}

      {/* Result cards */}
      {pagedPapers.map(paper => {
        const key = paper.doi ?? paper.id
        const isNew = lastResultIds.length > 0 && !lastResultIds.includes(key)
        return (
          <ResultCard
            key={paper.id}
            paper={paper}
            bibliographies={bibliographies}
            onAddToBibliography={onAddToBibliography}
            onBibliographyCreated={onBibliographyCreated}
            isSelected={selectedIds.has(paper.id)}
            onToggle={() => toggleId(paper.id)}
            isNew={isNew}
            onViewSource={onViewSource}
            note={searchNotes[paper.id] ?? ''}
            onNoteChange={(note) => onNoteChange(paper.id, note)}
            bibliographyType={bibliographyType}
          />
        )
      })}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid #dde3ef', flexWrap: 'wrap' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde3ef',
              background: '#fff', color: safePage === 0 ? '#c0c8d8' : '#3a5a9a',
              fontSize: 14, cursor: safePage === 0 ? 'not-allowed' : 'pointer', fontWeight: 500,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 14, color: '#5a6a8a', fontWeight: 500 }}>
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde3ef',
              background: '#fff', color: safePage === totalPages - 1 ? '#c0c8d8' : '#3a5a9a',
              fontSize: 14, cursor: safePage === totalPages - 1 ? 'not-allowed' : 'pointer', fontWeight: 500,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
