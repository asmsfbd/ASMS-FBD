import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface TopbarProps {
  title: string
  titleHi?: string
  subtitle?: string
}

function getDutyType(): { label: string; variant: 'maroon' | 'navy' | 'gold' } {
  const day = new Date().getDay() // 0=Sun, 3=Wed
  if (day === 0 || day === 3) {
    return { label: 'Satsang Point Day (सत्संग ड्यूटी)', variant: 'gold' }
  }
  return { label: 'Daily Duty Day (दैनिक ड्यूटी)', variant: 'navy' }
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function Topbar({ title, titleHi, subtitle }: TopbarProps) {
  const { user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const duty = getDutyType()

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold text-slate-800 leading-tight">
          {title}
          {titleHi && <span className="text-slate-400 font-normal ml-2 text-sm">({titleHi})</span>}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {subtitle ?? formatDate()}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={duty.variant} dot>
          {duty.label}
        </Badge>

        {online ? (
          <span title="Online" className="text-green-500"><Wifi size={16} /></span>
        ) : (
          <span title="Offline — scans will sync when reconnected" className="text-amber-500">
            <WifiOff size={16} />
          </span>
        )}

        <button className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <Bell size={16} />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-maroon-100 flex items-center justify-center">
            <span className="text-maroon-700 text-xs font-bold">
              {user?.name?.charAt(0) ?? '?'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-700 leading-tight truncate max-w-28">
              {user?.name}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{user?.badge_number}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
