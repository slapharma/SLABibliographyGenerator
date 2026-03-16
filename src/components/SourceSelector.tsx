import type { Source } from '../types'

const SOURCES: { id: Source; label: string; isNew: boolean }[] = [
  { id: 'pubmed', label: 'PubMed', isNew: false },
  { id: 'europepmc', label: 'Europe PMC', isNew: true },
  { id: 'clinicaltrials', label: 'ClinicalTrials.gov', isNew: false },
  { id: 'semanticscholar', label: 'Semantic Scholar', isNew: true },
  { id: 'scholar', label: 'Google Scholar', isNew: false },
  { id: 'crossref', label: 'CrossRef', isNew: true },
  { id: 'lens', label: 'Lens.org', isNew: true },
  { id: 'openalex', label: 'OpenAlex', isNew: true },
]

interface Props {
  selected: Source[]
  onChange: (sources: Source[]) => void
}

export default function SourceSelector({ selected, onChange }: Props) {
  const toggle = (id: Source) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#5a6a8a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Sources <span style={{ color: '#9aa5bf', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>({selected.length} selected)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {SOURCES.map(src => {
          const checked = selected.includes(src.id)
          return (
            <button
              key={src.id}
              onClick={() => toggle(src.id)}
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
              {src.isNew && (
                <span style={{ fontSize: 10, marginLeft: 'auto', padding: '1px 5px', borderRadius: 3, background: '#e6f9f0', color: '#177a4a', fontWeight: 600 }}>
                  NEW
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
