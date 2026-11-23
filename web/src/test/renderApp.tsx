import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import App from '../App'
import { createQueryClient } from '../queryClient'
import type { createFakeApi } from './fakeApi'
import { server } from './server'

/** Renders the whole app at `route`, backed by the given fake API. */
export function renderApp(api: ReturnType<typeof createFakeApi>, route = '/') {
  server.use(...api.handlers)
  const queryClient = createQueryClient({ retry: false })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { user: userEvent.setup(), queryClient }
}
