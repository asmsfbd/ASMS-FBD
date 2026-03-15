import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/hooks/useAuth'

interface AppShellProps {
  title: string
  titleHi?: string
  subtitle?: string
}

export function AppShell({ title, titleHi, subtitle }: AppShellProps) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} titleHi={titleHi} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
