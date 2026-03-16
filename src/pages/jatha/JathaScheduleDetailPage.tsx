import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Save, Eye, EyeOff, CheckCircle, Clock, XCircle, Edit2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id: number; jatha_name: string; destination: string; department: string
  from_date: string; to_date: string; description: string|null
  is_active: boolean; is_published: boolean; total_required: number; created_at: string
}
interface CentreQuota {
  id?: number; centre: string; quota_count: number
  nr_status?: string|null; member_count?: number
}

export default function JathaScheduleDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isASO    = user?.role === 'aso'

  const [schedule,     setSchedule]     = useState<Schedule|null>(null)
  const [quotas,       setQuotas]       = useState<CentreQuota[]>([])
  const [allCentres,   setAllCentres]   = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [addSearch,    setAddSearch]    = useState('')
  const [editingQuota, setEditingQuota] = useState<string|null>(null)
  const [editVal,      setEditVal]      = useState('')
  const [editing,      setEditing]      = useState(false)
  const [editForm,     setEditForm]     = useState<Partial<Schedule>>({})
  const [myQuota,      setMyQuota]      = useState(0)

  useEffect(() => {
    if (id) fetchAll()
    supabase.from('centres').select('centre_name').eq('is_active',true).order('centre_name')
      .then(({ data }) => { if (data) setAllCentres(data.map(c => c.centre_name)) })
  }, [id])

  const fetchAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [schedRes, quotaRes] = await Promise.all([
        supabase.from('sewa_schedule').select('*').eq('id',id).single(),
        supabase.from('sewa_quota')
          .select(`id, centre, quota_count, nominal_roles!nominal_roles_sewa_schedule_id_fkey(status, nr_members(id))`)
          .eq('sewa_schedule_id', id)
          .order('centre'),
      ])
      setSchedule(schedRes.data as Schedule)
      setEditForm(schedRes.data as Schedule)

      const enriched = (quotaRes.data ?? []).map((q: any) => {
        const nr = Array.isArray(q.nominal_roles) ? q.nominal_roles[0] : null
        return { id: q.id, centre: q.centre, quota_count: q.quota_count, nr_status: nr?.status ?? null, member_count: nr?.nr_members?.length ?? 0 }
      })
      setQuotas(enriched)

      // Centre admin: find their own quota
      if (!isASO && user?.centre) {
        const mine = enriched.find(q => q.centre === user.centre)
        setMyQuota(mine?.quota_count ?? 0)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const togglePublish = async () => {
    if (!schedule) return
    const v = !schedule.is_published
    await supabase.from('sewa_schedule').update({ is_published: v }).eq('id', schedule.id)
    setSchedule(s => s ? { ...s, is_published: v } : s)
  }

  const saveQuota = async (centre: string) => {
    if (!id || !user) return
    const val = Math.max(0, parseInt(editVal) || 0)
    const existing = quotas.find(q => q.centre === centre)
    if (existing?.id) {
      await supabase.from('sewa_quota').update({ quota_count: val, set_by: user.badge_number }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('sewa_quota').insert({ sewa_schedule_id: parseInt(id), centre, quota_count: val, set_by: user.badge_number }).select('id').single()
      if (data) setQuotas(prev => prev.map(q => q.centre === centre ? { ...q, id: data.id } : q))
    }
    setQuotas(prev => prev.map(q => q.centre === centre ? { ...q, quota_count: val } : q))
    setEditingQuota(null)
  }

  const addCentre = async (centre: string) => {
    if (!id || !user) return
    const { data } = await supabase.from('sewa_quota').insert({ sewa_schedule_id: parseInt(id), centre, quota_count: 0, set_by: user.badge_number }).select('id').single()
    setQuotas(prev => [...prev, { id: data?.id, centre, quota_count: 0, nr_status: null, member_count: 0 }])
    setAddSearch('')
  }

  const removeQuota = async (qId: number, centre: string) => {
    await supabase.from('sewa_quota').delete().eq('id', qId)
    setQuotas(prev => prev.filter(q => q.centre !== centre))
  }

  const saveEdit = async () => {
    if (!id) return
    setSaving(true)
    await supabase.from('sewa_schedule').update({ jatha_name: editForm.jatha_name, destination: editForm.destination, department: editForm.department, from_date: editForm.from_date, to_date: editForm.to_date, description: editForm.description }).eq('id', id)
    setSchedule(s => s ? { ...s, ...editForm } : s)
    setEditing(false); setSaving(false)
  }

  const totalQuota    = quotas.reduce((s,q) => s + q.quota_count, 0)
  const totalAssigned = quotas.reduce((s,q) => s + (q.member_count ?? 0), 0)
  const pct = totalQuota > 0 ? Math.round((totalAssigned / totalQuota) * 100) : 0
  const availableCentres = allCentres.filter(c => c.toLowerCase().includes(addSearch.toLowerCase()) && !quotas.find(q => q.centre === c))

  const myCentreQuota = !isASO ? quotas.find(q => q.centre === user?.centre) : null

  if (loading || !schedule) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
    </div>
  )

  const statusInfo = !schedule.is_active
    ? { label: 'Cancelled', variant: 'red' as const, icon: <XCircle size={12}/> }
    : schedule.is_published
      ? { label: 'Published', variant: 'green' as const, icon: <CheckCircle size={12}/> }
      : { label: 'Draft',     variant: 'gold' as const, icon: <Clock size={12}/> }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/jatha-schedule" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation"><ChevronLeft size={18}/></Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800 truncate max-w-48">{schedule.jatha_name}</h1>
            <p className="text-xs text-slate-400">{schedule.destination} · {schedule.department}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isASO && <button onClick={() => setEditing(v => !v)} className="p-2 rounded-xl bg-slate-100 text-slate-500 active:bg-slate-200 touch-manipulation"><Edit2 size={15}/></button>}
          {isASO && (
            <button onClick={togglePublish} className={['flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold touch-manipulation', schedule.is_published ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'].join(' ')}>
              {schedule.is_published ? <><EyeOff size={12}/> Unpublish</> : <><Eye size={12}/> Publish</>}
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      {!editing ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant={statusInfo.variant} className="text-[10px] flex items-center gap-1">{statusInfo.icon} {statusInfo.label}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dates</p>
              <p className="font-medium text-slate-700">
                {new Date(schedule.from_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – {new Date(schedule.to_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Department</p>
              <p className="font-medium text-slate-700">{schedule.department}</p>
            </div>
            {isASO ? (
              <>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Centres</p>
                  <p className="font-medium text-slate-700">{quotas.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Quota</p>
                  <p className="font-medium text-maroon-600">{totalQuota}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Your Quota</p>
                  <p className="text-lg font-bold text-maroon-600">{myQuota}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Your NR Members</p>
                  <p className="font-medium text-navy-600">{myCentreQuota?.member_count ?? 0}</p>
                </div>
              </>
            )}
          </div>
          {isASO && totalQuota > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>NR Filling Progress</span>
                <span>{totalAssigned} / {totalQuota} ({pct}%)</span>
              </div>
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-maroon-500 rounded-full" style={{ width: `${Math.min(pct,100)}%` }} />
              </div>
            </div>
          )}
          {schedule.description && <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">{schedule.description}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-maroon-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-maroon-600 uppercase tracking-wide">Edit Schedule</p>
          {[['jatha_name','Jatha Name','text'],['destination','Destination','text'],['department','Department','text'],['from_date','From Date','date'],['to_date','To Date','date']].map(([k,l,t]) => (
            <div key={k}>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">{l}</label>
              <input type={t} value={(editForm as any)[k]??''} onChange={e => setEditForm(p => ({...p,[k]:e.target.value}))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => setEditing(false)} className="py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 touch-manipulation">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="py-2.5 bg-maroon-600 text-white rounded-lg text-sm font-semibold touch-manipulation disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Centre Admin: go to NR */}
      {!isASO && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-3">
            {myCentreQuota?.nr_status
              ? `NR Status: ${myCentreQuota.nr_status.replace(/_/g,' ').toUpperCase()}`
              : 'No NR created yet for this schedule'
            }
          </p>
          <button onClick={() => navigate(`/nominal-roles/new?schedule=${id}`)} className="w-full py-3 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation">
            {myCentreQuota?.nr_status ? 'Open / Edit NR →' : 'Create Nominal Role →'}
          </button>
        </div>
      )}

      {/* ASO: centre quotas management */}
      {isASO && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Centre Quotas <span className="text-slate-400 font-normal">({quotas.length})</span></h3>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 relative">
            <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Add a centre..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
            {addSearch && availableCentres.length > 0 && (
              <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                {availableCentres.slice(0,8).map(c => (
                  <button key={c} onClick={() => addCentre(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-maroon-50 flex items-center justify-between touch-manipulation">
                    {c} <Plus size={12} className="text-maroon-500"/>
                  </button>
                ))}
              </div>
            )}
          </div>
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
                        NR: {q.nr_status.replace(/_/g,' ')}
                      </Badge>
                      <span className="text-[10px] text-slate-400">{q.member_count} members</span>
                    </div>
                  )}
                </div>
                {editingQuota === q.centre ? (
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="numeric" min={0} value={editVal} onChange={e => setEditVal(e.target.value)} className="w-16 px-2 py-1.5 border border-maroon-300 rounded-lg text-sm text-center font-semibold focus:outline-none" autoFocus />
                    <button onClick={() => saveQuota(q.centre)} className="p-1.5 bg-green-100 text-green-700 rounded-lg touch-manipulation"><Save size={13}/></button>
                    <button onClick={() => setEditingQuota(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg touch-manipulation"><XCircle size={13}/></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingQuota(q.centre); setEditVal(String(q.quota_count)) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-50 text-maroon-700 rounded-lg text-sm font-bold touch-manipulation">
                      {q.quota_count} <Edit2 size={10} className="text-maroon-400"/>
                    </button>
                    {!q.nr_status && q.id && (
                      <button onClick={() => removeQuota(q.id!, q.centre)} className="p-1.5 text-slate-300 hover:text-red-500 touch-manipulation"><Trash2 size={13}/></button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {quotas.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{quotas.length} centres</span>
              <span className="text-xs font-bold text-maroon-600">Total: {totalQuota} sewadars</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}