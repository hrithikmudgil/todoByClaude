import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { useLogin, useRegister } from './useAuth'
import styles from './auth.module.css'

type Mode = 'login' | 'register'

const copy = {
  login: {
    heading: 'Welcome back',
    sub: 'Log in to see your todos.',
    submit: 'Log in',
    pending: 'Logging in…',
    switchText: 'New here?',
    switchLink: 'Create an account',
    switchTo: '/register',
    passwordAutocomplete: 'current-password',
  },
  register: {
    heading: 'Create your account',
    sub: 'Keep your todos private to you.',
    submit: 'Create account',
    pending: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
    passwordAutocomplete: 'new-password',
  },
} as const

function AuthPage({ mode }: { mode: Mode }) {
  const text = copy[mode]
  const login = useLogin()
  const register = useRegister()
  const mutation = mode === 'login' ? login : register

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    // On success the cached user is set and GuestOnly redirects into the app.
    mutation.mutate({ email: email.trim(), password })
  }

  return (
    <main className={styles.shell}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>{text.heading}</h1>
        <p className={styles.sub}>{text.sub}</p>

        {mutation.isError && (
          <p role="alert" className="alert">
            {mutation.error.message}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete={text.passwordAutocomplete}
            required
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={128}
            // The hint describes the field; keeping it out of the <label> keeps the accessible name just "Password".
            aria-describedby={mode === 'register' ? 'password-hint' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' && (
            <small id="password-hint" className={styles.hint}>
              At least 8 characters.
            </small>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? text.pending : text.submit}
        </button>

        <p className={styles.switch}>
          {text.switchText} <Link to={text.switchTo}>{text.switchLink}</Link>
        </p>
      </form>
    </main>
  )
}

export const LoginPage = () => <AuthPage mode="login" />
export const RegisterPage = () => <AuthPage mode="register" />
