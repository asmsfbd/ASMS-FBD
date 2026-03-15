import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/index'
import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import ASODashboard from '@/pages/dashboards/ASODashboard'
import CentreAdminDashboard from '@/pages/dashboards/CentreAdminDashboard'
import ScannerDashboard from '@/pages/dashboards/ScannerDashboard'
import JathaDashboard from '@/pages/dashboards/JathaDashboard'
import type { Role } from '@/types'

// Route guard — redirects to login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Route guard — redirects if wrong role
function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Picks the right dashboard component based on role
function DashboardRouter() {
  const { user } = useAuth()
  if (!user) return null
  switch (user.role) {
    case 'aso':           return <ASODashboard />
    case 'centre_admin':  return <CentreAdminDashboard />
    case 'scanner':       return <ScannerDashboard />
    case 'jatha_sewadar': return <JathaDashboard />
    default:              return <ASODashboard />
  }
}

// Shell title varies by role
function getShellTitle(role?: Role): { title: string; titleHi: string } {
  switch (role) {
    case 'aso':           return { title: 'Area Sewadar Management System', titleHi: 'ASMS' }
    case 'centre_admin':  return { title: 'Centre Management',              titleHi: 'केंद्र प्रबंधन' }
    case 'scanner':       return { title: 'Daily Duty Scanner',             titleHi: 'दैनिक ड्यूटी स्कैनर' }
    case 'jatha_sewadar': return { title: 'Jatha Attendance',               titleHi: 'जत्था हाजिरी' }
    default:              return { title: 'ASMS',                           titleHi: '' }
  }
}

function AuthenticatedApp() {
  const { user } = useAuth()
  const { title, titleHi } = getShellTitle(user?.role)

  return (
    <Routes>
      <Route element={<AppShell title={title} titleHi={titleHi} />}>
        {/* Dashboard — role-based */}
        <Route path="/dashboard" element={<DashboardRouter />} />

        {/* Scanner — only scanner + aso */}
        <Route
          path="/scanner"
          element={
            <RequireRole roles={['scanner', 'aso']}>
              <ScannerDashboard />
            </RequireRole>
          }
        />

        {/* Jatha attendance — jatha_sewadar + aso + centre_admin */}
        <Route
          path="/jatha-attendance"
          element={
            <RequireRole roles={['jatha_sewadar', 'aso', 'centre_admin']}>
              <JathaDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/jatha-attendance/:nrId"
          element={
            <RequireRole roles={['jatha_sewadar', 'aso', 'centre_admin']}>
              {/* JathaMarkPage — Phase 7 */}
              <div className="p-6 text-slate-500 text-sm">Jatha mark page — coming in Phase 7</div>
            </RequireRole>
          }
        />

        {/* Sewadars — centre_admin + aso */}
        <Route
          path="/sewadars"
          element={
            <RequireRole roles={['centre_admin', 'aso']}>
              {/* SewadarListPage — Phase 3 */}
              <div className="p-6 text-slate-500 text-sm">Sewadar database — coming in Phase 3</div>
            </RequireRole>
          }
        />

        {/* Jatha Schedule — centre_admin + aso */}
        <Route
          path="/jatha-schedule"
          element={
            <RequireRole roles={['centre_admin', 'aso']}>
              {/* JathaSchedulePage — Phase 4 */}
              <div className="p-6 text-slate-500 text-sm">Jatha schedule — coming in Phase 4</div>
            </RequireRole>
          }
        />

        {/* Nominal Roles — centre_admin + aso */}
        <Route
          path="/nominal-roles"
          element={
            <RequireRole roles={['centre_admin', 'aso']}>
              {/* NRListPage — Phase 5 */}
              <div className="p-6 text-slate-500 text-sm">Nominal roles — coming in Phase 5</div>
            </RequireRole>
          }
        />
        <Route
          path="/nominal-roles/:id"
          element={
            <RequireRole roles={['centre_admin', 'aso']}>
              <div className="p-6 text-slate-500 text-sm">NR detail — coming in Phase 5</div>
            </RequireRole>
          }
        />

        {/* Reports — centre_admin + aso */}
        <Route
          path="/reports"
          element={
            <RequireRole roles={['centre_admin', 'aso']}>
              {/* ReportsPage — Phase 8 */}
              <div className="p-6 text-slate-500 text-sm">Reports — coming in Phase 8</div>
            </RequireRole>
          }
        />

        {/* Settings — aso only */}
        <Route
          path="/settings"
          element={
            <RequireRole roles={['aso']}>
              {/* SettingsPage — Phase 10 */}
              <div className="p-6 text-slate-500 text-sm">Settings — coming in Phase 10</div>
            </RequireRole>
          }
        />

        {/* Catch-all inside shell */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
        />

        {/* Protected */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AuthenticatedApp />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
