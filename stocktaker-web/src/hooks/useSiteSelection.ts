// Shared by every page that needs a "which site am I looking at" filter
// (Dashboard, Items, Flagged items). The interesting bit is WHO gets to
// choose: an admin can see every site and switch between them (or view
// "All sites"), but a manager or worker is pinned to their own site - the
// dropdown doesn't even render for them, because there's nothing to
// choose. This mirrors the backend's `effective_site_filter` in
// app/deps.py exactly: even if a non-admin's request somehow specified a
// different site_id, the backend would ignore it and use their own site
// anyway. This hook keeps the frontend from ever generating a request
// that the backend would just override.

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listSites } from '../api/sites'
import type { Site } from '../types'

interface UseSiteSelectionResult {
  sites: Site[]
  selectedSiteId: number | undefined
  setSelectedSiteId: (id: number | undefined) => void
  /** True only for admins - they're the only role allowed to change this. */
  canChangeSite: boolean
}

export function useSiteSelection(): UseSiteSelectionResult {
  const { user } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(
    user?.role === 'admin' ? undefined : (user?.site_id ?? undefined),
  )

  useEffect(() => {
    listSites().then(setSites).catch(() => setSites([]))
  }, [])

  return {
    sites,
    selectedSiteId,
    setSelectedSiteId,
    canChangeSite: user?.role === 'admin',
  }
}
