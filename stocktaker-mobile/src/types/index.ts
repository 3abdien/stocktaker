// These types mirror the backend's Pydantic schemas (see
// stocktaker-api/app/schemas.py), same as stocktaker-web/src/types. The
// mobile app only needs the subset a warehouse worker touches: auth, the
// signed-in user, sites, items, stock movements, and flagged reports.

export type UserRole = 'admin' | 'manager' | 'worker'

export type TransactionType = 'check_in' | 'check_out' | 'adjustment' | 'created'

export type ReportStatus = 'pending' | 'resolved' | 'rejected'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export interface Site {
  id: number
  name: string
  address: string
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: number
  username: string
  full_name: string
  role: UserRole
  site_id: number | null
  active: boolean
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface Item {
  id: number
  barcode: string
  name: string
  category_id: number
  site_id: number
  quantity: number
  unit: string
  location: string
  min_stock: number
  notes: string
  is_low_stock: boolean
}

export interface StockActionRequest {
  quantity: number
  note?: string
}

export interface Transaction {
  id: number
  item_id: number
  user_id: number
  type: TransactionType
  quantity_delta: number
  resulting_quantity: number
  note: string
  timestamp: string // ISO 8601
}

// ---------------------------------------------------------------------------
// Unidentified item reports (the flag-for-review workflow)
// ---------------------------------------------------------------------------

export interface UnidentifiedReport {
  id: number
  barcode: string
  photo_path: string
  note: string
  site_id: number
  reported_by: number
  reported_at: string
  status: ReportStatus
  resolved_item_id: number | null
  resolved_by: number | null
  resolved_at: string | null
  rejection_reason: string | null
}
