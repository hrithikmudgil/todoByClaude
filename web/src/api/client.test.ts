import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { api, ApiError } from './client'

describe('api client', () => {
  it('parses JSON responses', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.json({ ok: true })))

    expect(await api<{ ok: boolean }>('/thing')).toEqual({ ok: true })
  })

  it('returns undefined for 204 No Content', async () => {
    server.use(http.delete('/api/thing', () => new HttpResponse(null, { status: 204 })))

    expect(await api<void>('/thing', { method: 'DELETE' })).toBeUndefined()
  })

  it('sends the body as JSON with a content type', async () => {
    let seen: { contentType: string | null; body: unknown } | undefined
    server.use(
      http.post('/api/thing', async ({ request }) => {
        seen = { contentType: request.headers.get('content-type'), body: await request.json() }
        return HttpResponse.json({})
      }),
    )

    await api('/thing', { method: 'POST', json: { a: 1 } })

    expect(seen).toEqual({ contentType: 'application/json', body: { a: 1 } })
  })

  it('throws an ApiError carrying the status and the problem detail', async () => {
    server.use(
      http.get('/api/thing', () => HttpResponse.json({ title: 'Conflict', detail: 'Already exists.', status: 409 }, { status: 409 })),
    )

    const error = await api('/thing').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Already exists.' })
  })

  it('joins validation errors into one readable message', async () => {
    server.use(
      http.post('/api/thing', () =>
        HttpResponse.json(
          { title: 'One or more validation errors occurred.', errors: { Title: ['Title is required.'], Notes: ['Notes too long.'] } },
          { status: 400 },
        ),
      ),
    )

    const error = await api('/thing', { method: 'POST', json: {} }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 400, message: 'Title is required. Notes too long.' })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    server.use(http.get('/api/thing', () => new HttpResponse('<html>boom</html>', { status: 502, statusText: 'Bad Gateway' })))

    const error = await api('/thing').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('reports an unreachable server as status 0 with a friendly message', async () => {
    server.use(http.get('/api/thing', () => HttpResponse.error()))

    const error = await api('/thing').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0 })
    expect((error as ApiError).message).toMatch(/could not reach the server/i)
  })
})
