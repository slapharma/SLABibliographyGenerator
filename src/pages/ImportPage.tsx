import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseWorkbook, type ParsedSheet } from '../lib/importParser'

type VerifyStatus = 'verified' | 'mismatch' | 'not_found' | 'manual_review' | 'error' | 'pending'

interface VerifyResult {
  key: string
  status: VerifyStatus
  score: number
  pubmedId?: string
  doi?: string
  foundTitle?: string
  foundUrl?: string
  note?: string
}

const STATUS_STYLE: Record<VerifyStatus, { bg: string; fg: string; label: string; icon: string }> = {
  verified:      { bg: '#e6f7ec', fg: '#1f7a3a', label: 'Verified',       icon: '✓' },
  mismatch:      { bg: '#fff5e0', fg: '#a86a00', label: 'Mismatch',       icon: '⚠' },
  not_found:     { bg: '#fde6e6', fg: '#a82828', label: 'Not found',      icon: '✗' },
  manual_review: { bg: '#eef0f6', fg: '#555f7a', label: 'Manual review',  icon: '?' },
  error:         { bg: '#fde6e6', fg: '#a82828', label: 'Error',          icon: '!' },
  pending:       { bg: '#eaf0fb', fg: '#1a3a6b', label: 'Checking…',      icon: '⋯' },
}

