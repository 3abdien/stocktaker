// Admin-only: managing sites (the company's physical locations/warehouses)
// and user accounts. This page is only reachable at all because App.tsx
// wraps its route in <ProtectedRoute roles={['admin']}> - see that file and
// the comment in ProtectedRoute.tsx for why that's a UX convenience, not
// the real access control (the backend enforces the same "admin only" rule
// on every /sites and /users write endpoint independently).

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAsync } from '../hooks/useAsync'
import { listSites, createSite } from '../api/sites'
import { listUsers, createUser, setUserActive } from '../api/users'
import { ApiError } from '../api/client'
import type { UserRole } from '../types'

type Section = 'sites' | 'users'

export function AdminPage() {
  const [section, setSection] = useState<Section>('sites')

  return (
    <div>
      <h1>Administration</h1>
      <div className="tabs">
        <button className={section === 'sites' ? 'active' : ''} onClick={() => setSection('sites')}>
          Sites
        </button>
        <button className={section === 'users' ? 'active' : ''} onClick={() => setSection('users')}>
          Users
        </button>
      </div>

      {section === 'sites' ? <SitesSection /> : <UsersSection />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

function SitesSection() {
  const { data: sites, error, reload } = useAsync(() => listSites(), [])

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await createSite({ name, address })
      setName('')
      setAddress('')
      setShowForm(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create site.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ flex: 1 }}>Sites</h2>
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New site'}</button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, maxWidth: 380 }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          {formError && <p className="error-text">{formError}</p>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {sites?.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="muted">{s.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const ROLES: UserRole[] = ['worker', 'manager', 'admin']

function UsersSection() {
  const { data: users, error, reload } = useAsync(() => listUsers(), [])
  const { data: sites } = useAsync(() => listSites(), [])

  const [showForm, setShowForm] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('worker')
  const [siteId, setSiteId] = useState<number | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      // Admin accounts see every site, so `site_id` is meaningless for
      // them - only send it for manager/worker roles, which the backend
      // requires to be scoped to exactly one site (see UserCreate
      // validation in stocktaker-api/app/schemas.py).
      await createUser({
        username,
        password,
        full_name: fullName,
        role,
        site_id: role === 'admin' ? null : siteId === '' ? null : siteId,
      })
      setUsername('')
      setPassword('')
      setFullName('')
      setRole('worker')
      setSiteId('')
      setShowForm(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(userId: number, currentlyActive: boolean) {
    try {
      await setUserActive(userId, !currentlyActive)
      reload()
    } catch {
      // A best-effort action from a table row - if it fails, the row just
      // won't change and the admin can try again; no need for a modal.
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ flex: 1 }}>Users</h2>
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New user'}</button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, maxWidth: 420 }}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </label>
          <label>
            Temporary password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {role !== 'admin' && (
            <label>
              Site
              <select value={siteId} onChange={(e) => setSiteId(Number(e.target.value))} required>
                <option value="" disabled>
                  Choose a site…
                </option>
                {sites?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {formError && <p className="error-text">{formError}</p>}
          <div className="form-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Full name</th>
            <th>Role</th>
            <th>Site</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td className="muted">{u.full_name}</td>
              <td>{u.role}</td>
              <td className="muted">{sites?.find((s) => s.id === u.site_id)?.name ?? '—'}</td>
              <td>
                <span className={`badge ${u.active ? 'ok' : 'rejected'}`}>{u.active ? 'active' : 'disabled'}</span>
              </td>
              <td>
                <button className="secondary" onClick={() => toggleActive(u.id, u.active)}>
                  {u.active ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
