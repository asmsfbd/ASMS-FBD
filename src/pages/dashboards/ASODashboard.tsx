import { useState, useEffect } from 'react'
import { Users, ScanLine, FileText, AlertCircle, TrendingUp, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MetricCard, Card, Badge } from '@/components/ui/index'
import { useAuth } from '@/hooks/useAuth'

interface Stats {
  totalSewadars: number
  scannableToday: number
  pendingNRs: number
  activeJathas: number
  recentScans: RecentScan[]
  centreActivity: CentreActivity[]
}

interface RecentScan {
  id: number
  badge_number: string
  sewadar_name: string
  centre: string
  type: string
  scan_time: string
  duty_type: string
}

interface CentreActivity {
  centre: string
  present: number
  in_jatha: number
}

export default function ASODashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const [sewadarsRes, nrRes, scansRes] = await Promise.all([
        supabase.from('sewadars').select('id, badge_status', { count: 'exact' }).eq('is_active', true),
        supabase.from('nominal_roles').select('id', { count: 'exact' }).eq('status', 'submitted'),
        supabase
          .from('attendance')
          .select('id, badge_number, sewadar_name, centre, type, scan_time, duty_type')
          .gte('scan_time', `${today}T00:00:00+05:30`)
          .order('scan_time', { ascending: false })
          .limit(8),
      ])

      setStats({
        totalSewadars:  sewadarsRes.count ?? 0,
        scannableToday: (sewadarsRes.data ?? []).filter(s =>
          ['Permanent','Open','Elderly'].includes(s.badge_status)
        ).length,
        pendingNRs:   nrRes.count ?? 0,
        activeJathas: 0,
        recentScans:  (scansRes.data ?? []) as RecentScan[],
        centreActivity: [],
      })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Welcome, {user?.name}
        </h2>
        <p className="text-sm text-slate-400">Here's what's happening across Faridabad Area today.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Sewadars"
          value={stats?.totalSewadars.toLocaleString('en-IN') ?? '—'}
          sub="Across 41 centres"
          accent="maroon"
        />
        <MetricCard
          label="Valid for Scanning"
          value={stats?.scannableToday.toLocaleString('en-IN') ?? '—'}
          sub="Permanent + Open + Elderly"
          accent="navy"
        />
        <MetricCard
          label="NRs Pending Approval"
          value={stats?.pendingNRs ?? '—'}
          sub="Awaiting ASO review"
          accent="gold"
        />
        <MetricCard
          label="Today's Scans"
          value={stats?.recentScans.length ?? '—'}
          sub="Last 8 shown below"
          accent="green"
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent scans */}
        <Card padding="none">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ScanLine size={15} className="text-maroon-500" />
              <h3 className="text-sm font-semibold text-slate-700">
                Today's Scans
                <span className="text-slate-400 font-normal ml-1">(आज की स्कैनिंग)</span>
              </h3>
            </div>
            <Badge variant="maroon" dot>Live</Badge>
          </div>
          <div className="divide-y divide-slate-50">
            {stats?.recentScans.length === 0 && (
              <div className="px-4 py-8 text-center">
                <ScanLine size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No scans yet today</p>
              </div>
            )}
            {stats?.recentScans.map(scan => (
              <div key={scan.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="text-[10px] text-slate-400 font-mono w-12 flex-shrink-0">
                  {new Date(scan.scan_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Badge variant={scan.type === 'IN' ? 'green' : 'gray'} className="text-[10px] w-8 justify-center flex-shrink-0">
                  {scan.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{scan.sewadar_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{scan.centre}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-300 flex-shrink-0">{scan.badge_number}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick actions */}
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-navy-500" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Review NRs',       sub: 'एनआर देखें',     icon: <FileText size={18} />,   color: 'text-maroon-600 bg-maroon-50 hover:bg-maroon-100', to: '/nominal-roles' },
                { label: 'View Sewadars',    sub: 'सेवादार देखें',  icon: <Users size={18} />,      color: 'text-navy-600 bg-navy-50 hover:bg-navy-100',       to: '/sewadars' },
                { label: 'Scan Activity',    sub: 'स्कैन रिपोर्ट', icon: <ScanLine size={18} />,   color: 'text-green-700 bg-green-50 hover:bg-green-100',    to: '/reports' },
                { label: 'Centre Overview',  sub: 'केंद्र सारांश',  icon: <Building2 size={18} />,  color: 'text-gold-700 bg-gold-50 hover:bg-gold-100',       to: '/reports' },
              ].map(action => (
                <a
                  key={action.label}
                  href={action.to}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${action.color}`}
                >
                  <span className="mt-0.5">{action.icon}</span>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{action.label}</p>
                    <p className="text-[10px] opacity-60">{action.sub}</p>
                  </div>
                </a>
              ))}
            </div>
          </Card>

          {/* System status */}
          <Card padding="md">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertCircle size={15} className="text-slate-400" />
              System Status
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Database',    status: 'Online',   ok: true },
                { label: 'Auth',        status: 'Active',   ok: true },
                { label: 'Offline Sync',status: 'Ready',    ok: true },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <Badge variant={item.ok ? 'green' : 'red'} dot>{item.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
