import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ScanLine, FileText, CheckSquare, BarChart3 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

interface BottomNavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: Role[]
}

const items: BottomNavItem[] = [
  { label: 'Home',    to: '/dashboard',       icon: <LayoutDashboard size={20} />, roles: ['aso','centre_admin','scanner','jatha_sewadar'] },
  { label: 'Scan',    to: '/scanner',         icon: <ScanLine size={20} />,        roles: ['scanner','aso'] },
  { label: 'NR',      to: '/nominal-roles',   icon: <FileText size={20} />,        roles: ['aso','centre_admin'] },
  { label: 'Jatha',   to: '/jatha-attendance',icon: <CheckSquare size={20} />,     roles: ['jatha_sewadar','aso','centre_admin'] },
  { label: 'Reports', to: '/reports',         icon: <BarChart3 size={20} />,       roles: ['aso','centre_admin'] },
]

export function BottomNav() {
  const { user } = useAuth()
  if (!user) return null

  const visible = items.filter(i => i.roles.includes(user.role))

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 safe-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => [
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[52px] transition-all',
              isActive
                ? 'text-maroon-600'
                : 'text-slate-400',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-maroon-600' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-maroon-600' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
