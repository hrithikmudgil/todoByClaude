import { useState, type SubmitEvent } from 'react'
import styles from './todos.module.css'

interface Props {
  pending: boolean
  /** Called with the trimmed title; call `done` to clear the field once the todo was saved. */
  onAdd: (title: string, done: () => void) => void
}

export function AddTodoForm({ pending, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const trimmed = title.trim()

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed) return
    onAdd(trimmed, () => setTitle(''))
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="new-todo">
        New todo
      </label>
      <input
        id="new-todo"
        type="text"
        placeholder="What needs doing?"
        maxLength={200}
        autoComplete="off"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={pending || !trimmed}>
        Add
      </button>
    </form>
  )
}
