import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Plus, Trash2, Save, Eye, EyeOff,
  CheckCircle, Clock, XCircle, Edit2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id:           number
  jatha_name:   string
  destination:  string
  department:   string
  is_bhati:     boolean
  from_date:    string
  to_date:      string
  description:  string | null
  is_active:    boolean
  is_published: boolean
  created_at:   string
}

interface CentreQuota {
  id?:          number
  centre:       string
  quota_count:  number
  nr_status?:   string | null
  member_count?: number
}

export default function JathaScheduleDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()

  const [schedule,     setSchedule]     = useState<Schedule | null>(null)
  const [quotas,       setQuotas]       = useState<CentreQuota[]>([])
  const [allCentres,   setAllCentres]   = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [addSearch,    setAddSearch]    = useState('')
  const [editingQuota, setEditingQuota] = useState<string | null>(null)
  const [editVal,      setEditVal]      = useState('')
  const [editing,      setEditing]      = useState(false)
  const [editForm,     setEditForm]     = useState<Partial<Schedule>>({})

  useEffect(() => {
    if (id) fetchAll()
    supabase.from('centres').select('centre_name').eq('is_active', true).order('centre_name')
      .then(({ data }) => { if (data) setAllCentres(data.map(c => c.centre_name)) })
  }, [id])

  const fetchAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [schedRes, quotaRes] = await Promise.all([
        supabase.from('jatha_schedule').select('*').eq('id', id).single(),
        supabase.from('jatha_quota')
          .select(`
            id, centre, quota_count,
            nominal_roles!nominal_roles_jatha_schedule_id_fkey (
              status,
              nr_members (id)
            )
          `)
          .eq('jatha_schedule_id', id)
          .order('centre'),
      ])

      setSchedule(schedRes.data as Schedule)
      setEditForm(schedRes.data as Schedule)

      const enriched = (quotaRes.data ?? []).map((q: any) => {
        const nr = q.nominal_roles?.[0]
        return {
          id:           q.id,
          centre:       q.centre,
          quota_count:  q.quota_count,
          nr_status:    nr?.status ?? null,
          member_count: nr?.nr_members?.length ?? 0,
        }
      })
      setQuotas(enriched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async () => {
    if (!schedule) return
    const newVal = !schedule.is_published
    await supabase.from('jatha_schedule').update({ is_published: newVal }).eq('id', schedule.id)
    setSchedule(s => s ? { ...s, is_published: newVal } : s)
  }

  const saveQuota = async (centre: string) => {
    if (!id || !user) return
    const val = parseInt(editVal) || 0
    const existing = quotas.find(q => q.centre === centre)

    if (existing?.id) {
      await supabase.from('jatha_quota').update({ quota_count: val, set_by: user.badge_number }).eq('id', existing.id)
    } else {
      await supabase.from('jatha_quota').insert({
        jatha_schedule_id: parseInt(id),
        centre, quota_count: val, set_by: user.badge_number,
      })
    }
    setQuotas(prev => prev.map(q => q.centre === centre ? { ...q, quota_count: val } : q))
    setEditingQuota(null)
  }

  const addCentre = async (centre: string) => {
    if (!id || !user) return
    const { data } = await supabase.from('jatha_quota').insert({
      jatha_schedule_id: parseInt(id),
      centre, quota_count: 0, set_by: user.badge_number,
    }).select('id').single()

    setQuotas(prev => [...prev, { id: data?.id, centre, quota_count: 0, nr_status: null, member_count: 0 }])
    setAddSearch('')
  }

  const removeQuota = async (quotaId: number, centre: string) => {
    await supabase.from('jatha_quota').delete().eq('id', quotaId)
    setQuotas(prev => prev.filter(q => q.centre !== centre))
  }

  const saveScheduleEdit = async () => {
    if (!id) return
    setSaving(true)
    await supabase.from('jatha_schedule').update({
      jatha_name:  editForm.jatha_name,
      destination: editForm.destination,
      department:  editForm.department,
      from_date:   editForm.from_date,
      to_date:     editForm.to_date,
      description: editForm.description,
    }).eq('id', id)
    setSchedule(s => s ? { ...s, ...editForm } : s)
    setEditing(false)
    setSaving(false)
  }

  const availableCentres = allCentres.filter(c =>
    c.toLowerCase().includes(addSearch.toLowerCase()) &&
    !quotas.find(q => q.centre === c)
  )

  const totalQuota    = quotas.reduce((s, q) => s + q.quota_count, 0)
  const totalAssigned = quotas.reduce((s, q) => s + (q.member_count ?? 0), 0)
  const pct = totalQuota > 0 ? Math.round((totalAssigned / totalQuota) * 100) : 0

  if (loading || !schedule) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  const statusInfo = !schedule.is_active
    ? { label: 'Cancelled', variant: 'red'   as const, icon: <XCircle size={12} /> }
    : schedule.is_published
      ? { label: 'Published', variant: 'green' as const, icon: <CheckCircle size={12} /> }
      : { label: 'Draft',     variant: 'gold'  as const, icon: <Clock size={12} /> }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/jatha-schedule" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800 truncate max-w-48">
              {schedule.jatha_name}
            </h1>
            <p className="text-xs text-slate-400">{schedule.destination} · {schedule.department}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(v => !v)}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 active:bg-slate-200 touch-manipulation"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={togglePublish}
            className={[
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation',
              schedule.is_published
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-green-50 text-green-700 border border-green-200',
            ].join(' ')}
          >
            {schedule.is_published ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
          </button>
        </div>
      </div>

      {/* Schedule info card */}
      {!editing ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant={statusInfo.variant} className="text-[10px] flex items-center gap-1">
              {statusInfo.icon} {statusInfo.label}
            </Badge>
            <Badge variant={schedule.is_bhati ? 'navy' : 'maroon'} className="text-[10px]">
              {schedule.is_bhati ? 'Bhati' : 'Beas / Outstation'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dates</p>
              <p className="font-medium text-slate-700">
                {new Date(schedule.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(schedule.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Department</p>
              <p className="font-medium text-slate-700">{schedule.department}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Centres</p>
              <p className="font-medium text-slate-700">{quotas.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Quota</p>
              <p className="font-medium text-maroon-600">{totalQuota}</p>
            </div>
          </div>

          {/* Progress */}
          {totalQuota > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>NR Filling Progress</span>
                <span>{totalAssigned} / {totalQuota} ({pct}%)</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-maroon-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          )}

          {schedule.description && (
            <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">{schedule.description}</p>
          )}
        </div>
      ) : (
        /* Edit form */
        <div className="bg-white rounded-xl border border-maroon-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-maroon-600 uppercase tracking-wide">Edit Schedule</p>
          {[
            { key: 'jatha_name',  label: 'Jatha Name',   type: 'text' },
            { key: 'destination', label: 'Destination',  type: 'text' },
            { key: 'department',  label: 'Department',   type: 'text' },
            { key: 'from_date',   label: 'From Date',    type: 'date' },
            { key: 'to_date',     label: 'To Date',      type: 'date' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">{f.label}</label>
              <input type={f.type} value={(editForm as any)[f.key] ?? ''}
                onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setEditing(false)} className="py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 touch-manipulation">Cancel</button>
            <button onClick={saveScheduleEdit} disabled={saving}
              className="py-2.5 bg-maroon-600 text-white rounded-lg text-sm font-semibold touch-manipulation disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Centre quotas management */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Centre Quotas
            <span className="text-slate-400 font-normal ml-1">({quotas.length} centres)</span>
          </h3>
        </div>

        {/* Add centre */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <input
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              placeholder="Add a centre..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
            />
            {addSearch && availableCentres.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                {availableCentres.slice(0, 8).map(c => (
                  <button key={c} onClick={() => addCentre(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-maroon-50 flex items-center justify-between touch-manipulation">
                    {c} <Plus size={12} className="text-maroon-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quota list */}
        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {quotas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No centres assigned yet</div>
          ) : quotas.map(q => (
            <div key={q.centre} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{q.centre}</p>
                {q.nr_status && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={q.nr_status === 'issued' ? 'maroon' : q.nr_status === 'approved' ? 'green' : q.nr_status === 'submitted' ? 'navy' : 'gray'} className="text-[9px]">
                      NR: {q.nr_status}
                    </Badge>
                    <span className="text-[10px] text-slate-400">{q.member_count} members</span>
                  </div>
                )}
              </div>

              {editingQuota === q.centre ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number" inputMode="numeric" min={0} max={999}
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    className="w-16 px-2 py-1.5 border border-maroon-300 rounded-lg text-sm text-center font-semibold focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveQuota(q.centre)}
                    className="p-1.5 bg-green-100 text-green-700 rounded-lg touch-manipulation">
                    <Save size={13} />
                  </button>
                  <button onClick={() => setEditingQuota(null)}
                    className="p-1.5 bg-slate-100 text-slate-500 rounded-lg touch-manipulation">
                    <XCircle size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingQuota(q.centre); setEditVal(String(q.quota_count)) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-50 text-maroon-700 rounded-lg text-sm font-bold touch-manipulation"
                  >
                    {q.quota_count}
                    <Edit2 size={10} className="text-maroon-400" />
                  </button>
                  {!q.nr_status && q.id && (
                    <button onClick={() => removeQuota(q.id!, q.centre)}
                      className="p-1.5 text-slate-300 hover:text-red-500 touch-manipulation">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Totals footer */}
        {quotas.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{quotas.length} centres</span>
            <span className="text-xs font-bold text-maroon-600">Total: {totalQuota} sewadars</span>
          </div>
        )}
      </div>
    </div>
  )
}
