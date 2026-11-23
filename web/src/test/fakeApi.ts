import { http, HttpResponse } from 'msw'
import type { Todo, User } from '../api/types'

export const VALID_PASSWORD = 'correct-password'
export const TAKEN_EMAIL = 'taken@example.com'

let counter = 0

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  counter += 1
  return {
    id: `todo-${counter}`,
    title: `Todo ${counter}`,
    notes: null,
    isCompleted: false,
    completedAt: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

export const problem = (status: number, title: string, detail?: string) =>
  HttpResponse.json({ title, detail, status }, { status })

interface Options {
  /** Signed-in user at start; null means signed out. */
  user?: User | null
  todos?: Todo[]
}

/**
 * A small stateful stand-in for the real API (same routes, status codes and problem-details shape),
 * so component tests exercise the real fetch client, caching and optimistic updates.
 * Mutate `state` in a test to simulate server-side changes (e.g. an expired session).
 */
export function createFakeApi({ user = null, todos = [] }: Options = {}) {
  const state = {
    user: user as User | null,
    todos: [...todos],
    /** "METHOD /path" for every request, in order. */
    requests: [] as string[],
    /** Parsed JSON bodies by "METHOD /path". */
    bodies: {} as Record<string, unknown>,
  }

  const record = async (request: Request) => {
    const { pathname } = new URL(request.url)
    const key = `${request.method} ${pathname}`
    state.requests.push(key)
    if (request.headers.get('content-type')?.includes('json')) {
      state.bodies[key] = await request.clone().json()
    }
  }

  const unauthorized = () => problem(401, 'Unauthorized')

  const handlers = [
    http.get('/api/auth/me', async ({ request }) => {
      await record(request)
      return state.user ? HttpResponse.json(state.user) : unauthorized()
    }),

    http.post('/api/auth/login', async ({ request }) => {
      await record(request)
      const { email, password } = (await request.json()) as { email: string; password: string }
      if (password !== VALID_PASSWORD) return problem(401, 'Invalid email or password.')
      state.user = { id: 'user-1', email }
      return HttpResponse.json(state.user)
    }),

    http.post('/api/auth/register', async ({ request }) => {
      await record(request)
      const { email } = (await request.json()) as { email: string }
      if (email === TAKEN_EMAIL) {
        return problem(409, 'Email already registered.', 'An account with this email already exists.')
      }
      state.user = { id: 'user-2', email }
      return HttpResponse.json(state.user, { status: 201 })
    }),

    http.post('/api/auth/logout', async ({ request }) => {
      await record(request)
      state.user = null
      return new HttpResponse(null, { status: 204 })
    }),

    http.get('/api/todos', async ({ request }) => {
      await record(request)
      return state.user ? HttpResponse.json(state.todos) : unauthorized()
    }),

    http.post('/api/todos', async ({ request }) => {
      await record(request)
      if (!state.user) return unauthorized()
      const { title, notes } = (await request.json()) as { title: string; notes?: string | null }
      const created = makeTodo({ title, notes: notes ?? null })
      state.todos = [created, ...state.todos]
      return HttpResponse.json(created, { status: 201 })
    }),

    // Registered before "/:id" so "completed" isn't read as an id.
    http.delete('/api/todos/completed', async ({ request }) => {
      await record(request)
      if (!state.user) return unauthorized()
      const before = state.todos.length
      state.todos = state.todos.filter((t) => !t.isCompleted)
      return HttpResponse.json({ deleted: before - state.todos.length })
    }),

    http.put('/api/todos/:id', async ({ request, params }) => {
      await record(request)
      if (!state.user) return unauthorized()
      const { title, notes } = (await request.json()) as { title: string; notes: string | null }
      const todo = state.todos.find((t) => t.id === params.id)
      if (!todo) return problem(404, 'Not Found')
      Object.assign(todo, { title, notes })
      return HttpResponse.json(todo)
    }),

    http.patch('/api/todos/:id', async ({ request, params }) => {
      await record(request)
      if (!state.user) return unauthorized()
      const { isCompleted } = (await request.json()) as { isCompleted: boolean }
      const todo = state.todos.find((t) => t.id === params.id)
      if (!todo) return problem(404, 'Not Found')
      Object.assign(todo, { isCompleted, completedAt: isCompleted ? '2026-01-02T10:00:00Z' : null })
      return HttpResponse.json(todo)
    }),

    http.delete('/api/todos/:id', async ({ request, params }) => {
      await record(request)
      if (!state.user) return unauthorized()
      const exists = state.todos.some((t) => t.id === params.id)
      if (!exists) return problem(404, 'Not Found')
      state.todos = state.todos.filter((t) => t.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]

  return { state, handlers }
}

export const signedInUser: User = { id: 'user-1', email: 'me@example.com' }
