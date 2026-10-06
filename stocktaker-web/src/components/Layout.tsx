// The shared shell every signed-in page renders inside: a sidebar with
// role-aware navigation, and an <Outlet /> where React Router drops in
// whichever page matched the current URL. Putting this ABOVE the route
// table (rather than repeating a <nav> inside every page) is what makes
// "add a new page" a one-line change in App.tsx instead of copy-pasting
// navigation markup everywhere.

import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Stocktaker</div>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/items">Items</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <NavLink to="/reports">Flagged items</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}
        </nav>

        <div className="user-box">
          <strong>{user?.full_name || user?.username}</strong>
          {user?.role}
          <div style={{ marginTop: 8 }}>
            <button className="secondary" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
