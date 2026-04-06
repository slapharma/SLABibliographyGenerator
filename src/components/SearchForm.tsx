import { useState, useRef, useEffect } from 'react'
import type { SearchParams, BibliographyType } from '../types'
import SourceSelector from './SourceSelector'
import { useWindowWidth } from '../hooks/useWindowWidth'

const PAPER_TYPE_OPTIONS = ['RCT', 'Systematic Review', 'Meta-Analysis', 'Observational', 'Case Report', 'Review', 'Clinical Trial']

const UN_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin',
  'Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia',
  'Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica',
  'Dominican Republic','DR Congo','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya',
  'Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein',
  'Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands',
  'Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
  'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain',
  'Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Tajikistan','Tanzania','Thailand',
  'Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
]

const BIB_TYPE_OPTIONS: { value: BibliographyType; label: string; description: string }[] = [
  { value: 'clinical',         label: 'Clinical Papers',        description: 'RCTs, reviews, case reports' },
  { value: 'guidelines',       label: 'Consensus Guidelines',   description: 'Clinical guidelines & recommendations' },
  { value: 'health-economics', label: 'Health Economics',       description: 'Cost-effectiveness, QALY, HTA' },
  { value: 'prevalence',       label: 'Indication Prevalence',  description: 'Epidemiology, burden of disease' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const FIVE_YEARS_AGO = `${new Date().getFullYear() - 5}-01-01`

interface Props {
  onSearch: (params: SearchParams) => void
  onSave: (params: SearchParams) => void
  initialParams?: Partial<SearchParams>
  isLoading: boolean
}

export default function SearchForm({ onSearch, onSave, initialParams, isLoading }: Props) {
  const isMobile = useWindowWidth() < 768

  const [bibliographyType, setBibliographyType] = useState<BibliographyType>(
    initialParams?.bibliographyType ?? 'clinical'
  )
  const [params, setParams] = useState<Omit<SearchParams, 'bibliographyType'>>({
    indication: initialParams?.indication ?? '',
    keywords: initialParams?.keywords ?? '',
    paperType: initialParams?.paperType ?? '',
    dateFrom: initialParams?.dateFrom ?? FIVE_YEARS_AGO,
    dateTo: initialParams?.dateTo ?? TODAY,
    sources: initialParams?.sources ?? [],
    country: initialParams?.country ?? '',
    author: initialParams?.author ?? '',
    negativeKeywords: initialParams?.negativeKeywords ?? '',
  })

  const [indicationAlternates, setIndicationAlternates] = useState<string[]>([])

  const [selectedPaperTypes, setSelectedPaperTypes] = useState<string[]>(() => {
    if (initialParams?.paperType) {
      return initialParams.paperType.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  })

  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => {
    if (initialParams?.country) {
      return initialParams.country.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  })
  const [countryOpen, setCountryOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  const set = (key: keyof typeof params) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams(p => ({ ...p, [key]: e.target.value }))

  const [paperTypeOpen, setPaperTypeOpen] = useState(false)
  const paperTypeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paperTypeRef.current && !paperTypeRef.current.contains(e.target as Node)) {
        setPaperTypeOpen(false)
      }
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
        setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const togglePaperType = (type: string) => {
    setSelectedPaperTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleCountry = (country: string) => {
    setSelectedCountries(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    )
  }

  const buildParams = (): SearchParams => {
    // Quote multi-word phrases so APIs treat them as exact phrases, not separate keywords
    const quotePhrase = (s: string) => {
      const t = s.trim()
      return t.includes(' ') ? `"${t}"` : t
    }
    const indicationStr = indicationAlternates.length > 0
      ? `(${[params.indication, ...indicationAlternates].filter(Boolean).map(quotePhrase).join(' OR ')})`
      : quotePhrase(params.indication)
    return {
      ...params,
      indication: indicationStr,
      bibliographyType,
      paperType: selectedPaperTypes.join(','),
      country: selectedCountries.join(','),
      // Clear keywords/author for non-clinical (they're hidden in the UI)
      keywords: bibliographyType === 'clinical' ? params.keywords : '',
      author: bibliographyType === 'clinical' ? params.author : '',
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f7f9fc', border: '1.5px solid #dde3ef',
    borderRadius: 8, padding: '11px 14px', fontSize: 15, color: '#1a2035',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, color: '#5a6a8a', marginBottom: 6,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  const showCountry = bibliographyType !== 'clinical'

  return (
    <div style={{ background: '#fff', border: '1px solid #dde3ef', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 6px rgba(26,42,74,0.06)' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9aa5bf', marginBottom: 18, fontWeight: 600 }}>
        Search Parameters
      </div>

      {/* Bibliography Type — full width */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Bibliography Type</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BIB_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBibliographyType(opt.value)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${bibliographyType === opt.value ? '#1a3a6b' : '#dde3ef'}`,
                background: bibliographyType === opt.value ? '#1a3a6b' : '#f7f9fc',
                color: bibliographyType === opt.value ? '#fff' : '#5a6a8a',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row: Indication + Keywords + Author + Country/PaperType + DateRange + NegKeywords */}
      <div className="form-grid-2" style={{ marginBottom: 20 }}>
        <div style={{ gridColumn: bibliographyType !== 'clinical' ? '1 / -1' : undefined }}>
          <label style={labelStyle}>Indication / Condition</label>
          <input style={inputStyle} value={params.indication} onChange={set('indication')} placeholder="e.g. Crohn's disease" />
          {/* Indication alternates */}
          <div style={{ marginTop: 6 }}>
            {indicationAlternates.map((alt, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef3ff', color: '#1a3a6b', borderRadius: 16, padding: '3px 10px 3px 12px', fontSize: 12, fontWeight: 500, marginRight: 6, marginBottom: 4 }}>
                {alt}
                <button type="button" onClick={() => setIndicationAlternates(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a8aaa', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                const alt = prompt('Enter alternate spelling or synonym (e.g. "Crohn disease" or "CD"):')
                if (alt?.trim()) setIndicationAlternates(prev => [...prev, alt.trim()])
              }}
              style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 12, padding: '2px 0', fontWeight: 500 }}
            >
              ＋ Add alternate spelling
            </button>
          </div>
        </div>

        {bibliographyType === 'clinical' && (
          <div>
            <label style={labelStyle}>Keywords</label>
            <input style={inputStyle} value={params.keywords} onChange={set('keywords')} placeholder="e.g. biologic therapy" />
          </div>
        )}

        {/* Author — clinical only */}
        {bibliographyType === 'clinical' && (
          <div>
            <label style={labelStyle}>Author</label>
            <input style={inputStyle} value={params.author ?? ''} onChange={set('author')} placeholder="e.g. Smith J" />
          </div>
        )}

        {/* Country — only for non-clinical types */}
        {showCountry ? (
          <div ref={countryRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Country</label>
            <button
              type="button"
              onClick={() => setCountryOpen(o => !o)}
              style={{
                ...inputStyle, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: selectedCountries.length ? '#1a2035' : '#9aa5bf',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {selectedCountries.length === 0 ? 'Any country' : selectedCountries.length === 1 ? selectedCountries[0] : `${selectedCountries.length} countries selected`}
              </span>
              <span style={{ marginLeft: 8, fontSize: 11, color: '#9aa5bf' }}>{countryOpen ? '▲' : '▼'}</span>
            </button>
            {countryOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(26,42,74,0.12)', display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                  <input
                    autoFocus
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', border: '1.5px solid #dde3ef', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {UN_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).map(country => {
                    const checked = selectedCountries.includes(country)
                    return (
                      <label key={country} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                        color: checked ? '#1a2035' : '#5a6a8a',
                        background: checked ? '#f0f4ff' : 'transparent',
                        fontWeight: checked ? 600 : 400,
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCountry(country)} style={{ accentColor: '#1a3a6b', width: 14, height: 14, cursor: 'pointer' }} />
                        {country}
                      </label>
                    )
                  })}
                </div>
                {selectedCountries.length > 0 && (
                  <div style={{ borderTop: '1px solid #eee', padding: '6px 14px' }}>
                    <button type="button" onClick={() => setSelectedCountries([])} style={{ fontSize: 12, color: '#9aa5bf', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear selection</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Paper Type — shown for clinical */
          <div ref={paperTypeRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Paper Type</label>
            <button
              type="button"
              onClick={() => setPaperTypeOpen(o => !o)}
              style={{
                ...inputStyle, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: selectedPaperTypes.length ? '#1a2035' : '#9aa5bf',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {selectedPaperTypes.length === 0 ? 'Any type' : selectedPaperTypes.length === 1 ? selectedPaperTypes[0] : `${selectedPaperTypes.length} types selected`}
              </span>
              <span style={{ marginLeft: 8, fontSize: 11, color: '#9aa5bf' }}>{paperTypeOpen ? '▲' : '▼'}</span>
            </button>
            {paperTypeOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(26,42,74,0.12)', padding: '6px 0',
              }}>
                {PAPER_TYPE_OPTIONS.map(type => {
                  const checked = selectedPaperTypes.includes(type)
                  return (
                    <label key={type} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                      color: checked ? '#1a2035' : '#5a6a8a',
                      background: checked ? '#f0f4ff' : 'transparent',
                      fontWeight: checked ? 600 : 400,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePaperType(type)} style={{ accentColor: '#1a3a6b', width: 15, height: 15, cursor: 'pointer' }} />
                      {type}
                    </label>
                  )
                })}
                {selectedPaperTypes.length > 0 && (
                  <div style={{ borderTop: '1px solid #eee', padding: '6px 14px' }}>
                    <button type="button" onClick={() => setSelectedPaperTypes([])} style={{ fontSize: 12, color: '#9aa5bf', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear selection</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Date Range */}
        <div>
          <label style={labelStyle}>Date Range</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={{ ...inputStyle }} type="date" value={params.dateFrom} onChange={set('dateFrom')} />
            <input style={{ ...inputStyle }} type="date" value={params.dateTo} onChange={set('dateTo')} />
          </div>
        </div>

        {/* Negative Keywords — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Negative Keywords <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(comma-separated — multi-word phrases supported, e.g. "case report, animal study")</span></label>
          <input style={inputStyle} value={params.negativeKeywords ?? ''} onChange={set('negativeKeywords')} placeholder="e.g. animal, mouse, rat, in vitro" />
        </div>
      </div>

      <SourceSelector selected={params.sources} onChange={sources => setParams(p => ({ ...p, sources }))} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => onSearch(buildParams())}
          disabled={isLoading || (!params.indication && !params.keywords)}
          style={{
            background: '#1a3a6b', border: 'none', color: '#fff', padding: isMobile ? '10px 18px' : '12px 26px',
            borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading || (!params.indication && !params.keywords) ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {isLoading ? '⏳ Searching...' : '⚡ Run Search'}
        </button>
        <button
          onClick={() => onSave(buildParams())}
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
