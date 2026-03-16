import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/search', icon: '🔍', label: 'Search' },
  { to: '/bibliographies', icon: '📚', label: 'Bibliographies' },
  { to: '/saved-searches', icon: '⭐', label: 'Saved Searches' },
  { to: '/history', icon: '🕐', label: 'History' },
]

export default function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#1a2a4a', display: 'flex', flexDirection: 'column',
        flexShrink: 0, color: '#fff',
      }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontFamily: '"Montserrat", system-ui, sans-serif', fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
            SLA Bibliography<br />Generator
          </div>
          <div style={{ fontSize: 11, color: '#c8a84b', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>
            Clinical Literature
          </div>
          <div style={{ width: 36, height: 2.5, background: '#c8a84b', borderRadius: 2, marginTop: 10 }} />
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px 8px', flex: 1 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', padding: '0 10px', marginBottom: 8 }}>
            Navigation
          </div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderRadius: 8, textDecoration: 'none', fontSize: 14, marginBottom: 3,
                color: isActive ? '#fff' : '#a8bcda',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              })}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          SLA Pharma Group
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f4f6fb' }}>
        <Outlet />
      </main>
    </div>
  )
}
