import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import type { BibliographyWithPapers } from '../types'
import { getBibliography, removePaperFromBibliography } from '../lib/api'
import { exportToCSV, exportToExcel } from '../lib/export'
import PaperRow from '../components/PaperRow'

export default function BibliographyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const allPapers = bib?.papers.map(r => r.paper) ?? []

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9aa5bf', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</div>
  if (error) return <div style={{ padding: 32, color: '#c0392b', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Error: {error}</div>
  if (!bib) return null

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <button onClick={() => navigate('/bibliographies')} style={{ background: 'none', border: 'none', color: '#7a8aaa', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
        ← Back to Bibliographies
      </button>

      <div style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>{bib.name}</div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 24 }}>
        {bib.papers.length} paper{bib.papers.length !== 1 ? 's' : ''}
        {bib.description && ` · ${bib.description}`}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => exportToCSV(allPapers, `${bib.name}.csv`)}
          disabled={allPapers.length === 0}
          style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: allPapers.length === 0 ? 0.5 : 1 }}
        >
          ⬇ Export CSV
        </button>
        <button
          onClick={() => exportToExcel(allPapers, `${bib.name}.xlsx`)}
          disabled={allPapers.length === 0}
          style={{ padding: '10px 18px', border: '1.5px solid #dde3ef', borderRadius: 8, background: '#fff', color: '#5a6a8a', fontSize: 13, cursor: 'pointer', fontWeight: 500, opacity: allPapers.length === 0 ? 0.5 : 1 }}
        >
          ⬇ Export Excel
        </button>
      </div>

      {bib.papers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9aa5bf', fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          No papers yet. Add papers from the Search page.
        </div>
      ) : (
        bib.papers.map(row => (
          <PaperRow key={row.rowId} row={row} onRemove={handleRemove} />
        ))
      )}
    </div>
  )
}
