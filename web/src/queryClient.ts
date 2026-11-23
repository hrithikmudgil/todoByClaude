import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'
import { meKey } from './features/auth/useAuth'

interface Options {
  /** Tests turn retries off so failures surface immediately. */
  retry?: boolean
}

export function createQueryClient({ retry = true }: Options = {}): QueryClient {
  // If the session expires mid-use, any 401 flips the cached user to "signed out"
  // and RequireAuth sends the person to the login page.
  const onUnauthorized = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      client.setQueryData(meKey, null)
    }
  }

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onUnauthorized }),
    mutationCache: new MutationCache({ onError: onUnauthorized }),
    defaultOptions: {
      queries: {
        // Don't retry client errors (4xx); do retry flaky network/server errors a couple of times.
        retry: retry
          ? (failureCount, error) =>
              failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500)
          : false,
        refetchOnWindowFocus: true,
      },
    },
  })

  return client
}
