import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Calendar, Eye, EyeOff, CheckCircle, Clock, XCircle, Edit2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id:             number
  jatha_name:     string
  destination:    string
  department:     string
  from_date:      string
  to_date:        string
  total_required: number
  is_published:   boolean
  is_active:      boolean
  created_at:     string
  centre_count:   number
  total_assigned: number
}

type FilterStatus = 'all' | 'published' | 'draft' | 'inactive'

export default function JathaScheduleListPage() {
  const { user }                        = useAuth()
  const [schedules,  setSchedules]      = useState<Schedule[]>([])
  const [loading,    setLoading]        = useState(true)
  const [filter,     setFilter]         = useState<FilterStatus>('all')
  const [destFilter, setDestFilter]     = useState('all')
  const isASO = user?.role === 'aso'

  useEffect(() => { fetchSchedules() }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('sewa_schedule')
        .select(`
          id, jatha_name, destination, department,
          from_date, to_date, total_required,
          is_published, is_active, created_at,
          sewa_quota (quota_count)
        `)
        .order('from_date', { ascending: false })

      if (data) {
        setSchedules(data.map((s: any) => ({
          ...s,
          centre_count:   (s.sewa_quota ?? []).filter((q: any) => q.quota_count > 0).length,
          total_assigned: (s.sewa_quota ?? []).reduce((sum: number, q: any) => sum + (q.quota_count ?? 0), 0),
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (s: Schedule) => {
    await supabase.from('sewa_schedule').update({ is_published: !s.is_published }).eq('id', s.id)
    setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, is_published: !s.is_published } : x))
  }

  const toggleActive = async (s: Schedule) => {
    await supabase.from('sewa_schedule').update({ is_active: !s.is_active }).eq('id', s.id)
    setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x))
  }

  const destinations = ['all', ...Array.from(new Set(schedules.map(s => s.destination)))]

  const filtered = schedules.filter(s => {
    if (destFilter !== 'all' && s.destination !== destFilter) return false
    if (filter === 'published' && !s.is_published) return false
    if (filter === 'draft'     &&  s.is_published) return false
    if (filter === 'inactive'  &&  s.is_active)    return false
    return true
  })

  const statusInfo = (s: Schedule) => {
    if (!s.is_active)   return { label: 'Cancelled', variant: 'red'   as const, icon: <XCircle size={11} /> }
    if (s.is_published) return { label: 'Published', variant: 'green' as const, icon: <CheckCircle size={11} /> }
    return                     { label: 'Draft',     variant: 'gold'  as const, icon: <Clock size={11} /> }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            Jatha Schedule
            <span className="text-slate-400 font-normal text-sm ml-1">(जत्था शेड्यूल)</span>
          </h1>
          <p className="text-xs text-slate-400">{schedules.length} total schedules</p>
        </div>
        {isASO && (
          <Link to="/jatha-schedule/new">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold active:scale-95 touch-manipulation">
              <Plus size={13} /> New Schedule
            </button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['all', 'published', 'draft', 'inactive'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation capitalize',
                filter === f ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>
        {destinations.length > 2 && (
          <select
            value={destFilter}
            onChange={e => setDestFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
          >
            {destinations.map(d => (
              <option key={d} value={d}>{d === 'all' ? 'All Destinations' : d}</option>
            ))}
          </select>
        )}
      </div>

      {/* Schedule cards */}
      <div className="space-y-3">
        {loading && [...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-14 text-center">
            <Calendar size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No schedules found</p>
            {isASO && (
              <Link to="/jatha-schedule/new">
                <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                  Create Schedule
                </button>
              </Link>
            )}
          </div>
        )}

        {!loading && filtered.map(s => {
          const info = statusInfo(s)
          const pct  = s.total_required > 0
            ? Math.min(Math.round((s.total_assigned / s.total_required) * 100), 100)
            : null

          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="h-1 bg-maroon-500" />
              <div className="p-4">

                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-800">{s.jatha_name}</span>
                      <Badge variant={info.variant} className="text-[10px] flex items-center gap-1">
                        {info.icon} {info.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{s.destination} · {s.department}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(s.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(s.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Edit button — routes to form page */}
                  {isASO && (
                    <Link to={`/jatha-schedule/${s.id}`}>
                      <button className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-maroon-50 hover:text-maroon-600 transition-colors touch-manipulation">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-5 mb-3">
                  <div className="text-center">
                    <p className="text-base font-bold text-maroon-600">{s.centre_count}</p>
                    <p className="text-[10px] text-slate-400">Centres</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-navy-600">{s.total_assigned}</p>
                    <p className="text-[10px] text-slate-400">Assigned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-700">{s.total_required}</p>
                    <p className="text-[10px] text-slate-400">Required</p>
                  </div>
                  {pct !== null && (
                    <div className="text-center">
                      <p className={`text-base font-bold ${
                        pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {pct}%
                      </p>
                      <p className="text-[10px] text-slate-400">Filled</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {pct !== null && (
                  <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-maroon-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {/* Actions */}
                {isASO && (
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Link to={`/jatha-schedule/${s.id}`} className="flex-1">
                      <button className="w-full py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 touch-manipulation">
                        Edit / Manage
                      </button>
                    </Link>
                    <button
                      onClick={() => togglePublish(s)}
                      disabled={!s.is_active}
                      className={[
                        'flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 touch-manipulation disabled:opacity-40',
                        s.is_published
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-green-50 text-green-700 border border-green-200',
                      ].join(' ')}
                    >
                      {s.is_published
                        ? <><EyeOff size={11} /> Unpublish</>
                        : <><Eye size={11} /> Publish</>
                      }
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className={[
                        'px-3 py-2 rounded-lg text-xs font-medium touch-manipulation',
                        s.is_active
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-green-50 text-green-700 border border-green-200',
                      ].join(' ')}
                    >
                      {s.is_active ? 'Cancel' : 'Restore'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}