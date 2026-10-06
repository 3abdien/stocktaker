import { useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { useSiteSelection } from '../hooks/useSiteSelection'
import { useAuth } from '../auth/AuthContext'
import { listItems } from '../api/items'
import { listCategories } from '../api/categories'
import { SiteSelector } from '../components/SiteSelector'
import { NewItemModal } from '../components/NewItemModal'
import { StockActionModal } from '../components/StockActionModal'
import type { Item } from '../types'

export function ItemsPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const { sites, selectedSiteId, setSelectedSiteId, canChangeSite } = useSiteSelection()
  const categoriesAsync = useAsync(() => listCategories(), [])
  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  const itemsAsync = useAsync(
    () => listItems({ site_id: selectedSiteId, category_id: categoryId === 'all' ? undefined : categoryId }),
    [selectedSiteId, categoryId],
  )

  // Barcode/name search happens client-side against the already-fetched
  // list rather than hitting the API per keystroke - the backend's
  // `barcode` filter is an exact match (it's built for a scanner, not a
  // search box), and a site's item list is small enough that filtering
  // in the browser is simpler than debouncing a network request.
  const visibleItems = useMemo(() => {
    const items = itemsAsync.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q))
  }, [itemsAsync.data, search])

  const [showNewItem, setShowNewItem] = useState(false)
  const [actionItem, setActionItem] = useState<Item | null>(null)

  const categoryById = useMemo(() => {
    const map = new Map<number, string>()
    categoriesAsync.data?.forEach((c) => map.set(c.id, c.name))
    return map
  }, [categoriesAsync.data])

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h1>Items</h1>
        {canManage && <button onClick={() => setShowNewItem(true)}>+ Register new item</button>}
      </div>

      <div className="toolbar">
        <SiteSelector
          sites={sites}
          selectedSiteId={selectedSiteId}
          onChange={setSelectedSiteId}
          canChange={canChangeSite}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All categories</option>
          {categoriesAsync.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Search by name or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {itemsAsync.error && <p className="error-text">{itemsAsync.error}</p>}

      <table>
        <thead>
          <tr>
            <th>Barcode</th>
            <th>Name</th>
            <th>Category</th>
            <th>Quantity</th>
            <th>Location</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {!itemsAsync.loading && visibleItems.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-state">
                No items match.
              </td>
            </tr>
          )}
          {visibleItems.map((item) => (
            <tr key={item.id} className="clickable" onClick={() => setActionItem(item)}>
              <td>
                <code>{item.barcode}</code>
              </td>
              <td>{item.name}</td>
              <td className="muted">{categoryById.get(item.category_id) ?? item.category_id}</td>
              <td>
                {item.quantity} {item.unit}
                {item.is_low_stock && (
                  <span className="badge low-stock" style={{ marginLeft: 8 }}>
                    Low
                  </span>
                )}
              </td>
              <td className="muted">{item.location}</td>
              <td className="muted">Check in/out →</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showNewItem && (
        <NewItemModal
          categories={categoriesAsync.data ?? []}
          sites={sites}
          onClose={() => setShowNewItem(false)}
          onCreated={() => itemsAsync.reload()}
        />
      )}

      {actionItem && (
        <StockActionModal
          item={actionItem}
          onClose={() => setActionItem(null)}
          onDone={() => {
            setActionItem(null)
            itemsAsync.reload()
          }}
        />
      )}
    </div>
  )
}
