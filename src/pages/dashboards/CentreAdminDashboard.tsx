import { useState, useEffect } from 'react'
import { FileText, Users, PlusCircle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/index'
import { useAuth } from '@/hooks/useAuth'
import type { NRSummary } from '@/types'

const statusConfig = {
  draft:     { label: 'Draft',     labelHi: 'मसौदा',    variant: 'gray'   as const, barColor: 'bg-slate-300' },
  submitted: { label: 'Submitted', labelHi: 'जमा किया', variant: 'navy'   as const, barColor: 'bg-navy-500' },
  approved:  { label: 'Approved',  labelHi: 'स्वीकृत',  variant: 'green'  as const, barColor: 'bg-green-500' },
  issued:    { label: 'Issued',    labelHi: 'जारी',      variant: 'maroon' as const, barColor: 'bg-maroon-500' },
  rejected:  { label: 'Rejected',  labelHi: 'अस्वीकृत', variant: 'red'    as const, barColor: 'bg-red-500' },
}

export default function CentreAdminDashboard() {
  const { user }                              = useAuth()
  const [nrs,           setNRs]              = useState<NRSummary[]>([])
  const [sewadarsCount, setSewadarsCount]    = useState(0)
  const [loading,       setLoading]          = useState(true)

  useEffect(() => { if (user) fetchData() }, [user])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [nrRes, swRes] = await Promise.all([
        supabase.from('v_nr_summary').select('*').eq('centre', user.centre).order('from_date', { ascending: false }).limit(10),
        supabase.from('sewadars').select('*', { count: 'exact', head: true }).eq('centre', user.centre).eq('is_active', true),
      ])
      setNRs((nrRes.data ?? []) as NRSummary[])
      setSewadarsCount(swRes.count ?? 0)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const counts = {
    draft:     nrs.filter(n => n.status === 'draft').length,
    submitted: nrs.filter(n => n.status === 'submitted').length,
    issued:    nrs.filter(n => n.status === 'issued').length,
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{user?.centre}</h2>
          <p className="text-xs text-slate-400">Centre Admin · केंद्र प्रबंधक</p>
        </div>
        <Link to="/nominal-roles/new">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation">
            <PlusCircle size={13} /> New NR
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-maroon-50 border border-maroon-100 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Centre Sewadars</p>
          <p className="text-2xl font-bold text-maroon-600">{sewadarsCount}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">NRs Active</p>
          <p className="text-2xl font-bold text-slate-700">{nrs.length}</p>
        </div>
      </div>

      {/* NR status strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Draft',     value: counts.draft,     color: 'text-slate-600',  bg: 'bg-slate-50'  },
          { label: 'Submitted', value: counts.submitted, color: 'text-navy-600',   bg: 'bg-navy-50'   },
          { label: 'Issued',    value: counts.issued,    color: 'text-maroon-600', bg: 'bg-maroon-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* NR list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">Nominal Roles</h3>
          </div>
        </div>

        {loading && (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && nrs.length === 0 && (
          <div className="px-4 py-10 text-center">
            <FileText size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-1">No Nominal Roles yet</p>
            <p className="text-xs text-slate-300">Jatha schedules from HQ will appear here</p>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {nrs.map(nr => {
            const cfg = statusConfig[nr.status]
            const pct = nr.quota > 0 ? Math.min(Math.round((nr.member_count / nr.quota) * 100), 100) : null

            return (
              <Link key={nr.id} to={`/nominal-roles/${nr.id}`}>
                <div className="px-4 py-4 active:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 truncate">{nr.jatha_name}</span>
                        <Badge variant={cfg.variant} className="text-[9px] flex-shrink-0">{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{nr.destination} · {nr.department}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{nr.schedule_dates}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{nr.member_count}</span>
                      {nr.quota > 0 && <span className="text-slate-400"> / {nr.quota}</span>}
                      <span className="text-slate-400"> sewadars · M:{nr.male_count} F:{nr.female_count}</span>
                    </span>
                  </div>

                  {pct !== null && (
                    <div className="mt-2">
                      <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/sewadars" className="flex items-center gap-3 p-4 bg-navy-50 border border-navy-100 rounded-xl active:scale-95 transition-all touch-manipulation">
          <Users size={18} className="text-navy-600" />
          <div>
            <p className="text-sm font-semibold text-navy-700">Sewadars</p>
            <p className="text-[10px] text-navy-400">सेवादार सूची</p>
          </div>
        </Link>
        <Link to="/reports" className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl active:scale-95 transition-all touch-manipulation">
          <FileText size={18} className="text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-700">Reports</p>
            <p className="text-[10px] text-green-400">रिपोर्ट</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
