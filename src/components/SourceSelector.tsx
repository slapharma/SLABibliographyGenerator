import type { Source } from '../types'

const TIER_1: { id: Source; label: string }[] = [
  { id: 'pubmed',        label: 'PubMed' },
  { id: 'europepmc',    label: 'Europe PMC' },
  { id: 'clinicaltrials', label: 'ClinicalTrials.gov' },
  { id: 'scholar',      label: 'Google Scholar' },
]

const TIER_2: { id: Source; label: string }[] = [
  { id: 'semanticscholar', label: 'Semantic Scholar' },
  { id: 'crossref',    label: 'CrossRef' },
]

interface Props {
  selected: Source[]
  onChange: (sources: Source[]) => void
}

function SourceButton({ src, checked, onToggle }: { src: { id: Source; label: string }; checked: boolean; onToggle: () => void }) {
  return (
    <button
      key={src.id}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
        border: `1.5px solid ${checked ? '#c8a84b' : '#dde3ef'}`,
        borderRadius: 8,
        background: checked ? '#fffbf0' : '#f7f9fc',
        cursor: 'pointer',
        fontSize: 13, color: checked ? '#7a5a00' : '#3a4a6a', fontWeight: 500,
        transition: 'all 0.15s', textAlign: 'left',
      }}
    >
      <span style={{
        width: 14, height: 14, border: `2px solid ${checked ? '#c8a84b' : '#c8d4e8'}`,
        borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: checked ? '#c8a84b' : 'transparent', color: '#fff', fontSize: 10,
      }}>{checked ? '✓' : ''}</span>
      {src.label}
    </button>
  )
}

export default function SourceSelector({ selected, onChange }: Props) {
  const toggle = (id: Source) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const tierLabel = (label: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9aa5bf', marginBottom: 6, marginTop: 10 }}>
      {label}
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 12, color: '#5a6a8a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Sources <span style={{ color: '#9aa5bf', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>({selected.length} selected)</span>
      </div>
      {tierLabel('Tier 1 — Primary')}
      <div className="source-grid-4" style={{ marginBottom: 0 }}>
        {TIER_1.map(src => (
          <SourceButton key={src.id} src={src} checked={selected.includes(src.id)} onToggle={() => toggle(src.id)} />
        ))}
      </div>
      {tierLabel('Tier 2 — Extended')}
      <div className="source-grid-4">
        {TIER_2.map(src => (
          <SourceButton key={src.id} src={src} checked={selected.includes(src.id)} onToggle={() => toggle(src.id)} />
        ))}
      </div>
    </div>
  )
}