export default function ImportPage() {
  const navigate = useNavigate()
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [filename, setFilename] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [results, setResults] = useState<Record<string, VerifyResult>>({})
  const [bibName, setBibName] = useState('')
  const [bibDesc, setBibDesc] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    const paperRows = sheets.flatMap(s => s.rows.filter(r => r.paper))
    const total = paperRows.length
    const counts = { verified: 0, mismatch: 0, not_found: 0, error: 0, manual_review: 0, pending: 0 }
    for (const r of paperRows) {
      const v = results[r.paper!.id]
      counts[v?.status ?? 'pending']++
    }
    return { total, sheetsCount: sheets.length, ...counts }
  }, [sheets, results])

  async function handleFile(file: File) {
    setError(''); setResults({}); setSheets([])
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseWorkbook(buf)
      setSheets(parsed)
      setFilename(file.name)
      setActiveTab(0)
      if (!bibName) setBibName(file.name.replace(/\.xlsx?$/i, ''))
    } catch (e: any) {
      setError(`Could not parse file: ${e?.message ?? e}`)
    }
  }

  async function runSanityCheck() {
    const items = sheets.flatMap(s =>
      s.rows.filter(r => r.paper).map(r => ({
        key: r.paper!.id,
        title: r.paper!.title,
        authors: r.paper!.authors,
        year: r.paper!.year,
        doi: r.paper!.doi,
      }))
    )
    if (items.length === 0) return
    setVerifying(true); setError('')
    // mark pending
    const pending: Record<string, VerifyResult> = {}
    for (const it of items) pending[it.key] = { key: it.key, status: 'pending', score: 0 }
    setResults(pending)

    try {
      // Chunk requests so a single failure doesn't take the whole run down
      const CHUNK = 25
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK)
        const res = await fetch('/api/verify-papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: slice }),
        })
        if (!res.ok) throw new Error(`verify-papers returned ${res.status}`)
        const { results: batchResults } = await res.json() as { results: VerifyResult[] }
        setResults(prev => {
          const next = { ...prev }
          for (const r of batchResults) next[r.key] = r
          return next
        })
      }
    } catch (e: any) {
      setError(`Sanity check failed: ${e?.message ?? e}`)
    } finally {
      setVerifying(false)
    }
  }

  async function saveBibliography() {
    if (!bibName.trim()) { setError('Please give the bibliography a name'); return }
    setSaving(true); setError('')
    try {
      const papers = sheets.flatMap(s =>
        s.rows.filter(r => r.paper).map(r => {
          const v = results[r.paper!.id]
          // Enrich paper with verification metadata when available
          const enriched = v && (v.status === 'verified' || v.status === 'mismatch')
            ? {
                ...r.paper!,
                doi: r.paper!.doi || v.doi,
                url: v.foundUrl || r.paper!.url,
                source: v.pubmedId ? 'pubmed' : r.paper!.source,
                id: v.pubmedId ? `pubmed:${v.pubmedId}` : r.paper!.id,
              }
            : r.paper!
          return {
            paper: enriched,
            sheetName: s.name,
            note: [
              s.name,
              v?.status === 'mismatch' ? `⚠ verify mismatch: ${v.foundTitle ?? ''}` : '',
              v?.status === 'not_found' ? '✗ not found in PubMed/Crossref' : '',
            ].filter(Boolean).join(' · '),
          }
        })
      )
      const res = await fetch('/api/bibliography-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bibName.trim(),
          description: bibDesc.trim() || `Imported from ${filename}`,
          creatorName: creatorName.trim(),
          papers,
        }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`)
      const { id } = await res.json()
      navigate(`/bibliographies/${id}`)
    } catch (e: any) {
      setError(`Save failed: ${e?.message ?? e}`)
    } finally {
      setSaving(false)
    }
  }

  const active = sheets[activeTab]

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif', maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1a2035', marginBottom: 4 }}>Import Bibliography</div>
        <div style={{ fontSize: 13, color: '#7a8aaa' }}>
          Upload an Excel workbook (.xlsx) — each tab becomes a section of your bibliography.
        </div>
      </div>

      {/* Upload + Bibliography Metadata */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(26,42,74,0.06)' }}>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <div style={{
            border: '2px dashed #b8c4dd', borderRadius: 10, padding: '24px 20px', textAlign: 'center',
            background: '#f4f6fb', color: '#4a5a7e', fontSize: 14,
          }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>📄</div>
            <div style={{ fontWeight: 700, color: '#1a2035', marginBottom: 4 }}>
              {filename || 'Click to upload an .xlsx workbook'}
            </div>
            <div style={{ fontSize: 12, color: '#7a8aaa' }}>
              {filename ? `${stats.sheetsCount} sheets · ${stats.total} papers detected` : 'or drag and drop'}
            </div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>

        {sheets.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
            <Field label="Bibliography name *" value={bibName} onChange={setBibName} placeholder="e.g. Anatop manual bibliography" />
            <Field label="Creator" value={creatorName} onChange={setCreatorName} placeholder="Your name" />
            <Field label="Description" value={bibDesc} onChange={setBibDesc} placeholder="Optional notes" />
          </div>
        )}

        {sheets.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              onClick={runSanityCheck}
              disabled={verifying || stats.total === 0}
              style={btnPrimary(verifying || stats.total === 0)}
            >
              {verifying ? '⋯ Checking papers…' : `🔎 Sanity check ${stats.total} papers`}
            </button>
            <button
              onClick={saveBibliography}
              disabled={saving || stats.total === 0}
              style={btnSecondary(saving || stats.total === 0)}
            >
              {saving ? 'Saving…' : '💾 Save as bibliography'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fde6e6', color: '#a82828', fontSize: 13 }}>
            {error}
          </div>
        )}

        {sheets.length > 0 && Object.keys(results).length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', fontSize: 12 }}>
            <Tally label="Verified"      n={stats.verified}      color="#1f7a3a" bg="#e6f7ec" />
            <Tally label="Mismatch"      n={stats.mismatch}      color="#a86a00" bg="#fff5e0" />
            <Tally label="Not found"     n={stats.not_found}     color="#a82828" bg="#fde6e6" />
            <Tally label="Manual review" n={stats.manual_review} color="#555f7a" bg="#eef0f6" />
            <Tally label="Pending"       n={stats.pending}       color="#1a3a6b" bg="#eaf0fb" />
          </div>
        )}
      </div>

      {/* Tabs + Sheet content */}
      {sheets.length > 0 && active && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', overflow: 'hidden' }}>
          {/* Tab strip */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1.5px solid #dde3ef', background: '#f4f6fb' }}>
            {sheets.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveTab(i)}
                style={{
                  border: 'none', background: i === activeTab ? '#fff' : 'transparent',
                  padding: '12px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontSize: 13, fontWeight: i === activeTab ? 700 : 500,
                  color: i === activeTab ? '#1a3a6b' : '#5a6a8a',
                  borderBottom: i === activeTab ? '3px solid #c8a84b' : '3px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {s.name}
                <span style={{ marginLeft: 8, fontSize: 11, color: '#9aa5bf', fontWeight: 500 }}>
                  {s.rows.length}
                </span>
              </button>
            ))}
          </div>

          {/* Sheet table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8faff' }}>
                  <th style={th()}>Status</th>
                  {active.headers.map((h, i) => (
                    <th key={i} style={th()}>{h || `Column ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.rows.map(r => {
                  const v = r.paper ? results[r.paper.id] : undefined
                  return (
                    <tr key={r.rowIndex} style={{ borderTop: '1px solid #eef0f6' }}>
                      <td style={td()}>
                        {r.paper
                          ? <StatusBadge status={v?.status ?? 'manual_review'} score={v?.score} title={v?.foundTitle} url={v?.foundUrl} note={v?.note} />
                          : <span style={{ color: '#9aa5bf', fontSize: 11 }}>(no paper)</span>}
                      </td>
                      {active.headers.map((h, i) => (
                        <td key={i} style={td()}>
                          {String(r.raw[h || `col${i}`] ?? '').slice(0, 600)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small components ─────────────────────────────────────────

function StatusBadge({ status, score, title, url, note }: { status: VerifyStatus; score?: number; title?: string; url?: string; note?: string }) {
  const s = STATUS_STYLE[status]
  const tooltip = [
    title ? `Matched: ${title}` : '',
    score != null ? `Score: ${score.toFixed(2)}` : '',
    note ? `Note: ${note}` : '',
  ].filter(Boolean).join('\n')
  const badge = (
    <span title={tooltip} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.fg, padding: '2px 8px', borderRadius: 6,
      fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
    }}>
      {s.icon} {s.label}
    </span>
  )
  return url ? <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{badge}</a> : badge
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ fontSize: 12, color: '#5a6a8a', display: 'block' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', border: '1.5px solid #dde3ef',
          borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </label>
  )
}

function Tally({ label, n, color, bg }: { label: string; n: number; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
      {label}: {n}
    </span>
  )
}

const th = (): React.CSSProperties => ({
  textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700,
  color: '#5a6a8a', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1.5px solid #dde3ef', whiteSpace: 'nowrap',
})

const td = (): React.CSSProperties => ({
  padding: '10px 12px', verticalAlign: 'top', color: '#1a2035',
  maxWidth: 320, wordBreak: 'break-word',
})

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px', borderRadius: 8, border: 'none',
    background: disabled ? '#b8c4dd' : 'linear-gradient(135deg, #1a2a4a 0%, #2a4080 100%)',
    color: '#fff', fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 18px', borderRadius: 8, border: '1.5px solid #1a3a6b',
    background: '#fff', color: disabled ? '#9aa5bf' : '#1a3a6b',
    fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}
