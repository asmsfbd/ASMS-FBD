import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FileText,
  ScanLine, CheckSquare, BarChart3, Settings,
  LogOut, ChevronRight, X, UserCircle
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

interface NavItem {
  label:   string
  labelHi: string
  to:      string
  icon:    React.ReactNode
  roles:   Role[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard',        labelHi: 'डैशबोर्ड',      to: '/dashboard',        icon: <LayoutDashboard size={16} />, roles: ['aso','centre_admin','scanner','jatha_sewadar'] },
  { label: 'Sewadars',         labelHi: 'सेवादार',        to: '/sewadars',          icon: <Users size={16} />,           roles: ['aso','centre_admin'] },
  { label: 'Sangat',           labelHi: 'संगत',           to: '/sangat',            icon: <UserCircle size={16} />,      roles: ['aso','centre_admin'] },
  { label: 'Daily Duty',       labelHi: 'दैनिक ड्यूटी',  to: '/scanner',           icon: <ScanLine size={16} />,        roles: ['scanner','aso'] },
  { label: 'Jatha Schedule',   labelHi: 'जत्था शेड्यूल', to: '/jatha-schedule',    icon: <Calendar size={16} />,        roles: ['aso','centre_admin'] },
  { label: 'Nominal Roles',    labelHi: 'नॉमिनल रोल',    to: '/nominal-roles',     icon: <FileText size={16} />,        roles: ['aso','centre_admin'] },
  { label: 'Jatha Attendance', labelHi: 'जत्था हाजिरी',  to: '/jatha-attendance',  icon: <CheckSquare size={16} />,     roles: ['jatha_sewadar','aso','centre_admin'] },
  { label: 'Reports',          labelHi: 'रिपोर्ट',        to: '/reports',           icon: <BarChart3 size={16} />,       roles: ['aso','centre_admin'] },
  { label: 'Settings',         labelHi: 'सेटिंग',         to: '/settings',          icon: <Settings size={16} />,        roles: ['aso'] },
]

const roleLabels: Record<Role, { en: string; color: string }> = {
  aso:            { en: 'Area HQ',       color: 'bg-gold-500 text-maroon-800' },
  centre_admin:   { en: 'Centre Admin',  color: 'bg-navy-500 text-white' },
  scanner:        { en: 'Scanner',       color: 'bg-green-600 text-white' },
  jatha_sewadar:  { en: 'Jatha Sewadar', color: 'bg-purple-600 text-white' },
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const navigate          = useNavigate()

  if (!user) return null

  const visibleItems = navItems.filter(item => item.roles.includes(user.role))
  const roleInfo     = roleLabels[user.role]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-maroon-700 flex flex-col select-none">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-maroon-600 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 rounded-full bg-maroon-700 border-2 border-white/40" />
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide leading-tight">ASMS</p>
            <p className="text-white/50 text-[10px] leading-tight">Faridabad Area</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-maroon-600 bg-maroon-800/30">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${roleInfo.color}`}>
          {roleInfo.en}
        </span>
        <p className="text-white text-xs font-semibold truncate">{user.name}</p>
        <p className="text-white/40 text-[10px] font-mono mt-0.5">{user.badge_number}</p>
        <p className="text-white/40 text-[10px] truncate">{user.centre}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => [
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all group',
              isActive
                ? 'bg-gold-500/20 text-gold-300 font-semibold'
                : 'text-white/65 hover:text-white hover:bg-white/8',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-gold-400' : 'text-white/50 group-hover:text-white/80'}>
                  {item.icon}
                </span>
                <span className="flex-1 leading-tight">
                  {item.label}
                  <span className="block text-[10px] opacity-50 font-normal">{item.labelHi}</span>
                </span>
                {isActive && <ChevronRight size={12} className="text-gold-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-maroon-600">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/8 text-sm transition-all"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
