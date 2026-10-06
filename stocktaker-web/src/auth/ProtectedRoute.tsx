// A route guard, used in App.tsx's route table like:
//
//   <Route element={<ProtectedRoute />}>
//     <Route path="/" element={<DashboardPage />} />
//   </Route>
//   <Route element={<ProtectedRoute roles={['admin']} />}>
//     <Route path="/admin" element={<AdminPage />} />
//   </Route>
//
// This is the FRONTEND half of role enforcement - it hides pages someone
// shouldn't see and gives a clear message instead of a confusing blank
// screen or a raw 403 from a failed fetch. It is explicitly NOT the
// security boundary: that's the backend (see stocktaker-api's
// app/deps.py), which checks the same roles server-side on every request
// regardless of what this component does. A curious user could technically
// bypass this with dev tools, but every API call they made would still
// get rejected by the API with a real 403. Worth saying out loud in an
// interview: never trust a frontend route guard as your only access
// control.

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  /** If omitted, any signed-in user may see the page. */
  roles?: UserRole[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="full-page-status">
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="full-page-status">
        <h2>You don't have access to this page</h2>
        <p>
          This area is restricted to {roles.join(' or ')} accounts. You're signed in as{' '}
          <strong>{user.role}</strong>.
        </p>
      </div>
    )
  }

  return <Outlet />
}
