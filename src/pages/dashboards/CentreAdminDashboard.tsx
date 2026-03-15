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
  from_date:     string
  to_date:       string
  quota:         number
  nr_id:         number | null
  nr_status:     string | null
  member_count:  number
  male_count:    number
  female_count:  number
}

const nrStatusConfig: Record<string, { label: string; labelHi: string; color: string; bar: string }> = {
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
      const [swRes, quotaRes] = await Promise.all([
        supabase.from('sewadars')
          .select('*', { count: 'exact', head: true })
          .eq('centre', user.centre).eq('is_active', true),

        // Fetch quotas for this centre from published active schedules
        supabase.from('sewa_quota')
          .select(`
            quota_count,
            sewa_schedule!sewa_quota_sewa_schedule_id_fkey (
              id, jatha_name, destination, department,
              from_date, to_date, is_published, is_active
            )
          `)
          .eq('centre', user.centre)
          .gt('quota_count', 0),
      ])

      setSewadarsCount(swRes.count ?? 0)

      // Filter: only published + active schedules
      const validQuotas = (quotaRes.data ?? []).filter(
        (q: any) => q.sewa_schedule?.is_published && q.sewa_schedule?.is_active
      )

      if (validQuotas.length === 0) {
        setCards([])
        setLoading(false)
        return
      }

      const scheduleIds = validQuotas.map((q: any) => q.sewa_schedule?.id).filter(Boolean)

      // Check if NR exists for each schedule
      const { data: nrData } = await supabase
        .from('nominal_roles')
        .select('id, status, jatha_schedule_id, member_count:nr_members(count), male_count:nr_members!inner(count), female_count:nr_members!inner(count)')
        .eq('centre', user.centre)
        .in('jatha_schedule_id', scheduleIds)

      // Simplified NR fetch
      const { data: nrSimple } = await supabase
        .from('v_nr_summary')
        .select('id, status, jatha_schedule_id, member_count, male_count, female_count')
        .eq('centre', user.centre)
        .in('jatha_schedule_id' as any, scheduleIds)

      const nrMap = new Map((nrSimple ?? []).map((nr: any) => [nr.jatha_schedule_id, nr]))

      const jathaCards: JathaCard[] = validQuotas.map((q: any) => {
        const s  = q.sewa_schedule
        const nr = nrMap.get(s.id)
        return {
          schedule_id:  s.id,
          jatha_name:   s.jatha_name,
          destination:  s.destination,
          department:   s.department,
          from_date:    s.from_date,
          to_date:      s.to_date,
          quota:        q.quota_count,
          nr_id:        nr?.id ?? null,
          nr_status:    nr?.status ?? null,
          member_count: nr?.member_count ?? 0,
          male_count:   nr?.male_count ?? 0,
          female_count: nr?.female_count ?? 0,
        }
      }).sort((a: JathaCard, b: JathaCard) =>
        new Date(a.from_date).getTime() - new Date(b.from_date).getTime()
      )

      setCards(jathaCards)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const activeCards = cards.filter(c => new Date(c.to_date) >= new Date())
  const pastCards   = cards.filter(c => new Date(c.to_date) < new Date())

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{user?.centre}</h2>
          <p className="text-xs text-slate-400">Centre Admin · केंद्र प्रबंधक</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-maroon-50 border border-maroon-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-maroon-600">{sewadarsCount}</p>
          <p className="text-[10px] text-slate-400">Sewadars</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">{cards.filter(c => !c.nr_id || c.nr_status === 'draft').length}</p>
          <p className="text-[10px] text-slate-400">NRs Pending</p>
        </div>
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-navy-600">{activeCards.length}</p>
          <p className="text-[10px] text-slate-400">Active Jathas</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : activeCards.length === 0 ? (
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Past Jathas</p>
              <div className="space-y-3 opacity-70">
                {pastCards.map(card => <JathaCardView key={card.schedule_id} card={card} />)}
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/sewadars" className="flex items-center gap-3 p-4 bg-navy-50 border border-navy-100 rounded-xl active:scale-95 touch-manipulation">
          <Users size={18} className="text-navy-600" />
          <div><p className="text-sm font-semibold text-navy-700">Sewadars</p><p className="text-[10px] text-navy-400">सेवादार</p></div>
        </Link>
        <Link to="/reports" className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl active:scale-95 touch-manipulation">
          <FileText size={18} className="text-green-600" />
          <div><p className="text-sm font-semibold text-green-700">Reports</p><p className="text-[10px] text-green-400">रिपोर्ट</p></div>
        </Link>
      </div>
    </div>
  )
}

function JathaCardView({ card }: { card: JathaCard }) {
  const cfg   = card.nr_status ? nrStatusConfig[card.nr_status] : null
  const pct   = card.quota > 0 ? Math.min(Math.round((card.member_count / card.quota) * 100), 100) : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="h-1 bg-maroon-500" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 mb-0.5 leading-tight">{card.jatha_name}</h3>
            <p className="text-xs text-slate-500">{card.destination} · {card.department}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date(card.from_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              {' – '}
              {new Date(card.to_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-maroon-600">{card.quota}</p>
            <p className="text-[10px] text-slate-400">Quota</p>
          </div>
        </div>

        {card.nr_id && cfg && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
                {cfg.label} · {cfg.labelHi}
              </span>
              <span className="text-xs text-slate-500">
                {card.member_count} members · M:{card.male_count} F:{card.female_count}
              </span>
            </div>
            {pct !== null && (
              <div className="mb-3">
                <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{pct}% of quota</p>
              </div>
            )}
          </>
        )}

        <div className="pt-3 border-t border-slate-100">
          {!card.nr_id ? (
            <Link to={`/nominal-roles/new?schedule=${card.schedule_id}`}>
              <button className="w-full py-2.5 bg-maroon-600 text-white rounded-lg text-xs font-semibold active:scale-95 touch-manipulation">
                Create Nominal Role →
              </button>
            </Link>
          ) : (
            <Link to={`/nominal-roles/${card.nr_id}`}>
              <button className="w-full py-2.5 border border-maroon-200 text-maroon-700 rounded-lg text-xs font-semibold active:scale-95 touch-manipulation flex items-center justify-center gap-1.5">
                {card.nr_status === 'draft' ? 'Continue NR' : 'View NR'} <ChevronRight size={12} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
