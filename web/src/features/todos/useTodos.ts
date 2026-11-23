import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearCompleted,
  createTodo,
  deleteTodo,
  listTodos,
  setCompleted,
  updateTodo,
} from '../../api/todos'
import type { Todo } from '../../api/types'

export const todosKey = ['todos'] as const

/**
 * All of the user's todos, newest first. The list is small, so the page filters it client-side:
 * tab switches are instant and the "items left" counts come for free.
 */
export function useTodos() {
  return useQuery({ queryKey: todosKey, queryFn: () => listTodos('all') })
}

/**
 * A mutation that updates the cached list immediately, rolls back if the server rejects it,
 * and re-syncs with the server when it settles.
 */
function useOptimisticTodoMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  apply: (todos: Todo[], vars: TVars) => Todo[],
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      // Stop in-flight refetches from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: todosKey })
      const previous = queryClient.getQueryData<Todo[]>(todosKey)
      if (previous) queryClient.setQueryData<Todo[]>(todosKey, apply(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(todosKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: todosKey }),
  })
}

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => createTodo(title),
    // The server assigns the id, so wait for it rather than guessing. New todos go on top.
    onSuccess: (created) =>
      queryClient.setQueryData<Todo[]>(todosKey, (old) => [created, ...(old ?? [])]),
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title, notes }: { id: string; title: string; notes: string | null }) =>
      updateTodo(id, title, notes),
    onSuccess: (updated) =>
      queryClient.setQueryData<Todo[]>(todosKey, (old) =>
        old?.map((todo) => (todo.id === updated.id ? updated : todo)),
      ),
  })
}

export function useToggleTodo() {
  return useOptimisticTodoMutation(
    ({ id, isCompleted }: { id: string; isCompleted: boolean }) => setCompleted(id, isCompleted),
    (todos, { id, isCompleted }) =>
      todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              isCompleted,
              completedAt: isCompleted ? (todo.completedAt ?? new Date().toISOString()) : null,
            }
          : todo,
      ),
  )
}

export function useDeleteTodo() {
  return useOptimisticTodoMutation(deleteTodo, (todos, id) => todos.filter((todo) => todo.id !== id))
}

export function useClearCompleted() {
  return useOptimisticTodoMutation(
    () => clearCompleted(),
    (todos) => todos.filter((todo) => !todo.isCompleted),
  )
}
