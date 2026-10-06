import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from './Modal'
import { checkIn, checkOut, adjustStock } from '../api/items'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Item } from '../types'

type Action = 'in' | 'out' | 'adjust'

interface StockActionModalProps {
  item: Item
  onClose: () => void
  onDone: () => void
}

export function StockActionModal({ item, onClose, onDone }: StockActionModalProps) {
  const { user } = useAuth()
  // Same restriction as the backend (routers/items.py requires
  // admin/manager for /adjust) - a worker can move stock but a recount
  // correction is an office decision.
  const canAdjust = user?.role === 'admin' || user?.role === 'manager'

  const [action, setAction] = useState<Action>('out')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const qty = Number(quantity)
      if (action === 'in') await checkIn(item.id, { quantity: qty, note })
      else if (action === 'out') await checkOut(item.id, { quantity: qty, note })
      else await adjustStock(item.id, { new_quantity: qty, note })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete that action.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      <p className="muted" style={{ marginTop: -8 }}>
        <code>{item.barcode}</code> · currently {item.quantity} {item.unit}
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
            <option value="out">Check OUT (take from inventory)</option>
            <option value="in">Check IN (add / return stock)</option>
            {canAdjust && <option value="adjust">Adjust to exact count (recount)</option>}
          </select>
        </label>

        <label>{action === 'adjust' ? 'New total quantity' : 'Quantity'}
          <input
            type="number"
            min={action === 'adjust' ? 0 : 0.01}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>

        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="reason / project" />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
