import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SubCentreQuotaPanel } from '@/components/jatha/SubCentreQuotaPanel'

// ── 18 Main Centres in exact sequence ──────────────────────────
const MAIN_CENTRES = [
  'ANKHEER',
  'BALLABGARH',
  'BAROLI',
  'DLF CITY GURGAON',
  'FIROZPUR JHIRKA',
  'GURGAON',
  'HODAL',
  'MOHANA',
  'NANGLA GUJRAN',
  'NIT - 2',
  'PALWAL',
  'PRITHLA',
  'RAJENDRA PARK',
  'SECTOR-15-A',
  'SURAJ KUND',
  'TAORU',
  'TIGAON',
  'ZAIBABAD KHERLI',
]

interface JathaType {
  id:          number
  destination: string
  department:  string
}

interface QuotaRow {
  centre:      string
  quota_count: number
  db_id?:      number
}

interface Schedule {
  id:             number
  jatha_type_id:  number
  destination:    string
  department:     string
  jatha_name:     string
  from_date:      string
  to_date:        string
  total_required: number
  is_published:   boolean
  is_active:      boolean
  description:    string | null
}

// ── Auto name generator ─────────────────────────────────────────
function buildJathaName(
  destination: string,
  department: string,
  fromDate: string,
  toDate: string
): string {
  if (!destination || !department || !fromDate || !toDate) return ''
  const from      = new Date(fromDate)
  const to        = new Date(toDate)
  const fromDay   = from.getDate().toString().padStart(2, '0')
  const toDay     = to.getDate().toString().padStart(2, '0')
  const fromMonth = from.toLocaleDateString('en-IN', { month: 'long' })
  const toMonth   = to.toLocaleDateString('en-IN', { month: 'long' })
  const toYear    = to.getFullYear()
  const dateStr   = fromMonth === toMonth
    ? `${fromDay} to ${toDay} ${fromMonth} ${toYear}`
    : `${fromDay} ${fromMonth} to ${toDay} ${toMonth} ${toYear}`
  return `${destination.toUpperCase()} ${department.toUpperCase()} JATHA - ${dateStr}`
}

