// The "flag for review" workflow, from the requirements spec: a warehouse
// worker scans a barcode the system doesn't recognise, the mobile app makes
// them take a photo of the item and submits an UnidentifiedReport, and it
// shows up here for an admin/manager to either RESOLVE it (register it as a
// real item - the report's barcode becomes that item's barcode) or REJECT
// it (bad photo, duplicate, not actually inventory) with a reason the
// original reporter can see. This page is the office side of that loop.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAsync } from '../hooks/useAsync'
import { useSiteSelection } from '../hooks/useSiteSelection'
import { useAuth } from '../auth/AuthContext'
import { listReports, resolveReport, rejectReport } from '../api/reports'
import { listCategories } from '../api/categories'
import { ApiError } from '../api/client'
import { SiteSelector } from '../components/SiteSelector'
import { Modal } from '../components/Modal'
import { ReportPhoto } from '../components/ReportPhoto'
import type { ReportStatus, UnidentifiedReport } from '../types'

const TABS: { key: ReportStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Rejected' },
]

export function ReportsPage() {
  const { user } = useAuth()
  const canAct = user?.role === 'admin' || user?.role === 'manager'

  const { sites, selectedSiteId, setSelectedSiteId, canChangeSite } = useSiteSelection()
  const [status, setStatus] = useState<ReportStatus>('pending')

  const reportsAsync = useAsync(
    () => listReports({ status, site_id: selectedSiteId }),
    [status, selectedSiteId],
  )
  const categoriesAsync = useAsync(() => listCategories(), [])

  const [resolving, setResolving] = useState<UnidentifiedReport | null>(null)
  const [rejecting, setRejecting] = useState<UnidentifiedReport | null>(null)

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h1>Flagged items</h1>
        <SiteSelector
          sites={sites}
          selectedSiteId={selectedSiteId}
          onChange={setSelectedSiteId}
          canChange={canChangeSite}
        />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={status === t.key ? 'active' : ''}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportsAsync.error && <p className="error-text">{reportsAsync.error}</p>}

      {!reportsAsync.loading && reportsAsync.data?.length === 0 && (
        <p className="empty-state">No {status} reports.</p>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {reportsAsync.data?.map((report) => (
          <div key={report.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ReportPhoto storedName={report.photo_path} alt={`Scanned barcode ${report.barcode}`} className="report-thumb" />

            <div style={{ flex: 1 }}>
              <div>
                <code>{report.barcode}</code>{' '}
                <span className={`badge ${report.status}`}>{report.status}</span>
              </div>
              {report.note && <p className="muted" style={{ margin: '4px 0 0' }}>{report.note}</p>}
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                Reported {new Date(report.reported_at).toLocaleString()}
              </p>
              {report.status === 'rejected' && report.rejection_reason && (
                <p className="error-text" style={{ margin: '4px 0 0' }}>Reason: {report.rejection_reason}</p>
              )}
            </div>

            {canAct && report.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => setRejecting(report)}>
                  Reject
                </button>
                <button onClick={() => setResolving(report)}>Resolve</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {resolving && (
        <ResolveReportModal
          report={resolving}
          categories={categoriesAsync.data ?? []}
          onClose={() => setResolving(null)}
          onDone={() => {
            setResolving(null)
            reportsAsync.reload()
          }}
        />
      )}

      {rejecting && (
        <RejectReportModal
          report={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            reportsAsync.reload()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resolve: turns the report into a real Item. The backend (see
// routers/reports.py) creates the item using the report's own barcode and
// site, then marks the report resolved and links resolved_item_id to it -
// so this form only needs to ask for what the report itself doesn't already
// know: the item's name, category, and starting stock details.
// ---------------------------------------------------------------------------

interface ResolveReportModalProps {
  report: UnidentifiedReport
  categories: { id: number; name: string; code: string }[]
  onClose: () => void
  onDone: () => void
}

function ResolveReportModal({ report, categories, onClose, onDone }: ResolveReportModalProps) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>(categories[0]?.id ?? '')
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('pcs')
  const [location, setLocation] = useState('')
  const [minStock, setMinStock] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (categoryId === '') {
      setError('Choose a category.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await resolveReport(report.id, {
        name,
        category_id: categoryId,
        initial_quantity: Number(quantity) || 0,
        unit,
        location,
        min_stock: Number(minStock) || 0,
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve this report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Resolve ${report.barcode}`} onClose={onClose}>
      <ReportPhoto storedName={report.photo_path} alt="Reported item" />

      <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Starting quantity
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
            {submitting ? 'Saving…' : 'Register item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Reject: no new item, just a reason - the mobile app shows this back to
// whoever reported it via GET /reports/unidentified/mine, so it should be
// worded as feedback to a coworker, not an internal note.
// ---------------------------------------------------------------------------

interface RejectReportModalProps {
  report: UnidentifiedReport
  onClose: () => void
  onDone: () => void
}

function RejectReportModal({ report, onClose, onDone }: RejectReportModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await rejectReport(report.id, { reason })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject this report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Reject ${report.barcode}`} onClose={onClose}>
      <ReportPhoto storedName={report.photo_path} alt="Reported item" />

      <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
        <label>
          Reason (shown to the person who reported it)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="e.g. duplicate of an existing item, photo unreadable, not inventory"
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="danger" disabled={submitting}>
            {submitting ? 'Saving…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
