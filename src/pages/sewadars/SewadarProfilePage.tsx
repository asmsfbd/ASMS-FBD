import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, User, Phone, MapPin, BadgeCheck, Calendar, ScanLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/index'
import type { Sewadar } from '@/types'

interface AttendanceSummary {
  total_scans:        number
  total_in:           number
  satsang_point_days: number
  daily_duty_days:    number
  last_scan:          string | null
}

interface RecentScan {
  id:        number
  type:      string
  duty_type: string
  scan_time: string
  scan_centre: string
}

interface JathaRecord {
  id:           number
  jatha_name:   string
  destination:  string
  department:   string
  from_date:    string
  to_date:      string
  nr_status:    string
}

const statusVariant: Record<string, 'green' | 'navy' | 'gold' | 'red' | 'gray'> = {
  Permanent: 'green', Open: 'navy', Elderly: 'gold',
  Withdrawn: 'gray',  Expired: 'red', Cancelled: 'red',
}

export default function SewadarProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [sewadar,    setSewadar]    = useState<Sewadar | null>(null)
  const [summary,    setSummary]    = useState<AttendanceSummary | null>(null)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [jathas,     setJathas]     = useState<JathaRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'profile' | 'attendance' | 'jatha'>('profile')

  useEffect(() => {
    if (id) fetchAll(id)
  }, [id])

  const fetchAll = async (sewadarId: string) => {
    setLoading(true)
    try {
      const [swRes, scansRes, jathaRes] = await Promise.all([
        supabase.from('sewadars').select('*').eq('id', sewadarId).single(),

        supabase.from('attendance')
          .select('id, type, duty_type, scan_time, scan_centre')
          .eq('badge_number', '') // will update after getting badge
          .order('scan_time', { ascending: false })
          .limit(20),

        supabase.from('nr_members')
          .select(`
            id,
            nominal_roles!nr_members_nominal_role_id_fkey (
              id, jatha_name, schedule_dates, status,
              jatha_schedule!nominal_roles_jatha_schedule_id_fkey (
                destination, department, from_date, to_date
              )
            )
          `)
          .eq('sewadar_id', sewadarId)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const sw = swRes.data as Sewadar | null
      setSewadar(sw)

      if (sw) {
        // Fetch attendance with correct badge
        const { data: attData } = await supabase
          .from('attendance')
          .select('id, type, duty_type, scan_time, scan_centre')
          .eq('badge_number', sw.badge_number)
          .order('scan_time', { ascending: false })
          .limit(20)

        const scans = (attData ?? []) as RecentScan[]
        setRecentScans(scans)

        // Build summary
        const { data: allAtt } = await supabase
          .from('attendance')
          .select('type, duty_type, scan_time')
          .eq('badge_number', sw.badge_number)

        if (allAtt) {
          const inScans = allAtt.filter(a => a.type === 'IN')
          setSummary({
            total_scans:        allAtt.length,
            total_in:           inScans.length,
            satsang_point_days: inScans.filter(a => a.duty_type === 'satsang_point').length,
            daily_duty_days:    inScans.filter(a => a.duty_type === 'daily_duty').length,
            last_scan:          allAtt.length > 0 ? allAtt[0].scan_time : null,
          })
        }
      }

      // Parse jatha records
      const jathaData = (jathaRes.data ?? []).map((m: any) => {
        const nr  = m.nominal_roles
        const js  = nr?.jatha_schedule
        return {
          id:          m.id,
          jatha_name:  nr?.jatha_name ?? '—',
          destination: js?.destination ?? '—',
          department:  js?.department ?? '—',
          from_date:   js?.from_date ?? '—',
          to_date:     js?.to_date ?? '—',
          nr_status:   nr?.status ?? '—',
        }
      })
      setJathas(jathaData)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!sewadar) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-slate-400">Sewadar not found</p>
        <Link to="/sewadars" className="text-maroon-600 text-sm mt-2 inline-block">← Back to list</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Back */}
      <div className="flex items-center gap-2">
        <Link to="/sewadars" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-slate-800">Sewadar Profile</h1>
          <p className="text-xs text-slate-400">सेवादार प्रोफाइल</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-maroon-100 flex items-center justify-center flex-shrink-0">
            <span className="text-maroon-700 text-xl font-bold">{sewadar.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{sewadar.name}</h2>
            <p className="text-sm text-slate-500">S/O {sewadar.father_name ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant={statusVariant[sewadar.badge_status] ?? 'gray'} className="text-[10px]">
                {sewadar.badge_status}
              </Badge>
              <Badge variant={sewadar.gender === 'M' ? 'navy' : 'maroon'} className="text-[10px]">
                {sewadar.gender === 'M' ? 'Male' : 'Female'}
              </Badge>
              {sewadar.is_special_dept && (
                <Badge variant="gold" className="text-[10px]">Special Dept</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center gap-3 py-2 border-b border-slate-50">
            <BadgeCheck size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Badge Number</p>
              <p className="font-mono font-medium text-slate-800">{sewadar.badge_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2 border-b border-slate-50">
            <User size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Centre · Department</p>
              <p className="text-slate-800">{sewadar.centre}</p>
              <p className="text-slate-500 text-xs">{sewadar.department ?? 'No department'}</p>
            </div>
          </div>
          {sewadar.mobile && (
            <div className="flex items-center gap-3 py-2 border-b border-slate-50">
              <Phone size={15} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Mobile</p>
                <a href={`tel:${sewadar.mobile}`} className="text-maroon-600 font-medium">{sewadar.mobile}</a>
              </div>
            </div>
          )}
          {sewadar.address && (
            <div className="flex items-start gap-3 py-2">
              <MapPin size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-slate-600 text-xs leading-relaxed">{sewadar.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {[
          { key: 'profile',    label: 'Summary' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'jatha',      label: 'Jatha History' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={[
              'flex-1 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation',
              activeTab === t.key ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === 'profile' && summary && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total IN Scans',     value: summary.total_in,           color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Total Scans',        value: summary.total_scans,        color: 'text-navy-600',   bg: 'bg-navy-50' },
            { label: 'Satsang Point Days', value: summary.satsang_point_days, color: 'text-gold-600',   bg: 'bg-gold-50' },
            { label: 'Daily Duty Days',    value: summary.daily_duty_days,    color: 'text-maroon-600', bg: 'bg-maroon-50' },
          ].map(m => (
            <div key={m.label} className={`${m.bg} rounded-xl p-4`}>
              <p className="text-xs text-slate-500 mb-1 leading-tight">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
          {summary.last_scan && (
            <div className="col-span-2 bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Last Seen</p>
              <p className="text-sm font-medium text-slate-700">
                {new Date(summary.last_scan).toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <ScanLine size={14} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">Recent Scans (last 20)</h3>
          </div>
          {recentScans.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No attendance records</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentScans.map(scan => (
                <div key={scan.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-bold w-10 flex-shrink-0 ${scan.type === 'IN' ? 'text-green-600' : 'text-slate-400'}`}>
                    {scan.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700">
                      {new Date(scan.scan_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-400">{scan.scan_centre}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={scan.duty_type === 'satsang_point' ? 'gold' : 'navy'} className="text-[9px]">
                      {scan.duty_type === 'satsang_point' ? 'Satsang' : 'Daily'}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(scan.scan_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Jatha tab */}
      {activeTab === 'jatha' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Calendar size={14} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">Jatha Participations</h3>
          </div>
          {jathas.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No jatha records</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {jathas.map(j => (
                <div key={j.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{j.jatha_name}</p>
                      <p className="text-xs text-slate-500">{j.destination} · {j.department}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{j.from_date} – {j.to_date}</p>
                    </div>
                    <Badge
                      variant={j.nr_status === 'issued' ? 'maroon' : j.nr_status === 'approved' ? 'green' : 'gray'}
                      className="text-[9px] flex-shrink-0"
                    >
                      {j.nr_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
