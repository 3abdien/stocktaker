// Covers the frontend half of role-based access control: ProtectedRoute
// (see its own comment for why this is UX, not real security). Three
// scenarios:
//   1. No user at all -> redirected to /login.
//   2. Signed in, but the route requires a role they don't have -> shown
//      an in-app "no access" message (not silently redirected, and not a
//      blank screen).
//   3. Signed in with an allowed role -> the protected page renders.
//
// `useAuth` is mocked at the module level so each test can control exactly
// what "the current user" looks like without going through a real login
// flow or hitting the network.

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import * as AuthContextModule from './AuthContext'
import type { User } from '../types'

function renderProtected(user: User | null, roles?: User['role'][]) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/admin" element={<div>Secret admin content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const adminUser: User = { id: 1, username: 'alice', full_name: 'Alice', role: 'admin', site_id: null, active: true }
const workerUser: User = { id: 2, username: 'bob', full_name: 'Bob', role: 'worker', site_id: 1, active: true }

describe('ProtectedRoute', () => {
  it('redirects to /login when nobody is signed in', () => {
    renderProtected(null, ['admin'])

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument()
  })

  it('shows an access-denied message when the signed-in user lacks the required role', () => {
    renderProtected(workerUser, ['admin'])

    expect(screen.getByText(/don't have access/i)).toBeInTheDocument()
    expect(screen.getByText(/worker/i)).toBeInTheDocument()
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument()
  })

  it('renders the page when the signed-in user has an allowed role', () => {
    renderProtected(adminUser, ['admin'])

    expect(screen.getByText('Secret admin content')).toBeInTheDocument()
  })

  it('allows any signed-in user through when no roles are specified', () => {
    renderProtected(workerUser, undefined)

    expect(screen.getByText('Secret admin content')).toBeInTheDocument()
  })
})
