// Mirrors stocktaker-api/app/routers/sites.py
import { apiRequest } from './client'
import type { Site } from '../types'

export function listSites(): Promise<Site[]> {
  return apiRequest<Site[]>('/sites')
}
