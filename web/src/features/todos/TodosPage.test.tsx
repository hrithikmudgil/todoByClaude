import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createFakeApi, makeTodo, problem, signedInUser } from '../../test/fakeApi'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

function setup(todos = [makeTodo({ title: 'Buy milk' }), makeTodo({ title: 'Walk dog', isCompleted: true })]) {
  const api = createFakeApi({ user: signedInUser, todos })
  return { api, ...renderApp(api) }
}

const items = () => within(screen.getByRole('list', { name: 'Todos' })).getAllByRole('listitem')

describe('TodosPage', () => {
  it('lists the todos with filter counts and an items-left summary', async () => {
    setup()

    expect(await screen.findByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByText('Walk dog')).toBeInTheDocument()
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^All\s*2$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Active\s*1$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Completed\s*1$/ })).toBeInTheDocument()
    expect(screen.getByText('1 item left')).toBeInTheDocument()
  })

  it('shows an empty state when there are no todos', async () => {
    setup([])

    expect(await screen.findByText(/Add your first todo/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Todos' })).not.toBeInTheDocument()
  })

  it('adds a todo to the top of the list and clears the input', async () => {
    const { api, user } = setup()
    await screen.findByText('Buy milk')

    const input = screen.getByLabelText('New todo')
    await user.type(input, '  Write tests  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(items()[0]).toHaveTextContent('Write tests'))
    expect(input).toHaveValue('')
    expect(api.state.bodies['POST /api/todos']).toEqual({ title: 'Write tests' })
  })

  it('keeps what you type for the next todo while the previous one is still saving', async () => {
    const { user } = setup()
    await screen.findByText('Buy milk')
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post('/api/todos', async () => {
        await gate
        return HttpResponse.json(makeTodo({ title: 'First' }), { status: 201 })
      }),
    )

    const input = screen.getByLabelText('New todo')
    await user.type(input, 'First')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(input).toHaveValue('') // cleared on submit, not on response

    await user.type(input, 'Second')
    release() // the first response arrives now

    await waitFor(() => expect(items()[0]).toHaveTextContent('First'))
    expect(input).toHaveValue('Second')
  })

  it('puts the text back if adding fails, unless something new was typed', async () => {
    const { user } = setup()
    await screen.findByText('Buy milk')
    server.use(http.post('/api/todos', () => problem(500, 'Server error', 'Could not save.')))
    const input = screen.getByLabelText('New todo')

    await user.type(input, 'Important thing')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.')
    expect(input).toHaveValue('Important thing')
  })

  it('does not allow adding a blank todo', async () => {
    const { user } = setup()
    await screen.findByText('Buy milk')

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.type(screen.getByLabelText('New todo'), '   ')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('marks a todo done right away and tells the server', async () => {
    const { api, user } = setup()
    const checkbox = await screen.findByRole('checkbox', { name: /Buy milk/ })

    await user.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(await screen.findByText('0 items left')).toBeInTheDocument()
    await waitFor(() => expect(api.state.bodies['PATCH /api/todos/' + api.state.todos[0].id]).toEqual({ isCompleted: true }))
  })

  it('rolls the checkbox back and shows an error when the server rejects the change', async () => {
    const { user } = setup()
    const checkbox = await screen.findByRole('checkbox', { name: /Buy milk/ })
    server.use(http.patch('/api/todos/:id', () => problem(500, 'Server error', 'Something broke.')))

    await user.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke.')
    await waitFor(() => expect(checkbox).not.toBeChecked())
    expect(screen.getByText('1 item left')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('filters by active and completed, with a friendly message when a filter is empty', async () => {
    const { user } = setup([makeTodo({ title: 'Only open' })])
    await screen.findByText('Only open')

    await user.click(screen.getByRole('button', { name: /^Active/ }))
    expect(items()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /^Completed/ }))
    expect(screen.getByText('No completed todos yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Completed/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /^All/ }))
    expect(screen.getByText('Only open')).toBeInTheDocument()
  })

  it('deletes a todo', async () => {
    const { api, user } = setup()
    await screen.findByText('Buy milk')

    await user.click(screen.getByRole('button', { name: /Delete “Buy milk”/ }))

    await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument())
    await waitFor(() => expect(api.state.todos.map((t) => t.title)).toEqual(['Walk dog']))
  })

  it('clears completed todos and disables the button when there are none', async () => {
    const { api, user } = setup()
    await screen.findByText('Walk dog')

    await user.click(screen.getByRole('button', { name: 'Clear completed' }))

    await waitFor(() => expect(screen.queryByText('Walk dog')).not.toBeInTheDocument())
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
    expect(api.state.requests).toContain('DELETE /api/todos/completed')
  })

  it('edits a todo inline and saves title and notes', async () => {
    const { api, user } = setup()
    await screen.findByText('Buy milk')

    await user.click(screen.getByRole('button', { name: /Edit “Buy milk”/ }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Buy oat milk')
    await user.type(screen.getByLabelText('Notes'), 'Barista edition')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Buy oat milk')).toBeInTheDocument()
    expect(screen.getByText('Barista edition')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(api.state.bodies['PUT /api/todos/' + api.state.todos[0].id]).toEqual({
      title: 'Buy oat milk',
      notes: 'Barista edition',
    })
  })

  it('cancels editing with Escape and discards changes', async () => {
    const { user } = setup()
    await screen.findByText('Buy milk')

    await user.click(screen.getByRole('button', { name: /Edit “Buy milk”/ }))
    await user.type(screen.getByLabelText('Title'), ' extra')
    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('keeps the editor open and shows the error if saving fails', async () => {
    const { user } = setup()
    await screen.findByText('Buy milk')
    server.use(http.put('/api/todos/:id', () => problem(400, 'Bad Request', 'Title is too long.')))

    await user.click(screen.getByRole('button', { name: /Edit “Buy milk”/ }))
    await user.type(screen.getByLabelText('Title'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is too long.')
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('shows an error with a working retry when the list fails to load', async () => {
    const api = createFakeApi({ user: signedInUser, todos: [makeTodo({ title: 'Back again' })] })
    const { user } = renderApp(api)

    // Installed after render (later handlers win). The todos request only fires once /me resolves,
    // so this is in place before it is needed.
    let failures = 1
    server.use(
      http.get('/api/todos', () =>
        failures-- > 0 ? problem(500, 'Server error', 'Database is down.') : HttpResponse.json(api.state.todos),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down.')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back again')).toBeInTheDocument()
  })
})
