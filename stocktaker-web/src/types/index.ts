// These types mirror the backend's Pydantic schemas one-for-one
// (see stocktaker-api/app/schemas.py). Keeping them in a single file, in
// the same shape and order as the backend, means anyone comparing the two
// side by side can see immediately that nothing was lost in translation -
// and it's the file you'd point to first in an interview to explain how
// the frontend and backend agree on a "contract" without sharing code.

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

export interface SiteCreate {
  name: string
  address?: string
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

export interface UserCreate {
  username: string
  password: string
  full_name?: string
  role: UserRole
  site_id?: number | null
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface Category {
  id: number
  name: string
  code: string
  description: string
}

export interface CategoryCreate {
  name: string
  code?: string
  description?: string
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

export interface ItemCreate {
  name: string
  category_id: number
  site_id: number
  barcode?: string | null // omit to let the backend auto-generate one
  initial_quantity?: number
  unit?: string
  location?: string
  min_stock?: number
  notes?: string
}

export interface StockActionRequest {
  quantity: number
  note?: string
}

export interface AdjustRequest {
  new_quantity: number
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
  timestamp: string // ISO 8601 - keep as string, format only where displayed
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

export interface ReportResolveRequest {
  name: string
  category_id: number
  initial_quantity?: number
  unit?: string
  location?: string
  min_stock?: number
}

export interface ReportRejectRequest {
  reason: string
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  total_items: number
  low_stock_count: number
  pending_reports_count: number
}
