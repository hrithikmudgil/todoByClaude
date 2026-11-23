import { setupServer } from 'msw/node'

/** One MSW server for the whole test run; each test installs its own handlers via `server.use`. */
export const server = setupServer()
