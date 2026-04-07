import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { BibliographyWithPapers, BibliographyPaperRow, CitationStyle, Paper } from '../types'
import SourcePanel from '../components/SourcePanel'
import { getBibliography, removePaperFromBibliography, updateBibliography, enableBibliographySharing, disableBibliographySharing } from '../lib/api'
import { exportBibliographyRowsToExcel } from '../lib/export'
import { formatCitation } from '../lib/citations'
import { SOURCE_LABELS } from '../lib/sourceColors'
import PaperRow from '../components/PaperRow'

type SortKey = 'none' | 'date-desc' | 'date-asc' | 'az' | 'za' | 'added-desc' | 'added-asc'

export default function BibliographyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelPaper, setPanelPaper] = useState<Paper | null>(null)

  // Filter state
  const [filterSource, setFilterSource] = useState('')
  const [filterYearFrom, setFilterYearFrom] = useState('')
  const [filterYearTo, setFilterYearTo] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterType, setFilterType] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('none')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Citation style — persisted in localStorage
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(
    () => (localStorage.getItem('sla-citation-style') as CitationStyle | null) ?? 'vancouver'
  )
  const handleCitationStyleChange = (style: CitationStyle) => {
    setCitationStyle(style)
    localStorage.setItem('sla-citation-style', style)
  }

  // Date added filter
  const [filterAddedFrom, setFilterAddedFrom] = useState('')
  const [filterAddedTo, setFilterAddedTo] = useState('')

  // Share state — initialized to null; set from bib data in useEffect below
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Inline edit state for description + tags
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getBibliography(Number(id))
      .then(data => {
        setBib(data)
        setEditDescription(data.description ?? '')
        setEditTags(data.tags ?? '')
        // shareUrl must be set here (after bib loads) — not at state declaration time
        if (data.isShared && data.shareToken) {
          setShareUrl(`${window.location.origin}/share/${data.shareToken}`)
        } else {
          setShareUrl(null)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, location.key])

  const handleRemove = async (rowId: number) => {
    if (!bib) return
    await removePaperFromBibliography(bib.id, rowId)
    setBib(b => b ? { ...b, papers: b.papers.filter(p => p.rowId !== rowId) } : null)
  }

  const handleEnableShare = async () => {
    if (!bib) return
    setShareLoading(true)
    try {
      const { shareUrl: url } = await enableBibliographySharing(bib.id)
      setShareUrl(url)
      setBib(b => b ? { ...b, isShared: true } : null)
    } finally {
      setShareLoading(false)
    }
  }

  const handleDisableShare = async () => {
    if (!bib) return
    setShareLoading(true)
    try {
      await disableBibliographySharing(bib.id)
      setShareUrl(null)
      setBib(b => b ? { ...b, isShared: false } : null)
    } finally {
      setShareLoading(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!bib) return
    setEditSaving(true)
    setEditError('')
    try {
      await updateBibliography(bib.id, { description: editDescription })
      setBib(b => b ? { ...b, description: editDescription } : null)
    } catch {
      setEditError('Failed to save')
      setEditDescription(bib.description)
    } finally {
      setEditSaving(false)
    }
  }

  const handleSaveTags = async () => {
    if (!bib) return
    const normalised = editTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10).join(',')
    setEditSaving(true)
    setEditError('')
    try {
      await updateBibliography(bib.id, { tags: normalised })
      setBib(b => b ? { ...b, tags: normalised } : null)
      setEditTags(normalised)
    } catch {
      setEditError('Failed to save')
      setEditTags(bib.tags ?? '')
    } finally {
      setEditSaving(false)
    }
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
      if (filterAddedFrom && r.addedAt && r.addedAt < filterAddedFrom) return false
      if (filterAddedTo && r.addedAt && r.addedAt > filterAddedTo + 'T23:59:59') return false
      return true
    })
    .sort((a, b) => {
      const pa = a.paper, pb = b.paper
      switch (sortKey) {
        case 'date-desc': return (pb.year ?? 0) - (pa.year ?? 0)
        case 'date-asc':  return (pa.year ?? 0) - (pb.year ?? 0)
        case 'az':        return pa.title.localeCompare(pb.title)
        case 'za':        return pb.title.localeCompare(pa.title)
        case 'added-desc': return new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime()
        case 'added-asc':  return new Date(a.addedAt ?? 0).getTime() - new Date(b.addedAt ?? 0).getTime()
        default:          return 0
      }
    })

  const activeFilterCount = [filterSource, filterYearFrom, filterYearTo, filterAuthor, filterType, filterAddedFrom, filterAddedTo].filter(Boolean).length

  const clearFilters = () => {
    setFilterSource(''); setFilterYearFrom(''); setFilterYearTo('')
    setFilterAuthor(''); setFilterType(''); setSortKey('none')
    setFilterAddedFrom(''); setFilterAddedTo('')
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9aa5bf', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</div>
  if (error) return <div style={{ padding: 32, color: '#c0392b', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Error: {error}</div>
  if (!bib) return null

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }
  const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <button onClick={() => navigate('/bibliographies')} style={{ background: 'none', border: 'none', color: '#7a8aaa', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
        ← Back to Bibliographies
      </button>

      <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>{bib.name}</div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 8 }}>
        {allRows.length} paper{allRows.length !== 1 ? 's' : ''}
        {bib.creatorName && ` · Created by ${bib.creatorName}`}
      </div>

      {/* Citation style + Print + Share */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <select
          value={citationStyle}
          onChange={e => handleCitationStyleChange(e.target.value as CitationStyle)}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, background: '#f7f9fc' }}
        >
          <option value="vancouver">Vancouver</option>
          <option value="apa">APA 7th</option>
          <option value="harvard">Harvard</option>
        </select>
        <a
          href={`/bibliographies/${bib.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', textDecoration: 'none', background: '#fff' }}
        >
          🖨️ Print / PDF
        </a>
        {!bib.isShared ? (
          <button onClick={handleEnableShare} disabled={shareLoading} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}>
            {shareLoading ? 'Enabling…' : '🔗 Share'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#7a8aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(shareUrl ?? '').catch(() => {}); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) }}
              style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #dde3ef', fontSize: 12, color: shareCopied ? '#22c55e' : '#5a6a8a', background: '#fff', cursor: 'pointer' }}
            >
              {shareCopied ? '✓ Copied' : '📋 Copy link'}
            </button>
            <button onClick={handleDisableShare} disabled={shareLoading} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 12, color: '#c0392b', background: 'none', cursor: 'pointer' }}>
              Stop sharing
            </button>
          </div>
        )}
      </div>

      {/* Inline description + tags editor */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <textarea
          value={editDescription}
          onChange={e => setEditDescription(e.target.value)}
          onBlur={handleSaveDescription}
          placeholder="Add a description..."
          rows={2}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <input
          value={editTags}
          onChange={e => setEditTags(e.target.value)}
          onBlur={handleSaveTags}
          placeholder="Tags (comma-separated, e.g. regulatory, ibd, draft)"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {editError && <div style={{ fontSize: 12, color: '#c0392b' }}>{editError}</div>}
        {editSaving && <div style={{ fontSize: 12, color: '#7a8aaa' }}>Saving…</div>}
        {editTags && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {editTags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f0f4ff', color: '#1a3a6b' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => exportBibliographyRowsToExcel(displayedRows, `${bib.name.replace(/\s+/g, '-')}.xlsx`)}
          disabled={displayedRows.length === 0}
          style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: displayedRows.length === 0 ? 0.5 : 1 }}
        >
          ⬇ Export Excel
        </button>

        <button
          onClick={() => {
            const text = displayedRows.map((r, i) => `${i + 1}. ${formatCitation(r.paper, citationStyle)}`).join('\n\n')
            navigator.clipboard.writeText(text).catch(() => {})
          }}
          style={{ padding: '8px 16px', border: '1.5px solid #dde3ef', borderRadius: 6, fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}
        >
          📋 Copy all citations
        </button>

        <button
          onClick={() => {
            const text = displayedRows.map((r, i) => `${i + 1}. ${formatCitation(r.paper, citationStyle)}`).join('\n\n')
            const blob = new Blob([text], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${bib.name.replace(/\s+/g, '-').toLowerCase()}-citations.txt`
            a.click()
            URL.revokeObjectURL(url)
          }}
          style={{ padding: '8px 16px', border: '1.5px solid #dde3ef', borderRadius: 6, fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}
        >
          ⬇️ Download .txt
        </button>

        <button
          onClick={async () => {
            if (!bib) return
            try {
              const res = await fetch(`/api/protocols?bibliographyId=${bib.id}`)
              const list = await res.json()
              const protocol = Array.isArray(list) ? list[0] : null
              if (!protocol) {
                if (confirm('No protocol defined for this bibliography yet. Create one now?')) {
                  navigate(`/bibliographies/${bib.id}/protocol`)
                }
                return
              }
              const papersPayload = displayedRows.map(r => ({
                id: r.paper.id,
                title: r.paper.title,
                doi: r.paper.doi,
              }))
              navigate(`/quality/${protocol.id}`, { state: { papers: papersPayload } })
            } catch (e) {
              alert(`Failed to launch quality review: ${e instanceof Error ? e.message : e}`)
            }
          }}
          disabled={displayedRows.length === 0}
          style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#1a2a4a', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: displayedRows.length === 0 ? 0.5 : 1 }}
        >
          🧪 Run Quality Review
        </button>

        <button
          onClick={() => bib && navigate(`/bibliographies/${bib.id}/protocol`)}
          style={{ padding: '10px 18px', border: '1.5px solid #dde3ef', borderRadius: 8, background: '#fff', color: '#4a5568', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          📋 Protocol
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
          <option value="added-desc">Date Added (newest)</option>
          <option value="added-asc">Date Added (oldest)</option>
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
            <span style={labelStyle}>Source</span>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              <option value="">All sources</option>
              {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
            </select>
          </label>

          {/* Year from */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Year from</span>
            <input type="number" placeholder="e.g. 2018" value={filterYearFrom} onChange={e => setFilterYearFrom(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Year to */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Year to</span>
            <input type="number" placeholder="e.g. 2024" value={filterYearTo} onChange={e => setFilterYearTo(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Author */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Author</span>
            <input type="text" placeholder="Author name" value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}
              style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }} />
          </label>

          {/* Paper type */}
          {types.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Paper type</span>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ padding: '8px 12px', border: '1.5px solid #dde3ef', borderRadius: 7, fontSize: 13, background: '#fff', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                <option value="">All types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}

          {/* Date Added From */}
          <div>
            <label style={labelStyle}>Date Added From</label>
            <input type="date" value={filterAddedFrom} onChange={e => setFilterAddedFrom(e.target.value)} style={inputStyle} />
          </div>

          {/* Date Added To */}
          <div>
            <label style={labelStyle}>Date Added To</label>
            <input type="date" value={filterAddedTo} onChange={e => setFilterAddedTo(e.target.value)} style={inputStyle} />
          </div>
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
          <PaperRow key={row.rowId} row={row} onRemove={handleRemove} citationStyle={citationStyle} onViewSource={setPanelPaper} />
        ))
      )}
      <SourcePanel paper={panelPaper} onClose={() => setPanelPaper(null)} />
    </div>
  )
}
