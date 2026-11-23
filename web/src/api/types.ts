export interface User {
  id: string
  email: string
}

export interface Todo {
  id: string
  title: string
  notes: string | null
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type TodoStatus = 'all' | 'active' | 'completed'

/** RFC 9457 problem details as returned by the API (validation errors add `errors`). */
export interface Problem {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}
