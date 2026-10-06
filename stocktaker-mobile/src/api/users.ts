// Mirrors stocktaker-api/app/routers/users.py (the part the mobile app uses)
import { apiRequest } from './client'
import type { User } from '../types'

export function getMe(): Promise<User> {
  return apiRequest<User>('/users/me')
}
