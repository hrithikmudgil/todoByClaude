import { api, ApiError } from './client'
import type { User } from './types'

/** The signed-in user, or null when there is no valid session (a 401 is an answer, not an error). */
export async function getMe(): Promise<User | null> {
  try {
    return await api<User>('/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const register = (email: string, password: string) =>
  api<User>('/auth/register', { method: 'POST', json: { email, password } })

export const login = (email: string, password: string) =>
  api<User>('/auth/login', { method: 'POST', json: { email, password } })

export const logout = () => api<void>('/auth/logout', { method: 'POST' })
