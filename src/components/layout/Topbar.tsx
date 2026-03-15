import { Menu, Bell, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface TopbarProps {
  onMenuClick: () => void
}

function getDutyType(): { label: string; variant: 'gold' | 'navy' } {
  const day = new Date().getDay()
  if (day === 0 || day === 3) return { label: 'Satsang Point Duty', variant: 'gold' }
  return { label: 'Daily Duty', variant: 'navy' }
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const duty = getDutyType()

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-slate-800 truncate leading-tight">
          ASMS
          <span className="hidden sm:inline text-slate-400 font-normal ml-1 text-xs">
            · Area Sewadar Management
          </span>
        </h1>
        <p className="text-[10px] text-slate-400 hidden sm:block">{formatDate()}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Duty badge — hidden on small mobile */}
        <Badge variant={duty.variant} dot className="hidden sm:inline-flex text-[10px]">
          {duty.label}
        </Badge>

        {/* Online indicator */}
        {online
          ? <Wifi size={15} className="text-green-500" />
          : <WifiOff size={15} className="text-amber-500" />
        }

        {/* Notifications */}
        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 active:bg-slate-200 touch-manipulation">
          <Bell size={16} />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-maroon-100 flex items-center justify-center flex-shrink-0">
          <span className="text-maroon-700 text-xs font-bold">
            {user?.name?.charAt(0) ?? '?'}
          </span>
        </div>
      </div>
    </header>
  )
}
