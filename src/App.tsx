import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import ASODashboard from '@/pages/dashboards/ASODashboard'
import CentreAdminDashboard from '@/pages/dashboards/CentreAdminDashboard'
import ScannerDashboard from '@/pages/dashboards/ScannerDashboard'
import JathaDashboard from '@/pages/dashboards/JathaDashboard'
import SewadarListPage from '@/pages/sewadars/SewadarListPage'
import SewadarProfilePage from '@/pages/sewadars/SewadarProfilePage'
import SangatListPage from '@/pages/sangat/SangatListPage'
import SangatFormPage from '@/pages/sangat/SangatFormPage'
import SangatProfilePage from '@/pages/sangat/SangatProfilePage'
import JathaScheduleListPage from '@/pages/jatha/JathaScheduleListPage'
import JathaScheduleFormPage from '@/pages/jatha/JathaScheduleFormPage'
import JathaScheduleDetailPage from '@/pages/jatha/JathaScheduleDetailPage'
import NRListPage from '@/pages/nr/NRListPage'
import NRFormPage from '@/pages/nr/NRFormPage'
import NRDetailPage from '@/pages/nr/NRDetailPage'
import type { Role } from '@/types'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

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

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16 max-w-lg mx-auto text-center">
      <div>
        <p className="text-slate-400 text-sm">{text}</p>
        <p className="text-slate-300 text-xs mt-1">Coming soon</p>
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
        <Route path="/scanner" element={<RequireRole roles={['scanner', 'aso']}><ScannerDashboard /></RequireRole>} />
        <Route path="/jatha-attendance" element={<RequireRole roles={['jatha_sewadar', 'aso', 'centre_admin']}><JathaDashboard /></RequireRole>} />

        {/* Sewadars */}
        <Route path="/sewadars" element={<RequireRole roles={['centre_admin', 'aso']}><SewadarListPage /></RequireRole>} />
        <Route path="/sewadars/:id" element={<RequireRole roles={['centre_admin', 'aso']}><SewadarProfilePage /></RequireRole>} />

        {/* Sangat */}
        <Route path="/sangat" element={<RequireRole roles={['centre_admin', 'aso']}><SangatListPage /></RequireRole>} />
        <Route path="/sangat/new" element={<RequireRole roles={['centre_admin', 'aso']}><SangatFormPage /></RequireRole>} />
        <Route path="/sangat/:id" element={<RequireRole roles={['centre_admin', 'aso']}><SangatProfilePage /></RequireRole>} />
        <Route path="/sangat/:id/edit" element={<RequireRole roles={['centre_admin', 'aso']}><SangatFormPage /></RequireRole>} />

        {/* Jatha Schedule */}
        <Route path="/jatha-schedule" element={<RequireRole roles={['centre_admin', 'aso']}><JathaScheduleListPage /></RequireRole>} />
        {/* New — ASO only */}
        <Route path="/jatha-schedule/new" element={<RequireRole roles={['aso']}><JathaScheduleFormPage /></RequireRole>} />
        {/* Detail view — both roles; centre_admin sees their quota + NR status */}
        <Route path="/jatha-schedule/:id" element={<RequireRole roles={['aso', 'centre_admin']}><JathaScheduleDetailPage /></RequireRole>} />
        {/* Edit form — ASO only */}
        <Route path="/jatha-schedule/:id/edit" element={<RequireRole roles={['aso']}><JathaScheduleFormPage /></RequireRole>} />

        {/* Nominal Roles */}
        <Route path="/nominal-roles" element={<RequireRole roles={['centre_admin', 'aso']}><NRListPage /></RequireRole>} />
        <Route path="/nominal-roles/new" element={<RequireRole roles={['centre_admin', 'aso']}><NRFormPage /></RequireRole>} />
        <Route path="/nominal-roles/:id/edit" element={<RequireRole roles={['centre_admin', 'aso']}><NRFormPage /></RequireRole>} />
        <Route path="/nominal-roles/:id" element={<RequireRole roles={['centre_admin', 'aso']}><NRDetailPage /></RequireRole>} />

        {/* Phase 8 */}
        <Route path="/reports" element={<RequireRole roles={['centre_admin', 'aso']}><Placeholder text="Reports — Phase 8" /></RequireRole>} />

        {/* Phase 10 */}
        <Route path="/settings" element={<RequireRole roles={['aso']}><Placeholder text="Settings — Phase 10" /></RequireRole>} />

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
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="/*" element={<RequireAuth><AuthenticatedApp /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}