import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronRight, CheckCircle, Clock, XCircle, Send, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface NRSummary {
  id:           number
  centre:       string
  status:       string
  srs_id:       string | null
  jatha_name:   string | null
  destination:  string | null
  department:   string | null
  from_date:    string | null
  to_date:      string | null
  quota:        number
  member_count: number
  male_count:   number
  female_count: number
  submitted_at: string | null
  approved_at:  string | null
}

const statusConfig: Record<string, { label: string; labelHi: string; variant: 'gray' | 'navy' | 'green' | 'maroon' | 'red'; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',     labelHi: 'मसौदा',    variant: 'gray',   icon: <Clock size={11} /> },
  submitted: { label: 'Submitted', labelHi: 'जमा',      variant: 'navy',   icon: <Send size={11} /> },
  approved:  { label: 'Approved',  labelHi: 'स्वीकृत',  variant: 'green',  icon: <CheckCircle size={11} /> },
  issued:    { label: 'Issued',    labelHi: 'जारी',      variant: 'maroon', icon: <FileText size={11} /> },
  rejected:  { label: 'Rejected',  labelHi: 'अस्वीकृत', variant: 'red',    icon: <XCircle size={11} /> },
}

type FilterStatus = 'all' | 'draft' | 'submitted' | 'approved' | 'issued' | 'rejected'

export default function NRListPage() {
  const { user }                      = useAuth()
  const [nrs,     setNRs]             = useState<NRSummary[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter,  setFilter]          = useState<FilterStatus>('all')
  const isASO = user?.role === 'aso'

  useEffect(() => { if (user) fetchNRs() }, [user])

  const fetchNRs = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('v_nr_summary')
        .select('*')
        .order('submitted_at', { ascending: false })

      setNRs((data ?? []) as NRSummary[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = nrs.filter(n => filter === 'all' || n.status === filter)

  const counts = {
    all:       nrs.length,
    draft:     nrs.filter(n => n.status === 'draft').length,
    submitted: nrs.filter(n => n.status === 'submitted').length,
    approved:  nrs.filter(n => n.status === 'approved').length,
    issued:    nrs.filter(n => n.status === 'issued').length,
    rejected:  nrs.filter(n => n.status === 'rejected').length,
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            Nominal Roles
            <span className="text-slate-400 font-normal text-sm ml-1">(नॉमिनल रोल)</span>
          </h1>
          <p className="text-xs text-slate-400">
            {isASO ? `${nrs.length} total across all centres` : user?.centre}
          </p>
        </div>
        {!isASO && (
          <Link to="/nominal-roles/new">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold active:scale-95 touch-manipulation">
              <Plus size={13} /> New NR
            </button>
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(counts) as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all touch-manipulation capitalize',
              filter === f
                ? 'bg-maroon-600 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-maroon-300',
            ].join(' ')}
          >
            {f}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* NR list */}
      <div className="space-y-3">
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
            <FileText size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No nominal roles found</p>
            {!isASO && (
              <Link to="/jatha-schedule">
                <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                  View Jatha Schedules
                </button>
              </Link>
            )}
          </div>
        )}

        {!loading && filtered.map(nr => {
          const cfg = statusConfig[nr.status] ?? statusConfig.draft
          const pct = nr.quota > 0
            ? Math.min(Math.round((nr.member_count / nr.quota) * 100), 100)
            : null

          return (
            <Link key={nr.id} to={`/nominal-roles/${nr.id}`}>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden active:bg-slate-50 transition-colors">
                <div className={`h-1 ${
                  nr.status === 'approved' || nr.status === 'issued' ? 'bg-green-500' :
                  nr.status === 'submitted' ? 'bg-navy-500' :
                  nr.status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'
                }`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {nr.jatha_name ?? `${nr.destination} ${nr.department} Jatha`}
                        </span>
                        <Badge variant={cfg.variant} className="text-[10px] flex items-center gap-1 flex-shrink-0">
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </div>
                      {isASO && (
                        <p className="text-xs font-medium text-navy-600">{nr.centre}</p>
                      )}
                      <p className="text-xs text-slate-500">{nr.destination} · {nr.department}</p>
                      {nr.from_date && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(nr.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' – '}
                          {new Date(nr.to_date!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm font-bold text-maroon-600">{nr.member_count}</p>
                      <p className="text-[10px] text-slate-400">Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-navy-600">M:{nr.male_count} F:{nr.female_count}</p>
                      <p className="text-[10px] text-slate-400">Gender</p>
                    </div>
                    {nr.quota > 0 && (
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-600">{nr.quota}</p>
                        <p className="text-[10px] text-slate-400">Quota</p>
                      </div>
                    )}
                    {nr.srs_id && (
                      <div>
                        <p className="text-[10px] font-mono text-slate-500">SRS: {nr.srs_id}</p>
                      </div>
                    )}
                  </div>

                  {pct !== null && (
                    <div className="mt-2">
                      <div className="bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full ${
                          pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-maroon-500'
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
