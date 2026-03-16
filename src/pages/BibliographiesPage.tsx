import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Bibliography } from '../types'
import { listBibliographies, createBibliography, deleteBibliography } from '../lib/api'
import NewBibliographyModal from '../components/NewBibliographyModal'

export default function BibliographiesPage() {
  const [bibs, setBibs] = useState<Bibliography[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const data = await listBibliographies()
      setBibs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (name: string, description: string) => {
    try {
      const created = await createBibliography(name, description)
      const newBib: Bibliography = { ...(created as Omit<Bibliography, 'paperCount'>), paperCount: 0 }
      setBibs(b => [newBib, ...b])
      setShowModal(false)
      navigate(`/bibliographies/${newBib.id}`)
    } catch (e) {
      alert('Failed to create bibliography. Please try again.')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this bibliography and all its papers?')) return
    try {
      await deleteBibliography(id)
      setBibs(b => b.filter(bib => bib.id !== id))
    } catch {
      alert('Failed to delete. Please try again.')
    }
  }

  const formatDate = (str: string) => {
    try { return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return str }
  }

  return (
    <div style={{ padding: '32px 36px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>Bibliographies</div>
          <div style={{ fontSize: 14, color: '#7a8aaa' }}>Named collections of clinical literature</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: '#1a3a6b', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + New Bibliography
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9aa5bf', fontSize: 15 }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {bibs.map(bib => (
            <div
              key={bib.id}
              onClick={() => navigate(`/bibliographies/${bib.id}`)}
              style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 12, padding: 22, cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(26,42,74,0.05)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c8a84b')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#dde3ef')}
            >
              <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1a2035', marginBottom: 8, lineHeight: 1.3 }}>{bib.name}</div>
              {bib.description && <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 14, lineHeight: 1.6 }}>{bib.description}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #eef1f7', marginTop: 'auto' }}>
                <div style={{ fontSize: 14, color: '#1a3a6b', fontWeight: 600 }}>{bib.paperCount} paper{bib.paperCount !== 1 ? 's' : ''}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#9aa5bf' }}>{formatDate(bib.updatedAt)}</span>
                  <button
                    onClick={e => handleDelete(e, bib.id)}
                    style={{ padding: '3px 8px', border: '1px solid #fcc', borderRadius: 4, background: '#fff5f5', color: '#c0392b', fontSize: 11, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty state / Add card */}
          {bibs.length === 0 && (
            <div
              onClick={() => setShowModal(true)}
              style={{ border: '1.5px dashed #c8d4e8', borderRadius: 12, padding: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140, color: '#b0bccc' }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8, color: '#c8d4e8' }}>+</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Create your first bibliography</div>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <NewBibliographyModal onConfirm={handleCreate} onClose={() => setShowModal(false)} />}
    </div>
  )
}
