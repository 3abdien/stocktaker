import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { listCategories, createCategory } from '../api/categories'
import { ApiError } from '../api/client'

export function CategoriesPage() {
  const { user } = useAuth()
  const { data: categories, loading, error, reload } = useAsync(() => listCategories(), [])

  // Same rule the backend enforces in routers/categories.py - worker
  // accounts (mobile-app users who happen to also sign in to the web
  // dashboard) can look at categories but not create them.
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      // `code` is optional on the backend (it derives one from the name
      // if omitted) - send undefined rather than an empty string so that
      // derivation actually kicks in.
      await createCategory({ name, code: code || undefined, description })
      setName('')
      setCode('')
      setDescription('')
      setShowForm(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create category.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h1>Categories</h1>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ New category'}</button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, maxWidth: 380 }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Short code (optional - auto-derived if left blank)
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
          </label>
          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <th>Code</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {!loading && categories?.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-state">
                No categories yet.
              </td>
            </tr>
          )}
          {categories?.map((c) => (
            <tr key={c.id}>
              <td>
                <code>{c.code}</code>
              </td>
              <td>{c.name}</td>
              <td className="muted">{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
