import { useState, type SubmitEvent } from 'react'
import styles from './todos.module.css'

interface Props {
  pending: boolean
  /** Called with the trimmed title. Call `restore` if saving fails so the text isn't lost. */
  onAdd: (title: string, restore: () => void) => void
}

export function AddTodoForm({ pending, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const trimmed = title.trim()

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed) return

    // Clear straight away rather than when the server answers: waiting would wipe whatever
    // the person typed for their *next* todo while this one was still saving.
    setTitle('')
    // On failure, put the text back, unless they've already started typing something else.
    onAdd(trimmed, () => setTitle((current) => current || trimmed))
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
