import { Navigate, Outlet } from 'react-router'
import { useMe } from './useAuth'
import styles from './auth.module.css'

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.status} role="status">
      {children}
    </div>
  )
}

/** Renders child routes only for a signed-in user; everyone else goes to /login. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useMe()

  if (isPending) return <Status>Loading…</Status>

  if (isError) {
    return (
      <div className={styles.status}>
        <p role="alert" className="alert">
          Couldn’t reach the server.
        </p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}

/** Login/register are for signed-out visitors; a signed-in user is sent to the app. */
export function GuestOnly() {
  const { data: user, isPending } = useMe()

  if (isPending) return <Status>Loading…</Status>
  return user ? <Navigate to="/" replace /> : <Outlet />
}
