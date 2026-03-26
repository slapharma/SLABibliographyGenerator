import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBibliographies, listSavedSearches, listHistory } from '../lib/api'
import type { Bibliography, SavedSearch, HistoryEntry } from '../types'

export default function HomePage() {
  const navigate = useNavigate()
  const [bibs, setBibs] = useState<Bibliography[]>([])
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([listBibliographies(), listSavedSearches(), listHistory()])
      .then(([b, s, h]) => {
        if (b.status === 'fulfilled') setBibs(b.value)
        if (s.status === 'fulfilled') setSaved(s.value)
        if (h.status === 'fulfilled') setHistory(h.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const totalPapers = bibs.reduce((sum, b) => sum + (b.paperCount ?? 0), 0)
  const recentBibs = [...bibs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5)
  const recentHistory = [...history].sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()).slice(0, 4)

  return (
    <div className="page-content" style={{ fontFamily: 'Montserrat, system-ui, sans-serif', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#1a2035', marginBottom: 6 }}>Dashboard</div>
        <div style={{ fontSize: 14, color: '#7a8aaa' }}>Welcome to SLA Bibliography Generator</div>
      </div>

      {/* Search Now CTA */}
      <button
        onClick={() => navigate('/search')}
        style={{
          width: '100%', padding: '22px 32px', border: 'none', borderRadius: 14,
          background: 'linear-gradient(135deg, #1a2a4a 0%, #2a4080 100%)',
          color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          marginBottom: 28, boxShadow: '0 4px 18px rgba(26,42,74,0.18)',
          letterSpacing: '0.01em',
        }}
      >
        <span style={{ fontSize: 26 }}>🔍</span>
        Search Clinical Literature
        <span style={{ fontSize: 14, opacity: 0.7, fontWeight: 400, marginLeft: 4 }}>→</span>
      </button>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="📚" label="Bibliographies" value={loading ? '—' : bibs.length} color="#1a3a6b" onClick={() => navigate('/bibliographies')} />
        <StatCard icon="📄" label="Total Papers" value={loading ? '—' : totalPapers} color="#2e7d32" />
        <StatCard icon="⭐" label="Saved Searches" value={loading ? '—' : saved.length} color="#c8a84b" onClick={() => navigate('/saved-searches')} />
        <StatCard icon="🕐" label="Searches Run" value={loading ? '—' : history.length} color="#7b3fa0" onClick={() => navigate('/history')} />
      </div>

      {/* Two column: recent bibs + recent history */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Recent Bibliographies */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', padding: '20px 22px', boxShadow: '0 1px 4px rgba(26,42,74,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2035' }}>Recent Bibliographies</div>
            <button onClick={() => navigate('/bibliographies')} style={{ background: 'none', border: 'none', color: '#1a3a6b', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              View all →
            </button>
          </div>
          {loading ? (
            <div style={{ color: '#9aa5bf', fontSize: 13 }}>Loading...</div>
          ) : recentBibs.length === 0 ? (
            <div style={{ color: '#9aa5bf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No bibliographies yet.<br />
              <button onClick={() => navigate('/search')} style={{ marginTop: 8, background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Start searching →
              </button>
            </div>
          ) : (
            recentBibs.map(b => (
              <div
                key={b.id}
                onClick={() => navigate(`/bibliographies/${b.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f2f7', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2035' }}>{b.name}</div>
                  {b.creatorName && <div style={{ fontSize: 11, color: '#9aa5bf' }}>by {b.creatorName}</div>}
                </div>
                <div style={{ fontSize: 12, color: '#7a8aaa', textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 600 }}>{b.paperCount} paper{b.paperCount !== 1 ? 's' : ''}</div>
                  <div>{new Date(b.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Search History */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', padding: '20px 22px', boxShadow: '0 1px 4px rgba(26,42,74,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2035' }}>Recent Searches</div>
            <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', color: '#1a3a6b', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              View all →
            </button>
          </div>
          {loading ? (
            <div style={{ color: '#9aa5bf', fontSize: 13 }}>Loading...</div>
          ) : recentHistory.length === 0 ? (
            <div style={{ color: '#9aa5bf', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No searches yet.
            </div>
          ) : (
            recentHistory.map(h => (
              <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f7' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2035', marginBottom: 2 }}>
                  {h.params.indication || h.params.keywords || 'Unnamed search'}
                </div>
                <div style={{ fontSize: 11, color: '#9aa5bf', display: 'flex', gap: 10 }}>
                  <span>{h.resultCount} results</span>
                  <span>{new Date(h.searchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 20 }}>
        <QuickAction icon="📚" label="New Bibliography" sub="Create a named collection" onClick={() => navigate('/bibliographies')} />
        <QuickAction icon="⭐" label="Saved Searches" sub="Re-run a saved search" onClick={() => navigate('/saved-searches')} />
        <QuickAction icon="🕐" label="Search History" sub="Browse past searches" onClick={() => navigate('/history')} />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, onClick }: { icon: string; label: string; value: number | string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', padding: '18px 20px',
        boxShadow: '0 1px 4px rgba(26,42,74,0.06)', cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(26,42,74,0.12)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(26,42,74,0.06)' }}
    >
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function QuickAction({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 12, border: '1.5px solid #dde3ef', padding: '16px 18px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 1px 4px rgba(26,42,74,0.06)', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(26,42,74,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(26,42,74,0.06)' }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2035' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#9aa5bf' }}>{sub}</div>
      </div>
    </div>
  )
}
