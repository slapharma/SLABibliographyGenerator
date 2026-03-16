import { useState } from 'react'
import type { SearchParams, Source } from '../types'
import SourceSelector from './SourceSelector'

const ALL_SOURCES: Source[] = ['pubmed', 'europepmc', 'clinicaltrials', 'semanticscholar', 'scholar', 'crossref', 'lens', 'openalex']

const PAPER_TYPES = ['', 'RCT', 'Systematic Review', 'Meta-Analysis', 'Observational', 'Case Report', 'Review', 'Clinical Trial']

const TODAY = new Date().toISOString().slice(0, 10)
const FIVE_YEARS_AGO = `${new Date().getFullYear() - 5}-01-01`

interface Props {
  onSearch: (params: SearchParams) => void
  onSave: (params: SearchParams) => void
  initialParams?: Partial<SearchParams>
  isLoading: boolean
}

export default function SearchForm({ onSearch, onSave, initialParams, isLoading }: Props) {
  const [params, setParams] = useState<SearchParams>({
    indication: initialParams?.indication ?? '',
    keywords: initialParams?.keywords ?? '',
    paperType: initialParams?.paperType ?? '',
    dateFrom: initialParams?.dateFrom ?? FIVE_YEARS_AGO,
    dateTo: initialParams?.dateTo ?? TODAY,
    sources: initialParams?.sources ?? ALL_SOURCES,
  })

  const set = (key: keyof SearchParams) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setParams(p => ({ ...p, [key]: e.target.value }))

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f7f9fc', border: '1.5px solid #dde3ef',
    borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#1a2035',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, color: '#5a6a8a', marginBottom: 6,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #dde3ef', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 6px rgba(26,42,74,0.06)' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9aa5bf', marginBottom: 18, fontWeight: 600 }}>
        Search Parameters
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Indication / Condition</label>
          <input style={inputStyle} value={params.indication} onChange={set('indication')} placeholder="e.g. hypertension" />
        </div>
        <div>
          <label style={labelStyle}>Keywords</label>
          <input style={inputStyle} value={params.keywords} onChange={set('keywords')} placeholder="e.g. ACE inhibitor treatment" />
        </div>
        <div>
          <label style={labelStyle}>Paper Type</label>
          <select style={inputStyle} value={params.paperType} onChange={set('paperType')}>
            {PAPER_TYPES.map(t => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date Range</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={{ ...inputStyle }} type="date" value={params.dateFrom} onChange={set('dateFrom')} />
            <input style={{ ...inputStyle }} type="date" value={params.dateTo} onChange={set('dateTo')} />
          </div>
        </div>
      </div>

      <SourceSelector selected={params.sources} onChange={sources => setParams(p => ({ ...p, sources }))} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => onSearch(params)}
          disabled={isLoading || (!params.indication && !params.keywords)}
          style={{
            background: '#1a3a6b', border: 'none', color: '#fff', padding: '12px 26px',
            borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading || (!params.indication && !params.keywords) ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {isLoading ? '⏳ Searching...' : '⚡ Run Search'}
        </button>
        <button
          onClick={() => onSave(params)}
          disabled={!params.indication && !params.keywords}
          style={{
            background: '#fff', border: '1.5px solid #dde3ef', color: '#5a6a8a', padding: '11px 18px',
            borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          💾 Save Search
        </button>
      </div>
    </div>
  )
}
