import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Save, Send, Search, Plus, Trash2,
  Star, AlertTriangle, CheckCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id:          number
  jatha_name:  string
  destination: string
  department:  string
  from_date:   string
  to_date:     string
}

interface NRMember {
  id?:          number
  display_id:   string
  member_type:  'sewadar' | 'sangat'
  name:         string
  father_name:  string | null
  gender:       string
  age:          number | null
  address:      string | null
  mobile:       string | null
  department:   string | null
  is_jathedar:  boolean
  sewadar_id?:  number
  sangat_id?:   number
  badge_number?: string
}

interface SewadarResult {
  id:           number
  badge_number: string
  name:         string
  father_name:  string | null
  gender:       string
  age:          number | null
  address:      string | null
  mobile:       string | null
  department:   string | null
}

interface SangatResult {
  id:            number
  sangat_id:     string
  name:          string
  father_name:   string | null
  gender:        string
  age:           number | null
  address:       string | null
  mobile:        string | null
  aadhaar_last4: string
}

const VEHICLE_TYPES = ['Bus', 'Tempo', 'Car', 'Train', 'Van', 'Other']

export default function NRFormPage() {
  const { id }          = useParams<{ id: string }>()
  const [searchParams]  = useSearchParams()
  const scheduleIdParam = searchParams.get('schedule')
  const isEdit          = !!id && id !== 'new'
  const { user }        = useAuth()
  const navigate        = useNavigate()

  const [schedule,     setSchedule]     = useState<Schedule | null>(null)
  const [nrId,         setNRId]         = useState<number | null>(null)
  const [nrStatus,     setNRStatus]     = useState('draft')

  // Header fields
  const [srsId,        setSrsId]        = useState('')
  const [jathedarPhone, setJathedarPhone] = useState('')
  const [vehicleType,  setVehicleType]  = useState('')
  const [driverName,   setDriverName]   = useState('')
  const [driverMobile, setDriverMobile] = useState('')

  // Members
  const [members,      setMembers]      = useState<NRMember[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // Search
  const [searchTab,    setSearchTab]    = useState<'sewadar' | 'sangat'>('sewadar')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchRes,    setSearchRes]    = useState<(SewadarResult | SangatResult)[]>([])
  const [searching,    setSearching]    = useState(false)

  const isLocked = nrStatus !== 'draft' && user?.role !== 'aso'

  // Derived: current jathedar from members
  const jathedar = members.find(m => m.is_jathedar)

  useEffect(() => { if (user) init() }, [user, id, scheduleIdParam])

  const init = async () => {
    setLoading(true)
    try {
      if (isEdit && id) {
        // Load existing NR
        const { data: nr } = await supabase
          .from('nominal_roles')
          .select('*')
          .eq('id', id)
          .single()

        if (nr) {
          setNRId(nr.id)
          setNRStatus(nr.status ?? 'draft')
          setSrsId(nr.srs_id ?? '')
          setJathedarPhone(nr.jathedar_phone ?? '')
          setVehicleType(nr.vehicle_type ?? '')
          setDriverName(nr.driver_name ?? '')
          setDriverMobile(nr.driver_mobile ?? '')

          // Load schedule
          if (nr.sewa_schedule_id) {
            const { data: sched } = await supabase
              .from('sewa_schedule')
              .select('id, jatha_name, destination, department, from_date, to_date')
              .eq('id', nr.sewa_schedule_id)
              .single()
            if (sched) setSchedule(sched as Schedule)
          }
        }

        // Load members
        const { data: mData } = await supabase
          .from('nr_members')
          .select('*')
          .eq('nominal_role_id', id)
        setMembers((mData ?? []) as NRMember[])

      } else if (scheduleIdParam) {
        const { data: sched } = await supabase
          .from('sewa_schedule')
          .select('id, jatha_name, destination, department, from_date, to_date')
          .eq('id', scheduleIdParam)
          .single()
        if (sched) setSchedule(sched as Schedule)
      }
    } finally {
      setLoading(false)
    }
  }

  // Member search
  const doSearch = useCallback(async () => {
    if (!user || searchQuery.length < 2) { setSearchRes([]); return }
    setSearching(true)
    try {
      if (searchTab === 'sewadar') {
        const { data } = await supabase
          .from('sewadars')
          .select('id, badge_number, name, father_name, gender, age, address, mobile, department')
          .eq('centre', user.centre)
          .eq('is_active', true)
          .or(`name.ilike.%${searchQuery}%,badge_number.ilike.%${searchQuery}%`)
          .limit(8)
        setSearchRes((data ?? []) as SewadarResult[])
      } else {
        const { data } = await supabase
          .from('sangat')
          .select('id, sangat_id, name, father_name, gender, age, address, mobile, aadhaar_last4')
          .eq('centre', user.centre)
          .or(`name.ilike.%${searchQuery}%,sangat_id.ilike.%${searchQuery}%`)
          .limit(8)
        setSearchRes((data ?? []) as SangatResult[])
      }
    } finally { setSearching(false) }
  }, [user, searchQuery, searchTab])

  useEffect(() => {
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchTab, doSearch])

  const addMember = (result: SewadarResult | SangatResult) => {
    const isSew     = 'badge_number' in result
    const displayId = isSew ? (result as SewadarResult).badge_number : (result as SangatResult).sangat_id
    if (members.find(m => m.display_id === displayId)) return

    const newMember: NRMember = {
      display_id:   displayId,
      member_type:  isSew ? 'sewadar' : 'sangat',
      name:         result.name,
      father_name:  result.father_name,
      gender:       result.gender,
      age:          result.age,
      address:      result.address,
      mobile:       result.mobile,
      department:   isSew ? (result as SewadarResult).department : null,
      is_jathedar:  false,
      ...(isSew
        ? { sewadar_id: result.id, badge_number: (result as SewadarResult).badge_number }
        : { sangat_id: result.id }
      ),
    }
    setMembers(prev => [...prev, newMember])
    setSearchQuery('')
    setSearchRes([])
  }

  const removeMember = (displayId: string) => {
    setMembers(prev => prev.filter(m => m.display_id !== displayId))
  }

  // Set jathedar from existing members
  const setAsJathedar = (displayId: string) => {
    setMembers(prev => prev.map(m => ({
      ...m,
      is_jathedar: m.display_id === displayId,
    })))
    // Auto-set phone from member's mobile if available
    const member = members.find(m => m.display_id === displayId)
    if (member?.mobile && !jathedarPhone) {
      setJathedarPhone(member.mobile)
    }
  }

  const clearJathedar = () => {
    setMembers(prev => prev.map(m => ({ ...m, is_jathedar: false })))
  }

  const sortedMembers = (): NRMember[] => {
    const jath   = members.filter(m => m.is_jathedar)
    const males  = members.filter(m => !m.is_jathedar && m.gender === 'M').sort((a,b) => a.name.localeCompare(b.name))
    const females = members.filter(m => !m.is_jathedar && m.gender === 'F').sort((a,b) => a.name.localeCompare(b.name))
    return [...jath, ...males, ...females]
  }

  const saveNR = async (andSubmit = false) => {
    if (!user || !schedule) return
    if (members.length === 0)  { setError('Add at least one member'); return }
    if (!jathedar)             { setError('Select a Jathedar from the member list (tap ★ next to a member)'); return }
    if (andSubmit && !srsId)   { setError('SRS ID is required before submitting'); return }

    setSaving(true)
    setError('')
    try {
      const sorted = sortedMembers()
      const payload: Record<string, unknown> = {
        centre:           user.centre,
        sewa_schedule_id: schedule.id,
        jatha_name:       schedule.jatha_name,
        schedule_dates:   `${schedule.from_date} to ${schedule.to_date}`,
        srs_id:           srsId || null,
        jathedar_badge:   jathedar?.badge_number ?? null,
        jathedar_name:    jathedar?.name ?? null,
        jathedar_phone:   jathedarPhone || jathedar?.mobile || null,
        vehicle_type:     vehicleType || null,
        driver_name:      driverName || null,
        driver_mobile:    driverMobile || null,
        status:           andSubmit ? 'submitted' : 'draft',
        ...(andSubmit ? { submitted_at: new Date().toISOString() } : {}),
      }

      let currentNRId = nrId

      if (currentNRId) {
        const { error: upErr } = await supabase
          .from('nominal_roles')
          .update(payload)
          .eq('id', currentNRId)
        if (upErr) throw upErr
      } else {
        const { data: newNR, error: insErr } = await supabase
          .from('nominal_roles')
          .insert({ ...payload, created_by: user.badge_number })
          .select('id')
          .single()
        if (insErr) throw insErr
        currentNRId = newNR.id
        setNRId(currentNRId)
      }

      // Re-insert members (delete + insert = clean ordering)
      await supabase.from('nr_members').delete().eq('nominal_role_id', currentNRId)
      const memberRows = sorted.map((m, idx) => ({
        nominal_role_id: currentNRId,
        serial_no:       idx + 1,
        display_id:      m.display_id,
        member_type:     m.member_type,
        sewadar_id:      m.sewadar_id ?? null,
        sangat_id:       m.sangat_id ?? null,
        name:            m.name,
        father_name:     m.father_name ?? null,
        gender:          m.gender,
        age:             m.age ?? null,
        address:         m.address ?? null,
        mobile:          m.mobile ?? null,
        department:      m.department ?? null,
        is_jathedar:     m.is_jathedar,
        centre:          user.centre,
      }))

      const { error: mErr } = await supabase.from('nr_members').insert(memberRows)
      if (mErr) throw mErr

      if (andSubmit) {
        setNRStatus('submitted')
        navigate(`/nominal-roles/${currentNRId}`)
      } else if (!nrId && currentNRId) {
        navigate(`/nominal-roles/${currentNRId}/edit`, { replace: true })
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-slate-400 text-sm">No jatha schedule linked.</p>
        <Link to="/jatha-schedule" className="text-maroon-600 text-sm mt-2 inline-block">
          ← View Jatha Schedules
        </Link>
      </div>
    )
  }

  const sorted      = sortedMembers()
  const maleCount   = members.filter(m => m.gender === 'M').length
  const femaleCount = members.filter(m => m.gender === 'F').length

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/nominal-roles"
          className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Edit Nominal Role' : 'New Nominal Role'}
          </h1>
          <p className="text-xs text-slate-400">{user?.centre} · {schedule.jatha_name}</p>
        </div>
        {nrStatus !== 'draft' && (
          <Badge variant={
            nrStatus === 'approved' || nrStatus === 'issued' ? 'green' :
            nrStatus === 'submitted' ? 'navy' :
            nrStatus === 'rejected' ? 'red' : 'gray'
          } className="text-[10px]">
            {nrStatus.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Schedule pill */}
      <div className="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-maroon-700">{schedule.jatha_name}</p>
        <p className="text-[10px] text-maroon-500 mt-0.5">
          {schedule.destination} · {schedule.department} ·{' '}
          {new Date(schedule.from_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          {' – '}
          {new Date(schedule.to_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
        </p>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            NR is {nrStatus} — locked. Contact ASO for changes.
          </p>
        </div>
      )}

      {/* ── NR Details ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NR Details</p>

        {/* SRS ID */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
            SRS ID <span className="text-slate-300">(required before submitting)</span>
          </label>
          <input
            value={srsId}
            onChange={e => setSrsId(e.target.value)}
            placeholder="e.g. 12345"
            disabled={isLocked}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-maroon-400 disabled:bg-slate-50"
          />
        </div>

        {/* Jathedar — selected from member list */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
            Jathedar (जथेदार) *
            <span className="text-slate-300 font-normal ml-1">— tap ★ on a member below to set</span>
          </label>

          {jathedar ? (
            <div className="flex items-center gap-3 p-3 bg-gold-50 border border-gold-300 rounded-xl">
              <Star size={16} className="text-gold-500 flex-shrink-0 fill-gold-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{jathedar.name}</p>
                <p className="text-[10px] font-mono text-slate-500">{jathedar.display_id}</p>
              </div>
              {!isLocked && (
                <button onClick={clearJathedar}
                  className="text-slate-400 hover:text-red-500 touch-manipulation text-xs">
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs text-amber-600">
                Add members first, then tap ★ next to a member to set them as Jathedar
              </p>
            </div>
          )}

          {/* Jathedar phone */}
          {jathedar && (
            <input
              value={jathedarPhone}
              onChange={e => setJathedarPhone(e.target.value)}
              placeholder="Jathedar phone number"
              type="tel" inputMode="numeric"
              disabled={isLocked}
              className="w-full mt-2 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50"
            />
          )}
        </div>

        {/* Vehicle */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
            Vehicle Details
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50">
              <option value="">Type</option>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input value={driverName}
              onChange={e => setDriverName(e.target.value)}
              placeholder="Driver name" disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
            <input value={driverMobile}
              onChange={e => setDriverMobile(e.target.value)}
              placeholder="Mobile" type="tel" inputMode="numeric" disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
          </div>
        </div>
      </div>

      {/* ── Member list ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Members
            <span className="text-slate-400 font-normal ml-1 text-xs">
              ({members.length} · M:{maleCount} F:{femaleCount})
            </span>
          </h3>
        </div>

        {/* Add member */}
        {!isLocked && (
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['sewadar', 'sangat'] as const).map(t => (
                <button key={t}
                  onClick={() => { setSearchTab(t); setSearchQuery(''); setSearchRes([]) }}
                  className={['flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all touch-manipulation',
                    searchTab === t ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
                  {t === 'sewadar' ? 'Add Sewadar' : 'Add Sangat'}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchTab === 'sewadar' ? 'Name or badge...' : 'Name or SG ID...'}
                className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>
            {searching && <p className="text-xs text-slate-400 text-center">Searching...</p>}
            {searchRes.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {searchRes.map(r => {
                  const isSew     = 'badge_number' in r
                  const displayId = isSew ? (r as SewadarResult).badge_number : (r as SangatResult).sangat_id
                  const alreadyIn = !!members.find(m => m.display_id === displayId)
                  return (
                    <button key={r.id} onClick={() => !alreadyIn && addMember(r)}
                      disabled={alreadyIn}
                      className="w-full text-left px-4 py-3 hover:bg-maroon-50 border-b border-slate-100 last:border-0 disabled:opacity-40 touch-manipulation flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{displayId}</p>
                        <p className="text-[10px] text-slate-400">
                          {r.gender === 'M' ? 'Male' : 'Female'} · Age {r.age ?? '—'}
                        </p>
                      </div>
                      {alreadyIn
                        ? <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                        : <Plus size={14} className="text-maroon-500 flex-shrink-0" />
                      }
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Member rows */}
        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No members added yet
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sorted.map((m, idx) => (
              <div key={m.display_id}
                className={`flex items-center gap-3 px-4 py-3 ${m.is_jathedar ? 'bg-gold-50/60' : ''}`}>
                <span className="text-[10px] text-slate-300 w-5 text-right flex-shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">
                      {m.gender}
                    </Badge>
                    {m.is_jathedar && (
                      <Badge variant="gold" className="text-[9px] flex-shrink-0">★ Jathedar</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{m.display_id}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {m.father_name ?? '—'} · Age {m.age ?? '—'}
                  </p>
                </div>

                {/* Actions */}
                {!isLocked && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Set as Jathedar */}
                    <button
                      onClick={() => m.is_jathedar ? clearJathedar() : setAsJathedar(m.display_id)}
                      className={[
                        'p-1.5 rounded-lg transition-colors touch-manipulation',
                        m.is_jathedar
                          ? 'text-gold-500 bg-gold-100'
                          : 'text-slate-300 hover:text-gold-500 hover:bg-gold-50',
                      ].join(' ')}
                      title={m.is_jathedar ? 'Remove as Jathedar' : 'Set as Jathedar'}
                    >
                      <Star size={14} className={m.is_jathedar ? 'fill-gold-500' : ''} />
                    </button>
                    {/* Remove member */}
                    <button
                      onClick={() => removeMember(m.display_id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 touch-manipulation rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {members.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between text-xs font-medium text-slate-600">
            <span>Total: {members.length}</span>
            <span>Male: {maleCount} · Female: {femaleCount}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Save / Submit */}
      {!isLocked && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => saveNR(false)}
            disabled={saving}
            className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 transition-transform touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-maroon-300 border-t-maroon-600 rounded-full animate-spin" /> Saving...</>
              : <><Save size={15} /> Save Draft</>
            }
          </button>
          <button
            onClick={() => saveNR(true)}
            disabled={saving}
            className="py-3.5 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={15} /> Submit to HQ
          </button>
        </div>
      )}
      <div className="pb-4" />
    </div>
  )
}