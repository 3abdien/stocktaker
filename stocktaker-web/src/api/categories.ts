// Mirrors stocktaker-api/app/routers/categories.py
import { apiRequest } from './client'
import type { Category, CategoryCreate } from '../types'

export function listCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/categories')
}

export function createCategory(body: CategoryCreate): Promise<Category> {
  return apiRequest<Category>('/categories', { method: 'POST', body: JSON.stringify(body) })
}
