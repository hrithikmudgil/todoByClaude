import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createFakeApi, makeTodo, signedInUser, TAKEN_EMAIL, VALID_PASSWORD } from '../../test/fakeApi'
import { renderApp } from '../../test/renderApp'

describe('auth flow', () => {
  it('sends a signed-out visitor to the login page', async () => {
    renderApp(createFakeApi({ user: null }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Todos' })).not.toBeInTheDocument()
  })

  it('logs in and shows the todos', async () => {
    const api = createFakeApi({ user: null, todos: [makeTodo({ title: 'Secret plans' })] })
    const { user } = renderApp(api)

    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Secret plans')).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    expect(api.state.bodies['POST /api/auth/login']).toEqual({ email: 'me@example.com', password: VALID_PASSWORD })
  })

  it('shows the server message and stays on the page when the password is wrong', async () => {
    const { user } = renderApp(createFakeApi({ user: null }))

    await user.type(await screen.findByLabelText('Email'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'nope-nope-nope')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('registers a new account and lands in the app', async () => {
    const { user } = renderApp(createFakeApi({ user: null }), '/register')

    await user.type(await screen.findByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Todos' })).toBeInTheDocument()
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
  })

  it('shows the server message when the email is already registered', async () => {
    const { user } = renderApp(createFakeApi({ user: null }), '/register')

    await user.type(await screen.findByLabelText('Email'), TAKEN_EMAIL)
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.')
  })

  it('navigates between login and register', async () => {
    const { user } = renderApp(createFakeApi({ user: null }))

    await user.click(await screen.findByRole('link', { name: 'Create an account' }))
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('redirects a signed-in user away from the login page', async () => {
    renderApp(createFakeApi({ user: signedInUser }), '/login')

    expect(await screen.findByRole('heading', { name: 'Todos' })).toBeInTheDocument()
  })

  it('logs out and returns to the login page', async () => {
    const { user } = renderApp(createFakeApi({ user: signedInUser }))

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('does not leak the previous account’s todos to the next person who logs in', async () => {
    const api = createFakeApi({ user: signedInUser, todos: [makeTodo({ title: 'Alice only' })] })
    const { user } = renderApp(api)
    expect(await screen.findByText('Alice only')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await screen.findByRole('heading', { name: 'Welcome back' })

    // Someone else signs in on the same browser; the server now has different data for them.
    api.state.todos = [makeTodo({ title: 'Bob only' })]
    await user.type(screen.getByLabelText('Email'), 'bob@example.com')
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Bob only')).toBeInTheDocument()
    expect(screen.queryByText('Alice only')).not.toBeInTheDocument()
  })

  it('sends the user to login when the session expires mid-use', async () => {
    const api = createFakeApi({ user: signedInUser, todos: [makeTodo({ title: 'Buy milk' })] })
    const { user } = renderApp(api)
    const checkbox = await screen.findByRole('checkbox', { name: /Buy milk/ })

    api.state.user = null // the cookie expired server-side
    await user.click(checkbox)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument())
  })
})
