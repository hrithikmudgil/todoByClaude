import { useState } from 'react'
import type { Todo, TodoStatus } from '../../api/types'
import { useLogout, useMe } from '../auth/useAuth'
import { AddTodoForm } from './AddTodoForm'
import { FilterTabs } from './FilterTabs'
import { TodoRow } from './TodoRow'
import {
  useClearCompleted,
  useCreateTodo,
  useDeleteTodo,
  useTodos,
  useToggleTodo,
  useUpdateTodo,
} from './useTodos'
import styles from './todos.module.css'

const emptyMessages: Record<TodoStatus, string> = {
  all: 'Nothing here yet. Add your first todo above.',
  active: 'Nothing left to do. Nice work!',
  completed: 'No completed todos yet.',
}

export default function TodosPage() {
  const { data: user } = useMe()
  const logout = useLogout()
  const todosQuery = useTodos()

  const create = useCreateTodo()
  const update = useUpdateTodo()
  const toggle = useToggleTodo()
  const remove = useDeleteTodo()
  const clear = useClearCompleted()

  const [filter, setFilter] = useState<TodoStatus>('all')

  const todos = todosQuery.data ?? []
  const counts: Record<TodoStatus, number> = {
    all: todos.length,
    active: todos.filter((t) => !t.isCompleted).length,
    completed: todos.filter((t) => t.isCompleted).length,
  }
  const visible = filter === 'all' ? todos : todos.filter((t) => t.isCompleted === (filter === 'completed'))

  // Optimistic changes roll back silently, so surface whichever mutation failed.
  const mutations = [create, update, toggle, remove, clear]
  const failed = mutations.find((m) => m.isError)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title1}>Todos</h1>
        <div className={styles.account}>
          <span className={styles.email}>{user?.email}</span>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Log out
          </button>
        </div>
      </header>

      <main className={styles.panel}>
        <AddTodoForm
          pending={create.isPending}
          onAdd={(title, done) => create.mutate(title, { onSuccess: done })}
        />

        {failed && (
          <div role="alert" className={`alert ${styles.banner}`}>
            <span>{failed.error?.message}</span>
            <button type="button" className="btn btn-quiet" onClick={() => mutations.forEach((m) => m.reset())}>
              Dismiss
            </button>
          </div>
        )}

        <FilterTabs value={filter} counts={counts} onChange={setFilter} />

        {todosQuery.isPending && (
          <p role="status" className={styles.empty}>
            Loading your todos…
          </p>
        )}

        {todosQuery.isError && (
          <div className={styles.empty}>
            <p role="alert" className="alert">
              Couldn’t load your todos. {todosQuery.error.message}
            </p>
            <button type="button" className="btn" onClick={() => void todosQuery.refetch()}>
              Try again
            </button>
          </div>
        )}

        {todosQuery.isSuccess &&
          (visible.length === 0 ? (
            <p className={styles.empty}>{emptyMessages[filter]}</p>
          ) : (
            <ul className={styles.list} aria-label="Todos">
              {visible.map((todo: Todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  saving={update.isPending}
                  onToggle={(t) => toggle.mutate({ id: t.id, isCompleted: !t.isCompleted })}
                  onDelete={(t) => remove.mutate(t.id)}
                  onSave={(t, title, notes, done) =>
                    update.mutate({ id: t.id, title, notes }, { onSuccess: done })
                  }
                />
              ))}
            </ul>
          ))}

        {todosQuery.isSuccess && todos.length > 0 && (
          <footer className={styles.footer}>
            <span>
              {counts.active} {counts.active === 1 ? 'item' : 'items'} left
            </span>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => clear.mutate()}
              disabled={counts.completed === 0}
            >
              Clear completed
            </button>
          </footer>
        )}
      </main>
    </div>
  )
}