export default function JathaScheduleFormPage() {
  const { id }   = useParams<{ id: string }>()
  const isEdit   = !!id && id !== 'new'
  const { user } = useAuth()
  const navigate = useNavigate()

  // Jatha types from DB
  const [allTypes,       setAllTypes]       = useState<JathaType[]>([])
  const [destinations,   setDestinations]   = useState<string[]>([])
  const [departments,    setDepartments]    = useState<string[]>([])

  // Form state
  const [selectedDest,   setSelectedDest]   = useState('')
  const [selectedDept,   setSelectedDept]   = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')
  const [totalRequired,  setTotalRequired]  = useState(0)
  const [description,    setDescription]    = useState('')
  const [quotas,         setQuotas]         = useState<QuotaRow[]>(
    MAIN_CENTRES.map(c => ({ centre: c, quota_count: 0 }))
  )
  const [existing,       setExisting]       = useState<Schedule | null>(null)
  const [loading,        setLoading]        = useState(isEdit)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  // For centre admin: their quota from this schedule
  const [myQuota,        setMyQuota]        = useState(0)

  const isASO = user?.role === 'aso'

  // Derived
  const autoName      = buildJathaName(selectedDest, selectedDept, fromDate, toDate)
  const totalAssigned = quotas.reduce((s, q) => s + q.quota_count, 0)
  const remaining     = totalRequired - totalAssigned
  const activeQuotas  = quotas.filter(q => q.quota_count > 0)

  // ── Load jatha types ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('jatha_types')
      .select('id, destination, department')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return
        const types = data as JathaType[]
        setAllTypes(types)
        const dests = Array.from(new Set(types.map(t => t.destination)))
        setDestinations(dests)
      })
  }, [])

  // ── When destination changes → filter departments ─────────────
  useEffect(() => {
    if (!selectedDest) {
      setDepartments([])
      setSelectedDept('')
      setSelectedTypeId(null)
      return
    }
    const depts = allTypes
      .filter(t => t.destination === selectedDest)
      .map(t => t.department)
    setDepartments(depts)
    setSelectedDept('')
    setSelectedTypeId(null)
  }, [selectedDest, allTypes])

  // ── When department changes → set type ID ────────────────────
  useEffect(() => {
    if (!selectedDest || !selectedDept) { setSelectedTypeId(null); return }
    const match = allTypes.find(
      t => t.destination === selectedDest && t.department === selectedDept
    )
    setSelectedTypeId(match?.id ?? null)
  }, [selectedDest, selectedDept, allTypes])

  // ── Load existing schedule for edit ──────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return
    const load = async () => {
      setLoading(true)
      try {
        const [schedRes, quotaRes] = await Promise.all([
          supabase.from('sewa_schedule').select('*').eq('id', id).single(),
          supabase.from('sewa_quota').select('id, centre, quota_count').eq('sewa_schedule_id', id),
        ])
        const s = schedRes.data as Schedule
        setExisting(s)
        setFromDate(s.from_date)
        setToDate(s.to_date)
        setTotalRequired(s.total_required)
        setDescription(s.description ?? '')
        setSelectedDest(s.destination)
        // Department set after allTypes loads
        setTimeout(() => setSelectedDept(s.department), 150)

        // Map existing quotas
        const dbMap = new Map(
          (quotaRes.data ?? []).map((q: any) => [
            q.centre,
            { count: q.quota_count, db_id: q.id },
          ])
        )
        setQuotas(
          MAIN_CENTRES.map(c => {
            const db = dbMap.get(c)
            return { centre: c, quota_count: db?.count ?? 0, db_id: db?.db_id }
          })
        )

        // If centre admin, find their quota
        if (user?.role !== 'aso' && user?.centre) {
          const myQ = dbMap.get(user.centre)
          setMyQuota(myQ?.count ?? 0)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isEdit, id, user])

  const updateQuota = (centre: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0)
    setQuotas(prev => prev.map(q => q.centre === centre ? { ...q, quota_count: n } : q))
  }

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async (publish: boolean) => {
    if (!user) return
    if (!selectedTypeId)           { setError('Select destination and department'); return }
    if (!fromDate || !toDate)      { setError('Set the dates'); return }
    if (toDate < fromDate)         { setError('End date must be after start date'); return }
    if (totalRequired <= 0)        { setError('Enter total required count'); return }
    if (activeQuotas.length === 0) { setError('At least one centre must have a count > 0'); return }
    if (totalAssigned > totalRequired) {
      setError(`Total assigned (${totalAssigned}) exceeds total required (${totalRequired})`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const name = autoName

      if (isEdit && id) {
        await supabase.from('sewa_schedule').update({
          jatha_type_id:  selectedTypeId,
          destination:    selectedDest,
          department:     selectedDept,
          jatha_name:     name,
          from_date:      fromDate,
          to_date:        toDate,
          total_required: totalRequired,
          is_published:   publish,
          description:    description || null,
        }).eq('id', id)

        // Upsert / delete quotas
        for (const q of quotas) {
          if (q.quota_count > 0) {
            if (q.db_id) {
              await supabase.from('sewa_quota')
                .update({ quota_count: q.quota_count, set_by: user.badge_number })
                .eq('id', q.db_id)
            } else {
              await supabase.from('sewa_quota').insert({
                sewa_schedule_id: parseInt(id),
                centre:           q.centre,
                quota_count:      q.quota_count,
                set_by:           user.badge_number,
              })
            }
          } else if (q.db_id) {
            await supabase.from('sewa_quota').delete().eq('id', q.db_id)
          }
        }

        setExisting(e => e ? { ...e, is_published: publish } : e)
        navigate('/jatha-schedule')
      } else {
        const { data: newSched, error: schedErr } = await supabase
          .from('sewa_schedule')
          .insert({
            jatha_type_id:  selectedTypeId,
            destination:    selectedDest,
            department:     selectedDept,
            jatha_name:     name,
            from_date:      fromDate,
            to_date:        toDate,
            total_required: totalRequired,
            is_published:   publish,
            description:    description || null,
            created_by:     user.badge_number,
          })
          .select('id')
          .single()

        if (schedErr) throw schedErr

        await supabase.from('sewa_quota').insert(
          activeQuotas.map(q => ({
            sewa_schedule_id: newSched.id,
            centre:           q.centre,
            quota_count:      q.quota_count,
            set_by:           user.badge_number,
          }))
        )

        navigate('/jatha-schedule')
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    if (!existing || !id) return
    const newVal = !existing.is_published
    await supabase.from('sewa_schedule').update({ is_published: newVal }).eq('id', id)
    setExisting(e => e ? { ...e, is_published: newVal } : e)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-1/3" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/jatha-schedule"
            className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              {isEdit ? 'Edit Schedule' : 'New Jatha Schedule'}
            </h1>
            <p className="text-xs text-slate-400">
              {isEdit ? 'शेड्यूल संपादित करें' : 'नया जत्था शेड्यूल'}
            </p>
          </div>
        </div>
        {isEdit && existing && isASO && (
          <button
            onClick={togglePublish}
            className={[
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation',
              existing.is_published
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-green-50 text-green-700 border border-green-200',
            ].join(' ')}
          >
            {existing.is_published
              ? <><EyeOff size={12} /> Unpublish</>
              : <><Eye size={12} /> Publish</>
            }
          </button>
        )}
      </div>

      {/* Auto name preview */}
      {autoName && (
        <div className="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-3">
          <p className="text-[10px] text-maroon-500 font-semibold uppercase tracking-wide mb-0.5">
            Jatha Name (Auto-generated)
          </p>
          <p className="text-sm font-bold text-maroon-800">{autoName}</p>
        </div>
      )}

      {/* ── ASO ONLY: Schedule details form ── */}
      {isASO && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Schedule Details
          </p>

          {/* Destination dropdown */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
              Destination (गंतव्य) *
            </label>
            <select
              value={selectedDest}
              onChange={e => setSelectedDest(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 bg-white"
            >
              <option value="">— Select destination —</option>
              {destinations.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Department dropdown */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
              Department (विभाग) *
            </label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              disabled={!selectedDest}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {selectedDest ? '— Select department —' : '— Select destination first —'}
              </option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                From Date *
              </label>
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                To Date *
              </label>
              <input
                type="date" value={toDate} min={fromDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>
          </div>

          {/* Total required */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
              Total Sewadars Required (Overall) *
            </label>
            <input
              type="number" inputMode="numeric" min={0}
              value={totalRequired || ''}
              onChange={e => setTotalRequired(parseInt(e.target.value) || 0)}
              placeholder="e.g. 500"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
              Notes (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes for Centre Admins..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 resize-none"
            />
          </div>
        </div>
      )}

      {/* ── ASO ONLY: Centre quota table ── */}
      {isASO && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Centre-wise Count
                <span className="text-slate-400 font-normal ml-1">(केंद्र-वार गिनती)</span>
              </h3>
              <div className="text-right">
                <p className="text-xs font-bold text-maroon-600">{totalAssigned} assigned</p>
                {totalRequired > 0 && (
                  <p className={`text-[10px] font-medium ${
                    remaining < 0  ? 'text-red-500' :
                    remaining === 0 ? 'text-green-600' : 'text-slate-400'
                  }`}>
                    {remaining > 0
                      ? `${remaining} remaining`
                      : remaining === 0
                        ? '✓ Complete'
                        : `${Math.abs(remaining)} over limit`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {totalRequired > 0 && (
            <div className="px-4 py-2 border-b border-slate-50">
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalAssigned > totalRequired ? 'bg-red-500' :
                    totalAssigned === totalRequired ? 'bg-green-500' : 'bg-maroon-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 0,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Centre (केंद्र)</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-28">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quotas.map((q, idx) => (
                  <tr key={q.centre} className={q.quota_count > 0 ? 'bg-maroon-50/30' : ''}>
                    <td className="px-4 py-2.5 text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{q.centre}</span>
                        {q.quota_count > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-maroon-500 flex-shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number" inputMode="numeric" min={0} max={999}
                        value={q.quota_count || ''}
                        onChange={e => updateQuota(q.centre, e.target.value)}
                        placeholder="0"
                        className={[
                          'w-20 px-2 py-1.5 text-center text-sm font-semibold border rounded-lg',
                          'focus:outline-none focus:border-maroon-400 transition-colors',
                          q.quota_count > 0
                            ? 'border-maroon-300 bg-maroon-50 text-maroon-700'
                            : 'border-slate-200 text-slate-400',
                        ].join(' ')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                    Total · {activeQuotas.length} centres
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-bold ${
                      totalRequired > 0 && totalAssigned > totalRequired ? 'text-red-600' :
                      totalRequired > 0 && totalAssigned === totalRequired ? 'text-green-600' :
                      'text-maroon-600'
                    }`}>
                      {totalAssigned}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CENTRE ADMIN: Read-only schedule info ── */}
      {!isASO && existing && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Schedule Info</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Destination</p>
              <p className="font-medium text-slate-800">{existing.destination} · {existing.department}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dates</p>
              <p className="font-medium text-slate-800">
                {new Date(existing.from_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                {' – '}
                {new Date(existing.to_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Your Quota</p>
              <p className="text-lg font-bold text-maroon-600">{myQuota}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Required</p>
              <p className="font-medium text-slate-700">{existing.total_required}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTRE ADMIN: Sub-centre quota distribution ── */}
      {!isASO && isEdit && id && user?.centre && myQuota > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Sub-Centre Quota Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribute your quota ({myQuota}) to sub-centres under {user.centre}
            </p>
          </div>
          <SubCentreQuotaPanel
            scheduleId={parseInt(id)}
            parentCentre={user.centre}
            parentQuota={myQuota}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── ASO ONLY: Save buttons ── */}
      {isASO && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 transition-transform touch-manipulation disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="py-3.5 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : <><Save size={15} /> Save & Publish</>
              }
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 pb-4">
            Only published schedules are visible to Centre Admins
          </p>
        </>
      )}
    </div>
  )
}