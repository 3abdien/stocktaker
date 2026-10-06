import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from './Modal'
import { createItem } from '../api/items'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Category, Item, Site } from '../types'

interface NewItemModalProps {
  categories: Category[]
  sites: Site[]
  onClose: () => void
  onCreated: (item: Item) => void
}

export function NewItemModal({ categories, sites, onClose, onCreated }: NewItemModalProps) {
  const { user } = useAuth()
  // Admins pick a site explicitly; managers can only ever register items
  // into their own site, so there's nothing to pick - the backend would
  // reject any other site_id from them anyway (see app/deps.py's
  // require_site_access), so we don't offer the illusion of a choice.
  const isAdmin = user?.role === 'admin'

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>(categories[0]?.id ?? '')
  const [siteId, setSiteId] = useState<number | ''>(isAdmin ? (sites[0]?.id ?? '') : (user?.site_id ?? ''))
  const [barcode, setBarcode] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('pcs')
  const [location, setLocation] = useState('')
  const [minStock, setMinStock] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [createdBarcode, setCreatedBarcode] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (categoryId === '' || siteId === '') {
      setError('Choose a category and a site.')
      return
    }
    setSubmitting(true)
    try {
      const item = await createItem({
        name,
        category_id: categoryId,
        site_id: siteId,
        barcode: barcode.trim() || undefined,
        initial_quantity: Number(quantity) || 0,
        unit,
        location,
        min_stock: Number(minStock) || 0,
      })
      onCreated(item)
      // If we auto-generated a barcode, show it before closing - that's
      // the number someone needs to write on the item's physical label.
      if (!barcode.trim()) {
        setCreatedBarcode(item.barcode)
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register the item.')
    } finally {
      setSubmitting(false)
    }
  }

  if (createdBarcode) {
    return (
      <Modal title="Item registered" onClose={onClose}>
        <p>
          No barcode was given, so one was generated:
          <br />
          <code style={{ fontSize: 18 }}>{createdBarcode}</code>
        </p>
        <p className="muted">Print a label with this code and attach it to the item.</p>
        <div className="form-actions">
          <button onClick={onClose}>Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Register new item" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label>
          Item name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <label>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>

        {isAdmin ? (
          <label>
            Site
            <select value={siteId} onChange={(e) => setSiteId(Number(e.target.value))} required>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Site
            <input value={sites.find((s) => s.id === siteId)?.name ?? ''} disabled />
          </label>
        )}

        <label>
          Barcode (leave blank to auto-generate + print a label)
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. an existing manufacturer barcode" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Initial quantity
            <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="aisle / shelf" />
          </label>
          <label>
            Low-stock threshold
            <input type="number" min="0" step="any" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Registering…' : 'Register item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
