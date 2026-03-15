import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Calendar, Filter, ChevronRight,
  CheckCircle, Clock, XCircle, Eye, EyeOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id:          number
  jatha_name:  string
  destination: string
  department:  string
  is_bhati:    boolean
  from_date:   string
  to_date:     string
  is_active:   boolean
  is_published: boolean
  created_at:  string
  centre_count: number
  total_quota:  number
}

const FILTER_STATUS = ['all', 'published', 'draft', 'inactive'] as const
type FilterStatus = typeof FILTER_STATUS[number]

export default function JathaScheduleListPage() {
  const { user }                         = useAuth()
  const [schedules,   setSchedules]      = useState<Schedule[]>([])
  const [loading,     setLoading]        = useState(true)
  const [filter,      setFilter]         = useState<FilterStatus>('all')
  const [filterBhati, setFilterBhati]    = useState<'all' | 'bhati' | 'beas'>('all')

  useEffect(() => { fetchSchedules() }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      // Get schedules with centre count and total quota
      const { data } = await supabase
        .from('jatha_schedule')
        .select(`
          id, jatha_name, destination, department,
          is_bhati, from_date, to_date, is_active, is_published, created_at,
          jatha_quota (quota_count)
        `)
        .order('from_date', { ascending: false })

      if (data) {
        const enriched = data.map((s: any) => ({
          ...s,
          centre_count: s.jatha_quota?.length ?? 0,
          total_quota:  (s.jatha_quota ?? []).reduce((sum: number, q: any) => sum + (q.quota_count ?? 0), 0),
        }))
        setSchedules(enriched)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (schedule: Schedule) => {
    const newVal = !schedule.is_published
    await supabase
      .from('jatha_schedule')
      .update({ is_published: newVal })
      .eq('id', schedule.id)
    setSchedules(prev =>
      prev.map(s => s.id === schedule.id ? { ...s, is_published: newVal } : s)
    )
  }

  const toggleActive = async (schedule: Schedule) => {
    const newVal = !schedule.is_active
    await supabase
      .from('jatha_schedule')
      .update({ is_active: newVal })
      .eq('id', schedule.id)
    setSchedules(prev =>
      prev.map(s => s.id === schedule.id ? { ...s, is_active: newVal } : s)
    )
  }

  const filtered = schedules.filter(s => {
    if (filterBhati === 'bhati' && !s.is_bhati)  return false
    if (filterBhati === 'beas'  && s.is_bhati)   return false
    if (filter === 'published' && !s.is_published) return false
    if (filter === 'draft'     && s.is_published)  return false
    if (filter === 'inactive'  && s.is_active)     return false
    return true
  })

  const statusInfo = (s: Schedule) => {
    if (!s.is_active)   return { label: 'Cancelled', variant: 'red'   as const, icon: <XCircle size={12} /> }
    if (s.is_published) return { label: 'Published', variant: 'green' as const, icon: <CheckCircle size={12} /> }
    return               { label: 'Draft',     variant: 'gold'  as const, icon: <Clock size={12} /> }
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
        <Link to="/jatha-schedule/new">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation">
            <Plus size={13} /> New Schedule
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* Status filter */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {FILTER_STATUS.map(f => (
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

        {/* Type filter */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['all','bhati','beas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterBhati(f)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation capitalize',
                filterBhati === f ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500',
              ].join(' ')}
            >
              {f === 'all' ? 'All Types' : f === 'bhati' ? 'Bhati' : 'Beas/Outsttn'}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule list */}
      <div className="space-y-3">
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
            <Calendar size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No schedules found</p>
            <Link to="/jatha-schedule/new">
              <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                Create First Schedule
              </button>
            </Link>
          </div>
        )}

        {!loading && filtered.map(s => {
          const info = statusInfo(s)
          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Top accent bar */}
              <div className={`h-1 ${s.is_bhati ? 'bg-navy-500' : 'bg-maroon-500'}`} />

              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800">{s.jatha_name}</h3>
                      <Badge variant={info.variant} className="text-[10px] flex items-center gap-1">
                        {info.icon} {info.label}
                      </Badge>
                      <Badge variant={s.is_bhati ? 'navy' : 'maroon'} className="text-[10px]">
                        {s.is_bhati ? 'Bhati' : 'Beas / Outstation'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.destination} · {s.department}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(s.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <Link to={`/jatha-schedule/${s.id}`}>
                    <ChevronRight size={16} className="text-slate-300 hover:text-maroon-500 mt-1" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-maroon-600">{s.centre_count}</p>
                    <p className="text-[10px] text-slate-400">Centres</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-navy-600">{s.total_quota}</p>
                    <p className="text-[10px] text-slate-400">Total Quota</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <Link to={`/jatha-schedule/${s.id}`} className="flex-1">
                    <button className="w-full py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 touch-manipulation">
                      Manage Centres
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
                      ? <><EyeOff size={12} /> Unpublish</>
                      : <><Eye size={12} /> Publish</>
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
