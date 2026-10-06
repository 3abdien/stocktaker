// Mirrors stocktaker-api/app/routers/users.py
import { apiRequest } from './client'
import type { User, UserCreate } from '../types'

export function getMe(): Promise<User> {
  return apiRequest<User>('/users/me')
}

export function listUsers(): Promise<User[]> {
  return apiRequest<User[]>('/users')
}

export function createUser(body: UserCreate): Promise<User> {
  return apiRequest<User>('/users', { method: 'POST', body: JSON.stringify(body) })
}

export function setUserActive(userId: number, active: boolean): Promise<User> {
  return apiRequest<User>(`/users/${userId}/active?active=${active}`, { method: 'PATCH' })
}
