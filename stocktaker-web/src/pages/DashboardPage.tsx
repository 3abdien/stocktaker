import { useAsync } from '../hooks/useAsync'
import { useSiteSelection } from '../hooks/useSiteSelection'
import { getSummary, getLowStock, downloadStockCsv, downloadTransactionsCsv } from '../api/dashboard'
import { SiteSelector } from '../components/SiteSelector'

export function DashboardPage() {
  const { sites, selectedSiteId, setSelectedSiteId, canChangeSite } = useSiteSelection()

  // Both calls are re-run automatically whenever `selectedSiteId` changes,
  // because it's in the dependency array - that's the whole reason
  // useAsync takes a deps array instead of just running once on mount.
  const summary = useAsync(() => getSummary(selectedSiteId), [selectedSiteId])
  const lowStock = useAsync(() => getLowStock(selectedSiteId), [selectedSiteId])

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h1>Dashboard</h1>
        <SiteSelector
          sites={sites}
          selectedSiteId={selectedSiteId}
          onChange={setSelectedSiteId}
          canChange={canChangeSite}
        />
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="value">{summary.data?.total_items ?? '—'}</div>
          <div className="label">Items tracked</div>
        </div>
        <div className="stat-card">
          <div className="value">{summary.data?.low_stock_count ?? '—'}</div>
          <div className="label">Low stock</div>
        </div>
        <div className="stat-card">
          <div className="value">{summary.data?.pending_reports_count ?? '—'}</div>
          <div className="label">Pending flagged items</div>
        </div>
      </div>

      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Low stock</h2>
        <button className="secondary" onClick={() => downloadStockCsv(selectedSiteId)}>
          Export stock CSV
        </button>
        <button className="secondary" onClick={() => downloadTransactionsCsv(selectedSiteId)}>
          Export transactions CSV
        </button>
      </div>

      {lowStock.error && <p className="error-text">{lowStock.error}</p>}

      <table>
        <thead>
          <tr>
            <th>Barcode</th>
            <th>Name</th>
            <th>Quantity</th>
            <th>Threshold</th>
          </tr>
        </thead>
        <tbody>
          {lowStock.data?.length === 0 && !lowStock.loading && (
            <tr>
              <td colSpan={4} className="empty-state">
                Nothing is low on stock right now.
              </td>
            </tr>
          )}
          {lowStock.data?.map((item) => (
            <tr key={item.id}>
              <td>
                <code>{item.barcode}</code>
              </td>
              <td>{item.name}</td>
              <td>
                {item.quantity} {item.unit}
              </td>
              <td>
                {item.min_stock} {item.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
