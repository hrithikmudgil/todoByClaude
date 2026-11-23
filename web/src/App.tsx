import { Navigate, Route, Routes } from 'react-router'
import { LoginPage, RegisterPage } from './features/auth/AuthPage'
import { GuestOnly, RequireAuth } from './features/auth/RouteGuards'
import TodosPage from './features/todos/TodosPage'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route index element={<TodosPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
