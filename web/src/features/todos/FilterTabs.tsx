import type { TodoStatus } from '../../api/types'
import styles from './todos.module.css'

const options: { value: TodoStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

interface Props {
  value: TodoStatus
  counts: Record<TodoStatus, number>
  onChange: (value: TodoStatus) => void
}

export function FilterTabs({ value, counts, onChange }: Props) {
  return (
    <div className={styles.filters} role="group" aria-label="Filter todos">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.filter}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          <span className={styles.count}>{counts[option.value]}</span>
        </button>
      ))}
    </div>
  )
}
