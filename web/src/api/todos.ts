import { api } from './client'
import type { Todo, TodoStatus } from './types'

export const listTodos = (status: TodoStatus = 'all') =>
  api<Todo[]>(`/todos?status=${status}`)

export const createTodo = (title: string, notes?: string | null) =>
  api<Todo>('/todos', { method: 'POST', json: { title, notes } })

export const updateTodo = (id: string, title: string, notes: string | null) =>
  api<Todo>(`/todos/${id}`, { method: 'PUT', json: { title, notes } })

export const setCompleted = (id: string, isCompleted: boolean) =>
  api<Todo>(`/todos/${id}`, { method: 'PATCH', json: { isCompleted } })

export const deleteTodo = (id: string) => api<void>(`/todos/${id}`, { method: 'DELETE' })

export const clearCompleted = () =>
  api<{ deleted: number }>('/todos/completed', { method: 'DELETE' })
