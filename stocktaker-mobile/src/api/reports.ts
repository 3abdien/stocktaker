// Mirrors stocktaker-api/app/routers/reports.py (the worker-facing part)
import { apiRequest } from './client'
import type { UnidentifiedReport } from '../types'

export interface FlagItemInput {
  barcode: string
  siteId: number
  note: string
  photoUri: string // local file URI from the camera
}

/** Flags an unrecognised barcode for the office to review. The endpoint
 *  takes multipart form data because the photo is required. */
export function flagUnidentifiedItem(input: FlagItemInput): Promise<UnidentifiedReport> {
  const form = new FormData()
  form.append('barcode', input.barcode)
  form.append('site_id', String(input.siteId))
  form.append('note', input.note)
  // React Native's FormData accepts a {uri, name, type} descriptor for a
  // local file and streams it from disk; the DOM typings don't know that.
  form.append('photo', {
    uri: input.photoUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob)

  return apiRequest<UnidentifiedReport>('/reports/unidentified', { method: 'POST', body: form })
}

export function myReports(): Promise<UnidentifiedReport[]> {
  return apiRequest<UnidentifiedReport[]>('/reports/unidentified/mine')
}

export function photoUrlPath(storedName: string): string {
  return `/photos/${encodeURIComponent(storedName)}`
}
