import { useState } from 'react'

interface Props {
  onConfirm: (name: string, description: string) => void
  onClose: () => void
}

export default function NewBibliographyModal({ onConfirm, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #dde3ef', borderRadius: 8,
    fontSize: 15, marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', color: '#1a2035',
    background: '#f7f9fc',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 700, color: '#1a2035', marginBottom: 20 }}>
          New Bibliography
        </div>
        <label style={{ fontSize: 12, color: '#5a6a8a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Q1 2026 Hypertension Review"
          style={inputStyle}
          autoFocus
        />
        <label style={{ fontSize: 12, color: '#5a6a8a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of this collection..."
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', border: '1.5px solid #dde3ef', borderRadius: 8, background: '#fff', color: '#5a6a8a', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim(), description.trim())}
            disabled={!name.trim()}
            style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#1a3a6b', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: name.trim() ? 1 : 0.5 }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
