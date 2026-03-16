import type { SourceResult, Bibliography, Paper } from '../types'
import ResultCard from './ResultCard'
import { exportToCSV, exportToExcel } from '../lib/export'
import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

interface Props {
  results: SourceResult[]
  totalCount: number
  bibliographies: Bibliography[]
  onAddToBibliography: (bibliographyId: number, paper: Paper) => Promise<void>
}

export default function ResultsList({ results, totalCount, bibliographies, onAddToBibliography }: Props) {
  const allPapers = results.flatMap(r => r.papers)
  const errors = results.filter(r => r.error)

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: '#5a6a8a' }}>
            <strong style={{ color: '#1a2035', fontSize: 16 }}>{totalCount} unique results</strong>{' '}across {results.filter(r => r.papers.length > 0).length} sources
          </div>
          {/* Per-source tallies */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {results.filter(r => r.papers.length > 0).map(r => {
              const color = SOURCE_COLORS[r.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
              return (
                <span key={r.source} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 500, background: color.bg, color: color.text }}>
                  {SOURCE_LABELS[r.source] ?? r.source} {r.papers.length}
                </span>
              )
            })}
          </div>
          {/* Errors */}
          {errors.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#c0392b' }}>
              ⚠ {errors.map(r => SOURCE_LABELS[r.source]).join(', ')} failed to respond
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => exportToCSV(allPapers)} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde3ef', background: '#fff', color: '#5a6a8a', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            ⬇ Export CSV
          </button>
          <button onClick={() => exportToExcel(allPapers)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#c8a84b', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            ⬇ Export Excel
          </button>
        </div>
      </div>

      {/* Result cards */}
      {allPapers.map(paper => (
        <ResultCard
          key={paper.id}
          paper={paper}
          bibliographies={bibliographies}
          onAddToBibliography={onAddToBibliography}
        />
      ))}
    </div>
  )
}
