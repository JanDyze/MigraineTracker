import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Glyph } from './Glyph'

const tabs = [
  { to: '/', label: 'Today', icon: 'wave' },
  { to: '/diary', label: 'Journal', icon: 'book' },
  { to: '/patterns', label: 'Patterns', icon: 'patterns' },
]

/** App shell: content above a floating pill nav whose highlight glides between tabs. */
export function Layout() {
  const { pathname } = useLocation()
  const active = tabs.findIndex((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)))
  return (
    <div className="shell">
      {/* keyed by path so each page drifts in when you switch tabs */}
      <main className="content" key={pathname}>
        <Outlet />
      </main>
      <nav className="nav" aria-label="Main" style={{ '--i': Math.max(active, 0) } as CSSProperties}>
        {active >= 0 && <span className="nav-glide" aria-hidden="true" />}
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="nav-tab">
            <Glyph name={t.icon} size={20} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
