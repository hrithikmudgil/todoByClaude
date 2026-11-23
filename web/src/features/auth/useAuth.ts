import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, login, logout, register } from '../../api/auth'
import type { User } from '../../api/types'
import { todosKey } from '../todos/useTodos'

export const meKey = ['me'] as const

/** The signed-in user; `data` is null when signed out. Fetched once, then kept in sync by the mutations below. */
export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: getMe, staleTime: Infinity, retry: false })
}

interface Credentials {
  email: string
  password: string
}

/** Switching accounts must never show the previous account's cached todos. */
function useSessionChange() {
  const queryClient = useQueryClient()
  return (user: User | null) => {
    queryClient.removeQueries({ queryKey: todosKey })
    queryClient.setQueryData(meKey, user)
  }
}

export function useLogin() {
  const setSession = useSessionChange()
  return useMutation({
    mutationFn: ({ email, password }: Credentials) => login(email, password),
    onSuccess: (user) => setSession(user),
  })
}

export function useRegister() {
  const setSession = useSessionChange()
  return useMutation({
    mutationFn: ({ email, password }: Credentials) => register(email, password),
    onSuccess: (user) => setSession(user),
  })
}

export function useLogout() {
  const setSession = useSessionChange()
  return useMutation({
    mutationFn: logout,
    // Even if the request fails, drop the local session; the cookie expires server-side anyway.
    onSettled: () => setSession(null),
  })
}
