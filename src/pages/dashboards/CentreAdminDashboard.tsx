import { useState, useEffect } from 'react'
import { FileText, Users, PlusCircle, ChevronRight, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/index'
import { useAuth } from '@/hooks/useAuth'

interface JathaCard {
  schedule_id:   number
  jatha_name:    string
  destination:   string
  department:    string
  is_bhati:      boolean
  from_date:     string
  to_date:       string
  quota:         number
  nr_id:         number | null
  nr_status:     string | null
  member_count:  number
  male_count:    number
  female_count:  number
}

const nrStatusConfig = {
  draft:     { label: 'Draft',     labelHi: 'मसौदा',    color: 'bg-slate-100 text-slate-600 border-slate-200',    bar: 'bg-slate-400' },
  submitted: { label: 'Submitted', labelHi: 'जमा',      color: 'bg-navy-100 text-navy-700 border-navy-200',       bar: 'bg-navy-500' },
  approved:  { label: 'Approved',  labelHi: 'स्वीकृत',  color: 'bg-green-100 text-green-700 border-green-200',    bar: 'bg-green-500' },
  issued:    { label: 'Issued',    labelHi: 'जारी',      color: 'bg-maroon-100 text-maroon-700 border-maroon-200', bar: 'bg-maroon-500' },
  rejected:  { label: 'Rejected',  labelHi: 'अस्वीकृत', color: 'bg-red-100 text-red-700 border-red-200',         bar: 'bg-red-500' },
}

export default function CentreAdminDashboard() {
  const { user }                           = useAuth()
  const [cards,         setCards]          = useState<JathaCard[]>([])
  const [sewadarsCount, setSewadarsCount]  = useState(0)
  const [loading,       setLoading]        = useState(true)

  useEffect(() => { if (user) fetchData() }, [user])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [swRes, scheduleRes] = await Promise.all([
        // Sewadar count
        supabase.from('sewadars')
          .select('*', { count: 'exact', head: true })
          .eq('centre', user.centre)
          .eq('is_active', true),

        // Jatha schedules assigned to this centre (published only via RLS)
        supabase.from('jatha_quota')
          .select(`
            quota_count,
            jatha_schedule!jatha_quota_jatha_schedule_id_fkey (
              id, jatha_name, destination, department,
              is_bhati, from_date, to_date, is_active, is_published
            )
          `)
          .eq('centre', user.centre)
          .order('created_at', { ascending: false }),
      ])

      setSewadarsCount(swRes.count ?? 0)

      // For each schedule, check if this centre has an NR
      const schedules = (scheduleRes.data ?? [])
        .filter((q: any) => q.jatha_schedule?.is_active && q.jatha_schedule?.is_published)

      const scheduleIds = schedules.map((q: any) => q.jatha_schedule?.id).filter(Boolean)

      const { data: nrData } = await supabase
        .from('v_nr_summary')
        .select('*')
        .eq('centre', user.centre)
        .in('jatha_schedule_id' as any, scheduleIds)

      const nrMap = new Map((nrData ?? []).map((nr: any) => [nr.jatha_schedule_id ?? 0, nr]))

      const jathaCards: JathaCard[] = schedules.map((q: any) => {
        const s  = q.jatha_schedule
        const nr = nrMap.get(s.id)
        return {
          schedule_id:  s.id,
          jatha_name:   s.jatha_name,
          destination:  s.destination,
          department:   s.department,
          is_bhati:     s.is_bhati,
          from_date:    s.from_date,
          to_date:      s.to_date,
          quota:        q.quota_count,
          nr_id:        nr?.id ?? null,
          nr_status:    nr?.status ?? null,
          member_count: nr?.member_count ?? 0,
          male_count:   nr?.male_count ?? 0,
          female_count: nr?.female_count ?? 0,
        }
      })

      // Sort: active jathas first, then by date
      jathaCards.sort((a, b) => new Date(a.from_date).getTime() - new Date(b.from_date).getTime())
      setCards(jathaCards)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const activeCards  = cards.filter(c => new Date(c.to_date) >= new Date())
  const pastCards    = cards.filter(c => new Date(c.to_date) < new Date())
  const pendingNRs   = cards.filter(c => !c.nr_id).length
  const draftNRs     = cards.filter(c => c.nr_status === 'draft').length

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
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-maroon-50 border border-maroon-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-maroon-600">{sewadarsCount}</p>
          <p className="text-[10px] text-slate-400">Sewadars</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{pendingNRs + draftNRs}</p>
          <p className="text-[10px] text-slate-400">NRs Pending</p>
        </div>
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-navy-600">{activeCards.length}</p>
          <p className="text-[10px] text-slate-400">Active Jathas</p>
        </div>
      </div>

      {/* Jatha cards — upcoming */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : activeCards.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-10 text-center">
          <Calendar size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No jatha schedules assigned</p>
          <p className="text-xs text-slate-300 mt-1">ASO will assign schedules to your centre</p>
        </div>
      ) : (
        <>
          {activeCards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Upcoming Jathas ({activeCards.length})
              </p>
              <div className="space-y-3">
                {activeCards.map(card => <JathaCardView key={card.schedule_id} card={card} />)}
              </div>
            </div>
          )}

          {pastCards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Past Jathas ({pastCards.length})
              </p>
              <div className="space-y-3 opacity-70">
                {pastCards.map(card => <JathaCardView key={card.schedule_id} card={card} />)}
              </div>
            </div>
          )}
        </>
      )}

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

function JathaCardView({ card }: { card: JathaCard }) {
  const cfg       = card.nr_status ? nrStatusConfig[card.nr_status as keyof typeof nrStatusConfig] : null
  const pct       = card.quota > 0 ? Math.min(Math.round((card.member_count / card.quota) * 100), 100) : null
  const hasNR     = !!card.nr_id
  const isPast    = new Date(card.to_date) < new Date()

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isPast ? 'border-slate-100' : 'border-slate-200'}`}>
      {/* Colour accent top */}
      <div className={`h-1 ${card.is_bhati ? 'bg-navy-500' : 'bg-maroon-500'}`} />

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{card.jatha_name}</h3>
              <Badge variant={card.is_bhati ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">
                {card.is_bhati ? 'Bhati' : 'Beas'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">{card.destination} · {card.department}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date(card.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(card.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Quota badge */}
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-maroon-600">{card.quota}</p>
            <p className="text-[10px] text-slate-400">Quota</p>
          </div>
        </div>

        {/* NR status + members */}
        {hasNR && cfg && (
          <div className="flex items-center justify-between mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
              {cfg.label} · {cfg.labelHi}
            </span>
            <span className="text-xs text-slate-500">
              {card.member_count} members · M:{card.male_count} F:{card.female_count}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {hasNR && pct !== null && (
          <div className="mb-3">
            <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${cfg?.bar ?? 'bg-slate-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{pct}% of quota</p>
          </div>
        )}

        {/* Action button */}
        <div className="pt-3 border-t border-slate-100">
          {!hasNR ? (
            <Link to={`/nominal-roles/new?schedule=${card.schedule_id}`}>
              <button className="w-full py-2.5 bg-maroon-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition-transform touch-manipulation">
                Create Nominal Role →
              </button>
            </Link>
          ) : (
            <Link to={`/nominal-roles/${card.nr_id}`}>
              <button className="w-full py-2.5 border border-maroon-200 text-maroon-700 rounded-lg text-xs font-semibold active:scale-95 transition-transform touch-manipulation flex items-center justify-center gap-1.5">
                {card.nr_status === 'draft' ? 'Continue NR' : 'View NR'}
                <ChevronRight size={12} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
