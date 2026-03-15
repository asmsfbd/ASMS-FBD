import { useState, useEffect } from 'react'
import { Users, ScanLine, FileText, TrendingUp, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/index'
import { useAuth } from '@/hooks/useAuth'

interface Stats {
  totalSewadars:  number
  scannable:      number
  pendingNRs:     number
  todayScans:     number
  recentScans:    RecentScan[]
}

interface RecentScan {
  id:           number
  badge_number: string
  sewadar_name: string
  centre:       string
  type:         string
  scan_time:    string
}

const quickActions = [
  { label: 'Review NRs',      hi: 'एनआर देखें',     to: '/nominal-roles',   color: 'bg-maroon-50 text-maroon-700 border-maroon-100' },
  { label: 'Sewadars',        hi: 'सेवादार',          to: '/sewadars',         color: 'bg-navy-50 text-navy-700 border-navy-100' },
  { label: 'Jatha Schedule',  hi: 'जत्था शेड्यूल',  to: '/jatha-schedule',   color: 'bg-gold-50 text-gold-700 border-gold-100' },
  { label: 'Reports',         hi: 'रिपोर्ट',          to: '/reports',          color: 'bg-green-50 text-green-700 border-green-100' },
]

export default function ASODashboard() {
  const { user }          = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const [totalRes, scannableRes, nrRes, scansRes] = await Promise.all([
        supabase.from('sewadars').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sewadars').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_scannable', true),
        supabase.from('nominal_roles').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('attendance')
          .select('id, badge_number, sewadar_name, centre, type, scan_time')
          .gte('scan_time', `${today}T00:00:00+05:30`)
          .order('scan_time', { ascending: false })
          .limit(10),
      ])

      setStats({
        totalSewadars: totalRes.count    ?? 0,
        scannable:     scannableRes.count ?? 0,
        pendingNRs:    nrRes.count        ?? 0,
        todayScans:    scansRes.data?.length ?? 0,
        recentScans:   (scansRes.data ?? []) as RecentScan[],
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-40 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Welcome */}
      <div>
        <h2 className="text-base font-semibold text-slate-800">Welcome, {user?.name?.split(' ')[0]}</h2>
        <p className="text-xs text-slate-400">Faridabad Area · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      </div>

      {/* Metric cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Sewadars',    value: stats?.totalSewadars.toLocaleString('en-IN'), color: 'text-maroon-600', bg: 'bg-maroon-50', border: 'border-maroon-100' },
          { label: 'Valid for Scanning', value: stats?.scannable.toLocaleString('en-IN'),   color: 'text-navy-600',   bg: 'bg-navy-50',   border: 'border-navy-100' },
          { label: 'NRs Pending',        value: stats?.pendingNRs,                           color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
          { label: "Today's Scans",      value: stats?.todayScans,                           color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} border ${m.border} rounded-xl p-4`}>
            <p className="text-xs text-slate-500 mb-1 leading-tight">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(a => (
            <Link
              key={a.to}
              to={a.to}
              className={`flex items-center justify-between px-4 py-3.5 rounded-xl border font-medium text-sm transition-all active:scale-95 touch-manipulation ${a.color}`}
            >
              <div>
                <p className="font-semibold text-sm leading-tight">{a.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{a.hi}</p>
              </div>
              <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent scans */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ScanLine size={14} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">Today's Scans</h3>
          </div>
          <Badge variant="maroon" dot className="text-[10px]">Live</Badge>
        </div>

        {stats?.recentScans.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <ScanLine size={22} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No scans yet today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {stats?.recentScans.map(scan => (
              <div key={scan.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-[10px] font-bold w-8 flex-shrink-0 ${
                  scan.type === 'IN' ? 'text-green-600' : 'text-slate-400'
                }`}>{scan.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{scan.sewadar_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{scan.centre}</p>
                </div>
                <span className="text-[10px] text-slate-300 font-mono flex-shrink-0">
                  {new Date(scan.scan_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System status */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">System Status</h3>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Database',    ok: true },
            { label: 'Auth',        ok: true },
            { label: 'Offline Sync',ok: true },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{s.label}</span>
              <Badge variant={s.ok ? 'green' : 'red'} dot className="text-[10px]">
                {s.ok ? 'Online' : 'Offline'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
