import { useState, type KeyboardEvent, type SubmitEvent } from 'react'
import type { Todo } from '../../api/types'
import styles from './todos.module.css'

interface Props {
  todo: Todo
  saving: boolean
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  /** Call `done` when the save succeeded so the row leaves edit mode; on failure it stays open. */
  onSave: (todo: Todo, title: string, notes: string | null, done: () => void) => void
}

export function TodoRow({ todo, saving, onToggle, onDelete, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [notes, setNotes] = useState(todo.notes ?? '')

  function startEditing() {
    setTitle(todo.title)
    setNotes(todo.notes ?? '')
    setEditing(true)
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSave(todo, trimmed, notes.trim() || null, () => setEditing(false))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <li className={styles.row}>
        <form className={styles.editForm} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <label className="visually-hidden" htmlFor={`title-${todo.id}`}>
            Title
          </label>
          <input
            id={`title-${todo.id}`}
            type="text"
            maxLength={200}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="visually-hidden" htmlFor={`notes-${todo.id}`}>
            Notes
          </label>
          <textarea
            id={`notes-${todo.id}`}
            placeholder="Notes (optional)"
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className={styles.editActions}>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              Save
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={styles.row}>
      <input
        type="checkbox"
        className={styles.check}
        checked={todo.isCompleted}
        onChange={() => onToggle(todo)}
        aria-label={`Mark “${todo.title}” as ${todo.isCompleted ? 'not done' : 'done'}`}
      />
      <div className={styles.body}>
        <span className={todo.isCompleted ? styles.titleDone : styles.title}>{todo.title}</span>
        {todo.notes && <p className={styles.notes}>{todo.notes}</p>}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={startEditing}
          aria-label={`Edit “${todo.title}”`}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-danger"
          onClick={() => onDelete(todo)}
          aria-label={`Delete “${todo.title}”`}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
