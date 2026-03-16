import { useState } from 'react'
import type { Paper, Bibliography } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'
import { createBibliography } from '../lib/api'

interface Props {
  paper: Paper
  bibliographies: Bibliography[]
  onAddToBibliography: (bibliographyId: number, paper: Paper) => Promise<void>
  onBibliographyCreated: (bib: Bibliography) => void
  isSelected: boolean
  onToggle: () => void
}

export default function ResultCard({ paper, bibliographies, onAddToBibliography, onBibliographyCreated, isSelected, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedBibId, setSelectedBibId] = useState<number | '' | '__new__'>('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [newBibName, setNewBibName] = useState('')
  const [newBibCreator, setNewBibCreator] = useState('')
  const [creatingBib, setCreatingBib] = useState(false)

  const handleAdd = async () => {
    if (!selectedBibId) return

    if (selectedBibId === '__new__') {
      if (!newBibName.trim()) return
      setCreatingBib(true)
      try {
        const newBib = await createBibliography(newBibName.trim(), '', newBibCreator.trim())
        await onAddToBibliography(newBib.id, paper)
        onBibliographyCreated(newBib)
        setAdded(true)
        setSelectedBibId(newBib.id)
        setNewBibName('')
        setNewBibCreator('')
        setTimeout(() => {
          setAdded(false)
          setSelectedBibId('')
        }, 2000)
      } catch {
        // Creating or adding failed — reset state
      } finally {
        setCreatingBib(false)
      }
      return
    }

    setAdding(true)
    try {
      await onAddToBibliography(Number(selectedBibId), paper)
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch {
      // Adding failed — button resets to ready state
    } finally {
      setAdding(false)
    }
  }

  const isAddDisabled = !selectedBibId || adding || creatingBib || (selectedBibId === '__new__' && !newBibName.trim())

  return (
    <div style={{
      background: isSelected ? '#f0f4ff' : '#fff',
      border: isSelected ? '1.5px solid #1a3a6b' : '1.5px solid #dde3ef',
      borderRadius: 10, padding: '20px',
      marginBottom: 12, boxShadow: '0 1px 4px rgba(26,42,74,0.05)',
      transition: 'border-color 0.15s, background 0.15s',
      position: 'relative',
    }}>
      {/* Checkbox in top-left */}
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#1a3a6b' }}
        />
      </div>

      <div style={{ paddingLeft: 32 }}>
        <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
          {paper.title}
        </div>
        <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 8 }}>
          {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
          {paper.journal && ` · ${paper.journal}`}
          {paper.year && ` · ${paper.year}`}
          {paper.doi && ` · DOI: ${paper.doi}`}
        </div>

        {paper.abstract && (
          <div style={{ fontSize: 13, color: '#5a6a8a', lineHeight: 1.7, marginBottom: 10 }}>
            {expanded ? paper.abstract : `${paper.abstract.slice(0, 200)}...`}
            <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
              {expanded ? 'Less' : 'More'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Source badges — one per source this paper was found in */}
          {(paper.sources ?? [paper.source]).map(src => {
            const c = SOURCE_COLORS[src] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
            return (
              <span key={src} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>
                {SOURCE_LABELS[src] ?? src}
              </span>
            )
          })}
          {paper.type && (
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#f0f2f7', color: '#5a6a8a' }}>
              {paper.type}
            </span>
          )}
          {paper.citationCount !== undefined && (
            <span style={{ fontSize: 12, color: '#9aa5bf' }}>
              📊 {paper.citationCount} citations
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 13, border: '1.5px solid #c8d4e8',
            background: '#fff', color: '#3a5a9a', fontWeight: 500, textDecoration: 'none',
          }}>
            View Source ↗
          </a>

          {/* Always show add section */}
          <select
            value={selectedBibId}
            onChange={e => {
              const val = e.target.value
              if (val === '__new__') {
                setSelectedBibId('__new__')
              } else {
                setSelectedBibId(val ? Number(val) : '')
              }
            }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', background: '#f7f9fc' }}
          >
            <option value="">Add to bibliography...</option>
            <option value="__new__">+ Create new bibliography...</option>
            {bibliographies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {selectedBibId === '__new__' && (
            <>
              <input
                type="text"
                value={newBibName}
                onChange={e => setNewBibName(e.target.value)}
                placeholder="Bibliography name..."
                style={{
                  padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef',
                  fontSize: 13, color: '#1a2035', background: '#fff',
                  outline: 'none', minWidth: 160,
                }}
              />
              <input
                type="text"
                value={newBibCreator}
                onChange={e => setNewBibCreator(e.target.value)}
                placeholder="Your name..."
                style={{
                  padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef',
                  fontSize: 13, color: '#1a2035', background: '#fff',
                  outline: 'none', minWidth: 120,
                }}
              />
            </>
          )}

          <button
            onClick={handleAdd}
            disabled={isAddDisabled}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, cursor: isAddDisabled ? 'not-allowed' : 'pointer',
              background: added ? '#22c55e' : '#c8a84b', color: '#fff', fontWeight: 600,
              opacity: isAddDisabled ? 0.5 : 1, transition: 'background 0.2s',
            }}
          >
            {added ? '✓ Added!' : (adding || creatingBib) ? '...' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
