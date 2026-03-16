import { useState, useEffect } from 'react'
import { FileText, Users, ChevronRight, Calendar, Check, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/index'
import { useAuth } from '@/hooks/useAuth'

interface JathaCard {
  schedule_id:    number
  jatha_name:     string
  destination:    string
  department:     string
  from_date:      string
  to_date:        string
  quota:          number          // parent centre's ASO quota
  sub_quota:      number          // my sub-centre quota (if sub-centre)
  nr_id:          number | null
  nr_status:      string | null
  nr_owner:       string | null   // which centre owns this NR
  my_member_count: number         // how many members I've added
  total_count:    number          // total across all sections
  sections_ready: number
  sections_total: number
  is_owner:       boolean
}

export default function CentreAdminDashboard() {
  const { user }                           = useAuth()
  const [cards,         setCards]          = useState<JathaCard[]>([])
  const [sewadarsCount, setSewadarsCount]  = useState(0)
  const [parentCentre,  setParentCentre]   = useState<string | null>(null)
  const [isSubCentre,   setIsSubCentre]    = useState(false)
  const [loading,       setLoading]        = useState(true)

  useEffect(() => { if (user) fetchData() }, [user])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Check if sub-centre
      const { data: centreData } = await supabase
        .from('centres').select('centre_name, parent_centre')
        .eq('centre_name', user.centre).single()
      const isSub = centreData?.parent_centre !== centreData?.centre_name
      setIsSubCentre(isSub)
      setParentCentre(isSub ? centreData?.parent_centre ?? null : null)

      // Sewadar count
      const { count } = await supabase.from('sewadars')
        .select('*', { count: 'exact', head: true })
        .eq('centre', user.centre).eq('is_active', true)
      setSewadarsCount(count ?? 0)

      // Get schedules assigned to this centre (or parent centre if sub-centre)
      const quotaCentre = isSub ? (centreData?.parent_centre ?? user.centre) : user.centre

      const { data: quotaData } = await supabase
        .from('sewa_quota')
        .select('quota_count, sewa_schedule_id')
        .eq('centre', quotaCentre)
        .gt('quota_count', 0)

      if (!quotaData || quotaData.length === 0) {
        setCards([])
        setLoading(false)
        return
      }

      const scheduleIds = quotaData.map((q: any) => q.sewa_schedule_id)
      const quotaMap    = new Map(quotaData.map((q: any) => [q.sewa_schedule_id, q.quota_count]))

      // Get schedule details
      const { data: schedData } = await supabase
        .from('sewa_schedule')
        .select('id,jatha_name,destination,department,from_date,to_date,is_published,is_active')
        .in('id', scheduleIds)
        .eq('is_published', true).eq('is_active', true)
        .order('from_date')

      if (!schedData) { setCards([]); setLoading(false); return }

      // Get sub-centre quota if sub-centre
      let subQuotaMap = new Map<number, number>()
      if (isSub) {
        const { data: scqData } = await supabase
          .from('sub_centre_quota')
          .select('quota_count, sewa_schedule_id')
          .eq('sub_centre', user.centre)
          .in('sewa_schedule_id', scheduleIds)
        subQuotaMap = new Map((scqData ?? []).map((q: any) => [q.sewa_schedule_id, q.quota_count]))
      }

      // Get NRs — owner is parent centre (or this centre if main)
      const nrOwner = isSub ? (centreData?.parent_centre ?? user.centre) : user.centre
      const { data: nrData } = await supabase
        .from('v_nr_summary')
        .select('id,status,sewa_schedule_id,member_count,centre,sections_ready,sections_total')
        .eq('centre', nrOwner)
        .in('sewa_schedule_id', scheduleIds)

      const nrMap = new Map((nrData ?? []).map((nr: any) => [nr.sewa_schedule_id, nr]))

      // Get my contributed member counts
      const nrIds = (nrData ?? []).map((nr: any) => nr.id)
      let myCountMap = new Map<number, number>()
      if (nrIds.length > 0) {
        const { data: myMembers } = await supabase
          .from('nr_members')
          .select('nominal_role_id')
          .eq('contributing_centre', user.centre)
          .in('nominal_role_id', nrIds)
        const counts = new Map<number, number>()
        for (const m of (myMembers ?? [])) {
          counts.set(m.nominal_role_id, (counts.get(m.nominal_role_id) ?? 0) + 1)
        }
        // Map back to schedule_id
        for (const nr of (nrData ?? [])) {
          myCountMap.set(nr.sewa_schedule_id, counts.get(nr.id) ?? 0)
        }
      }

      const jathaCards: JathaCard[] = schedData.map((s: any) => {
        const nr = nrMap.get(s.id)
        return {
          schedule_id:     s.id,
          jatha_name:      s.jatha_name,
          destination:     s.destination,
          department:      s.department,
          from_date:       s.from_date,
          to_date:         s.to_date,
          quota:           quotaMap.get(s.id) ?? 0,
          sub_quota:       subQuotaMap.get(s.id) ?? 0,
          nr_id:           nr?.id ?? null,
          nr_status:       nr?.status ?? null,
          nr_owner:        nr?.centre ?? null,
          my_member_count: myCountMap.get(s.id) ?? 0,
          total_count:     nr?.member_count ?? 0,
          sections_ready:  nr?.sections_ready ?? 0,
          sections_total:  nr?.sections_total ?? 0,
          is_owner:        !isSub,
        }
      })

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
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400">Centre Admin</p>
            {isSubCentre && parentCentre && (
              <Badge variant="navy" className="text-[9px]">Sub-centre of {parentCentre}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-maroon-50 border border-maroon-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-maroon-600">{sewadarsCount}</p>
          <p className="text-[10px] text-slate-400">Sewadars</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-600">
            {cards.filter(c => c.nr_id && c.nr_status === 'draft').length}
          </p>
          <p className="text-[10px] text-slate-400">NRs Open</p>
        </div>
        <div className="bg-navy-50 border border-navy-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-navy-600">{activeCards.length}</p>
          <p className="text-[10px] text-slate-400">Jathas</p>
        </div>
      </div>

      {/* Jatha cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_,i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}
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
                {activeCards.map(card => (
                  <JathaCardView
                    key={card.schedule_id}
                    card={card}
                    isSubCentre={isSubCentre}
                    parentCentre={parentCentre}
                  />
                ))}
              </div>
            </div>
          )}
          {pastCards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Past Jathas</p>
              <div className="space-y-3 opacity-70">
                {pastCards.map(card => (
                  <JathaCardView key={card.schedule_id} card={card} isSubCentre={isSubCentre} parentCentre={parentCentre} />
                ))}
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

function JathaCardView({ card, isSubCentre, parentCentre }: {
  card: JathaCard; isSubCentre: boolean; parentCentre: string | null
}) {
  const effectiveQuota = isSubCentre ? card.sub_quota : card.quota
  const myCount        = card.my_member_count
  const pct            = effectiveQuota > 0 ? Math.min(Math.round((myCount / effectiveQuota) * 100), 100) : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="h-1 bg-maroon-500" />
      <div className="p-4">

        {/* Title */}
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
            <p className="text-lg font-bold text-maroon-600">{effectiveQuota || card.quota}</p>
            <p className="text-[10px] text-slate-400">{isSubCentre ? 'My Quota' : 'Quota'}</p>
          </div>
        </div>

        {/* Stats */}
        {card.nr_id && (
          <div className="space-y-2 mb-3">
            {/* My contribution */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">My section</span>
              <span className="font-semibold text-maroon-600">{myCount} members</span>
            </div>

            {/* Section readiness (show for owner) */}
            {card.is_owner && card.sections_total > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Sections ready</span>
                <span className={`font-semibold ${
                  card.sections_ready === card.sections_total ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {card.sections_ready}/{card.sections_total}
                </span>
              </div>
            )}

            {/* Total NR count */}
            {card.is_owner && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Total in NR</span>
                <span className="font-semibold text-slate-700">{card.total_count}</span>
              </div>
            )}

            {/* Progress bar for my section */}
            {pct !== null && (
              <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${
                  pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-maroon-500'
                }`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        <div className="pt-3 border-t border-slate-100">
          {!card.nr_id ? (
            // No NR exists yet
            card.is_owner ? (
              // Owner creates the NR
              <Link to={`/nominal-roles/new?schedule=${card.schedule_id}`}>
                <button className="w-full py-2.5 bg-maroon-600 text-white rounded-lg text-xs font-semibold active:scale-95 touch-manipulation">
                  Create Nominal Role →
                </button>
              </Link>
            ) : (
              // Sub-centre waiting for parent to create NR
              <div className="text-center py-1">
                <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                  <Clock size={12} /> Waiting for {parentCentre} to create NR
                </p>
              </div>
            )
          ) : (
            // NR exists — link to add/view members
            <Link to={`/nominal-roles/${card.nr_id}`}>
              <button className={[
                'w-full py-2.5 rounded-lg text-xs font-semibold active:scale-95 touch-manipulation flex items-center justify-center gap-1.5',
                card.nr_status === 'draft'
                  ? 'border border-maroon-200 text-maroon-700'
                  : 'border border-slate-200 text-slate-600',
              ].join(' ')}>
                {card.nr_status === 'draft' && !card.is_owner ? 'Add My Members' :
                 card.nr_status === 'draft' && card.is_owner ? 'Manage NR' :
                 'View NR'}
                <ChevronRight size={12} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
