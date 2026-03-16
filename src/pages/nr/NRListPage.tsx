import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, ChevronRight, CheckCircle, Clock,
  XCircle, Send, Plus, Award, ThumbsDown, ThumbsUp,
} from 'lucide-react'
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

type BadgeVariant = 'gray' | 'navy' | 'green' | 'maroon' | 'red' | 'gold'

const STATUS_CONFIG: Record<string, {
  label: string; labelHi: string
  variant: BadgeVariant; icon: React.ReactNode
}> = {
  draft: {
    label: 'Draft', labelHi: 'मसौदा',
    variant: 'gray', icon: <Clock size={11} />,
  },
  submitted_to_centre: {
    label: 'At Centre', labelHi: 'केंद्र पर',
    variant: 'navy', icon: <Send size={11} />,
  },
  centre_approved: {
    label: 'Centre OK', labelHi: 'केंद्र स्वीकृत',
    variant: 'gold', icon: <ThumbsUp size={11} />,
  },
  centre_rejected: {
    label: 'Centre Rejected', labelHi: 'केंद्र अस्वीकृत',
    variant: 'red', icon: <ThumbsDown size={11} />,
  },
  submitted: {
    label: 'Submitted to HQ', labelHi: 'मुख्यालय को जमा',
    variant: 'navy', icon: <Send size={11} />,
  },
  approved: {
    label: 'Approved', labelHi: 'स्वीकृत',
    variant: 'green', icon: <CheckCircle size={11} />,
  },
  rejected: {
    label: 'Rejected', labelHi: 'अस्वीकृत',
    variant: 'red', icon: <XCircle size={11} />,
  },
  issued: {
    label: 'Issued', labelHi: 'जारी',
    variant: 'maroon', icon: <Award size={11} />,
  },
}

type FilterStatus =
  | 'all'
  | 'draft'
  | 'submitted_to_centre'
  | 'centre_approved'
  | 'centre_rejected'
  | 'submitted'
  | 'approved'
  | 'issued'
  | 'rejected'

// Only show filters that have > 0 items, plus "all"
const FILTER_ORDER: FilterStatus[] = [
  'all', 'draft', 'submitted_to_centre', 'centre_approved',
  'centre_rejected', 'submitted', 'approved', 'issued', 'rejected',
]

export default function NRListPage() {
  const { user }              = useAuth()
  const [nrs,     setNRs]     = useState<NRSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<FilterStatus>('all')
  const isASO = user?.role === 'aso'

  useEffect(() => { if (user) fetchNRs() }, [user])

  const fetchNRs = async () => {
    if (!user) return
    setLoading(true)
    try {
      let q = supabase.from('v_nr_summary').select('*')
      // Centre admins only see their own centre's NRs
      if (!isASO) q = q.eq('centre', user.centre)
      const { data } = await q.order('submitted_at', { ascending: false, nullsFirst: false })
      setNRs((data ?? []) as NRSummary[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all' ? nrs : nrs.filter(n => n.status === filter)

  const counts = FILTER_ORDER.reduce((acc, f) => {
    acc[f] = f === 'all' ? nrs.length : nrs.filter(n => n.status === f).length
    return acc
  }, {} as Record<FilterStatus, number>)

  // Only show filter tabs that have data (always show 'all')
  const visibleFilters = FILTER_ORDER.filter(f => f === 'all' || counts[f] > 0)

  const statusBarColor = (status: string) => {
    if (status === 'approved' || status === 'issued' || status === 'centre_approved') return 'bg-green-500'
    if (status === 'submitted' || status === 'submitted_to_centre') return 'bg-navy-500'
    if (status === 'rejected' || status === 'centre_rejected') return 'bg-red-500'
    return 'bg-slate-300'
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

      {/* Status filter tabs — only show statuses with data */}
      {!loading && (
        <div className="flex gap-1.5 flex-wrap">
          {visibleFilters.map(f => {
            const cfg = STATUS_CONFIG[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all touch-manipulation',
                  filter === f
                    ? 'bg-maroon-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-maroon-300',
                ].join(' ')}
              >
                {f === 'all' ? 'All' : cfg?.label ?? f}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[f]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* NR list */}
      <div className="space-y-3">
        {loading && [...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
            <FileText size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              {filter === 'all' ? 'No nominal roles found' : `No NRs with status "${STATUS_CONFIG[filter]?.label ?? filter}"`}
            </p>
            {!isASO && filter === 'all' && (
              <Link to="/jatha-schedule">
                <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                  View Jatha Schedules
                </button>
              </Link>
            )}
          </div>
        )}

        {!loading && filtered.map(nr => {
          const cfg = STATUS_CONFIG[nr.status] ?? STATUS_CONFIG.draft
          const pct = nr.quota > 0
            ? Math.min(Math.round((nr.member_count / nr.quota) * 100), 100)
            : null

          return (
            <Link key={nr.id} to={`/nominal-roles/${nr.id}`}>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden active:bg-slate-50 transition-colors touch-manipulation">
                <div className={`h-1 ${statusBarColor(nr.status)}`} />
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
                        <p className={`text-sm font-bold ${
                          nr.member_count > nr.quota ? 'text-red-600' :
                          nr.member_count === nr.quota ? 'text-green-600' : 'text-slate-600'
                        }`}>{nr.member_count}/{nr.quota}</p>
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