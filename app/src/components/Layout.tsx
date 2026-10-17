import { NavLink, Outlet } from 'react-router-dom'
import { Glyph } from './Glyph'

const tabs = [
  { to: '/', label: 'Today', icon: 'sun' },
  { to: '/diary', label: 'Record', icon: 'diary' },
  { to: '/patterns', label: 'Findings', icon: 'patterns' },
]

/** App shell: content above a ruler-edged tab bar, with the red record button at the end. */
export function Layout() {
  return (
    <div className="shell">
      <main className="content">
        <Outlet />
      </main>
      <nav className="nav" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="nav-tab">
            <Glyph name={t.icon} size={22} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <NavLink to="/log" className="nav-log" aria-label="Log a migraine">
          <Glyph name="plus" size={26} />
        </NavLink>
      </nav>
    </div>
  )
}
