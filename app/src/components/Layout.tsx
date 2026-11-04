import { useEffect, useState, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Glyph } from './Glyph'

const tabs = [
  { to: '/', label: 'Today', icon: 'home' },
  { to: '/diary', label: 'Journal', icon: 'book' },
  { to: '/patterns', label: 'Patterns', icon: 'bars' },
]

/** True once the page is scrolled to its end (or is too short to scroll at all). */
function useAtEnd(pathname: string) {
  const [atEnd, setAtEnd] = useState(true)
  useEffect(() => {
    const check = () => setAtEnd(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    // pages grow when their data arrives, without any scrolling
    const grow = new ResizeObserver(check)
    grow.observe(document.body)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      grow.disconnect()
    }
  }, [pathname])
  return atEnd
}

/**
 * App shell: content above the tab bar, whose highlight glides between tabs. While there's more
 * page below, the bar sits docked flat along the bottom edge; at the end of the page it lifts off
 * into a floating pill.
 */
export function Layout() {
  const { pathname } = useLocation()
  const active = tabs.findIndex((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)))
  const atEnd = useAtEnd(pathname)
  return (
    <div className="shell">
      {/* keyed by path so each page drifts in when you switch tabs */}
      <main className="content" key={pathname}>
        <Outlet />
      </main>
      <nav className={`nav${atEnd ? '' : ' is-docked'}`} aria-label="Main" style={{ '--i': Math.max(active, 0) } as CSSProperties}>
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
