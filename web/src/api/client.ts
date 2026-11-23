import type { Problem } from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Turns a problem-details body into one human-readable sentence. */
function describeProblem(problem: Problem | undefined, fallback: string): string {
  if (problem?.errors) {
    const messages = Object.values(problem.errors).flat()
    if (messages.length > 0) return messages.join(' ')
  }
  return problem?.detail ?? problem?.title ?? fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialised as the JSON request body. */
  json?: unknown
  signal?: AbortSignal
}

/**
 * Calls the API. Same-origin (the Vite dev server proxies /api), so the HttpOnly auth cookie is
 * sent automatically. Non-2xx responses throw {@link ApiError} with the server's message.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, signal } = options

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: json === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => undefined)
    throw new ApiError(response.status, describeProblem(problem as Problem | undefined, response.statusText || 'Request failed'))
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
