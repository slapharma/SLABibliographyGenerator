// src/pages/ProtocolPage.tsx
//
// Create or edit the research protocol (PICO + inclusion criteria +
// extraction template) for a specific bibliography. Route:
//   /bibliographies/:id/protocol
//
// One protocol per bibliography (if multiple exist, we edit the first).

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ProtocolForm, { type ProtocolDefinition } from '../components/ProtocolForm'

interface ProtocolRow {
  id: number
  bibliographyId: number
  picoQuestion: string
  inclusionCriteria: string
  extractionTemplate: ProtocolDefinition['extractionTemplate']
}

export default function ProtocolPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bibliographyId = Number(id)

  const [existing, setExisting] = useState<ProtocolRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bibliographyId) return
    setLoading(true)
    fetch(`/api/protocols?bibliographyId=${bibliographyId}`)
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list) && list.length > 0) setExisting(list[0])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [bibliographyId])

  const handleSave = async (protocol: ProtocolDefinition) => {
    setSaving(true)
    setError(null)
    try {
      if (existing) {
        const res = await fetch(`/api/protocols?id=${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(protocol),
        })
        if (!res.ok) throw new Error(`Update failed (${res.status})`)
      } else {
        const res = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bibliographyId, ...protocol }),
        })
        if (!res.ok) throw new Error(`Create failed (${res.status})`)
      }
      navigate(`/bibliographies/${bibliographyId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#9aa5bf' }}>Loading…</div>
  }

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif', maxWidth: 900 }}>
      <button
        onClick={() => navigate(`/bibliographies/${bibliographyId}`)}
        style={{
          background: 'none', border: 'none', color: '#7a8aaa',
          cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 18, padding: 0,
        }}
      >
        ← Back to bibliography
      </button>

      <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>
        {existing ? 'Edit Protocol' : 'Create Protocol'}
      </div>
      <div style={{ fontSize: 14, color: '#7a8aaa', marginBottom: 24 }}>
        Define the PICO question, inclusion criteria, and extraction template for this bibliography.
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
            background: '#fef2f2', color: '#c0392b', border: '1.5px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      <ProtocolForm
        onSave={handleSave}
        isLoading={saving}
        initialProtocol={
          existing
            ? {
                picoQuestion: existing.picoQuestion,
                inclusionCriteria: existing.inclusionCriteria,
                extractionTemplate: existing.extractionTemplate,
              }
            : undefined
        }
      />
    </div>
  )
}
