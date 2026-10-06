// The route table - this is the one place that ties together every page,
// the shared <Layout> shell, and <ProtectedRoute>'s auth/role gating. If
// you're explaining this codebase in an interview, this file is the map:
// reading it top to bottom tells you every URL the app has and who's
// allowed to see it, without opening any other file.

import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ItemsPage } from './pages/ItemsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { ReportsPage } from './pages/ReportsPage'
import { AdminPage } from './pages/AdminPage'

function App() {
  return (
    <Routes>
      {/* Public - no auth required. LoginPage itself redirects away if a
          session is already active (see its own top-of-component check). */}
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below requires *some* signed-in user. ProtectedRoute
          with no `roles` prop just checks "is anyone logged in?" and, if
          so, renders its child route via <Outlet /> - which here is
          <Layout>, so every authenticated page gets the sidebar. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/reports" element={<ReportsPage />} />

          {/* A second, nested ProtectedRoute layered on top, this time
              WITH a `roles` restriction. Nesting guards like this - one
              for "signed in", another for "signed in AND admin" - keeps
              each check single-purpose instead of one guard component
              trying to handle every combination. */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
