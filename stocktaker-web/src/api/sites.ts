// Mirrors stocktaker-api/app/routers/sites.py
import { apiRequest } from './client'
import type { Site, SiteCreate } from '../types'

export function listSites(): Promise<Site[]> {
  return apiRequest<Site[]>('/sites')
}

export function createSite(body: SiteCreate): Promise<Site> {
  return apiRequest<Site>('/sites', { method: 'POST', body: JSON.stringify(body) })
}
