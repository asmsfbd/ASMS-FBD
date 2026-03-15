import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Save, Send, Search, Plus, Trash2,
  User, AlertTriangle, CheckCircle
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

interface NRHeader {
  srs_id:        string
  jathedar_badge: string
  jathedar_name:  string
  jathedar_phone: string
  vehicle_type:   string
  driver_name:    string
  driver_mobile:  string
  jatha_name:     string
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
  const { id }              = useParams<{ id: string }>()
  const [searchParams]      = useSearchParams()
  const scheduleIdParam     = searchParams.get('schedule')
  const isEdit              = !!id && id !== 'new'
  const { user }            = useAuth()
  const navigate            = useNavigate()

  const [schedule,    setSchedule]    = useState<Schedule | null>(null)
  const [nrId,        setNRId]        = useState<number | null>(null)
  const [nrStatus,    setNRStatus]    = useState('draft')
  const [header,      setHeader]      = useState<NRHeader>({
    srs_id: '', jathedar_badge: '', jathedar_name: '',
    jathedar_phone: '', vehicle_type: '', driver_name: '',
    driver_mobile: '', jatha_name: '',
  })
  const [members,     setMembers]     = useState<NRMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  // Search state
  const [searchTab,   setSearchTab]   = useState<'sewadar' | 'sangat'>('sewadar')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRes,   setSearchRes]   = useState<(SewadarResult | SangatResult)[]>([])
  const [searching,   setSearching]   = useState(false)

  // Jathedar search
  const [jatSearchQ,  setJatSearchQ]  = useState('')
  const [jatResults,  setJatResults]  = useState<SewadarResult[]>([])
  const [jatSearching, setJatSearching] = useState(false)
  const [showJatSearch, setShowJatSearch] = useState(false)

  const isLocked = nrStatus !== 'draft' && user?.role !== 'aso'

  useEffect(() => {
    if (user) init()
  }, [user, id, scheduleIdParam])

  const init = async () => {
    setLoading(true)
    try {
      if (isEdit && id) {
        // Load existing NR
        const { data: nr } = await supabase
          .from('nominal_roles')
          .select('*, sewa_schedule!nominal_roles_sewa_schedule_id_fkey(id,jatha_name,destination,department,from_date,to_date)')
          .eq('id', id)
          .single()

        if (nr) {
          setNRId(nr.id)
          setNRStatus(nr.status)
          setSchedule((nr as any).sewa_schedule as Schedule)
          setHeader({
            srs_id:         nr.srs_id ?? '',
            jathedar_badge: nr.jathedar_badge ?? '',
            jathedar_name:  nr.jathedar_name ?? '',
            jathedar_phone: nr.jathedar_phone ?? '',
            vehicle_type:   nr.vehicle_type ?? '',
            driver_name:    nr.driver_name ?? '',
            driver_mobile:  nr.driver_mobile ?? '',
            jatha_name:     nr.jatha_name ?? '',
          })
        }

        // Load members
        const { data: members } = await supabase
          .from('nr_members')
          .select('*')
          .eq('nominal_role_id', id)
          .order('is_jathedar', { ascending: false })
          .order('gender')
          .order('name')

        setMembers((members ?? []) as NRMember[])
      } else if (scheduleIdParam) {
        // New NR from schedule
        const { data: sched } = await supabase
          .from('sewa_schedule')
          .select('id, jatha_name, destination, department, from_date, to_date')
          .eq('id', scheduleIdParam)
          .single()

        if (sched) {
          setSchedule(sched as Schedule)
          setHeader(h => ({ ...h, jatha_name: (sched as any).jatha_name ?? '' }))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Jathedar search
  const searchJathedar = useCallback(async (q: string) => {
    if (!user || q.length < 2) { setJatResults([]); return }
    setJatSearching(true)
    try {
      const { data } = await supabase
        .from('sewadars')
        .select('id, badge_number, name, father_name, gender, age, address, mobile, department')
        .eq('centre', user.centre)
        .or(`name.ilike.%${q}%,badge_number.ilike.%${q}%`)
        .limit(6)
      setJatResults((data ?? []) as SewadarResult[])
    } finally { setJatSearching(false) }
  }, [user])

  useEffect(() => {
    const t = setTimeout(() => searchJathedar(jatSearchQ), 300)
    return () => clearTimeout(t)
  }, [jatSearchQ, searchJathedar])

  const selectJathedar = (sw: SewadarResult) => {
    setHeader(h => ({
      ...h,
      jathedar_badge: sw.badge_number,
      jathedar_name:  sw.name,
      jathedar_phone: sw.mobile ?? '',
    }))
    setShowJatSearch(false)
    setJatSearchQ('')
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
    const isSew = 'badge_number' in result
    const displayId = isSew ? result.badge_number : (result as SangatResult).sangat_id

    // Check duplicate
    if (members.find(m => m.display_id === displayId)) return

    const newMember: NRMember = {
      display_id:  displayId,
      member_type: isSew ? 'sewadar' : 'sangat',
      name:        result.name,
      father_name: result.father_name,
      gender:      result.gender,
      age:         result.age,
      address:     result.address,
      mobile:      result.mobile,
      department:  isSew ? (result as SewadarResult).department : null,
      is_jathedar: false,
      ...(isSew
        ? { sewadar_id: result.id }
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

  const sortedMembers = (): NRMember[] => {
    // Jathedar first, then males alphabetical, then females alphabetical
    const jathedar = members.filter(m => m.is_jathedar)
    const males    = members.filter(m => !m.is_jathedar && m.gender === 'M').sort((a,b) => a.name.localeCompare(b.name))
    const females  = members.filter(m => !m.is_jathedar && m.gender === 'F').sort((a,b) => a.name.localeCompare(b.name))
    return [...jathedar, ...males, ...females]
  }

  // Save NR header + members
  const saveNR = async (andSubmit = false) => {
    if (!user || !schedule) return
    if (!header.jathedar_name) { setError('Enter Jathedar details'); return }
    if (members.length === 0)  { setError('Add at least one member'); return }
    if (andSubmit && !header.srs_id) { setError('SRS ID is required before submitting'); return }

    setSaving(true)
    setError('')
    try {
      const sorted = sortedMembers()
      const payload = {
        centre:          user.centre,
        sewa_schedule_id: schedule.id,
        jatha_name:      header.jatha_name || schedule.jatha_name,
        schedule_dates:  `${schedule.from_date} to ${schedule.to_date}`,
        srs_id:          header.srs_id || null,
        jathedar_badge:  header.jathedar_badge || null,
        jathedar_name:   header.jathedar_name,
        jathedar_phone:  header.jathedar_phone || null,
        vehicle_type:    header.vehicle_type || null,
        driver_name:     header.driver_name || null,
        driver_mobile:   header.driver_mobile || null,
        status:          andSubmit ? 'submitted' : 'draft',
        ...(andSubmit ? { submitted_at: new Date().toISOString() } : {}),
      }

      let currentNRId = nrId

      if (currentNRId) {
        await supabase.from('nominal_roles').update(payload).eq('id', currentNRId)
      } else {
        const { data: newNR, error: nrErr } = await supabase
          .from('nominal_roles')
          .insert({ ...payload, created_by: user.badge_number })
          .select('id').single()
        if (nrErr) throw nrErr
        currentNRId = newNR.id
        setNRId(currentNRId)
      }

      // Upsert members
      if (currentNRId) {
        // Delete existing then re-insert (simplest approach for ordering)
        await supabase.from('nr_members').delete().eq('nominal_role_id', currentNRId)

        const memberRows = sorted.map((m, idx) => ({
          nominal_role_id: currentNRId,
          serial_no:       idx + 1,
          display_id:      m.display_id,
          member_type:     m.member_type,
          sewadar_id:      m.sewadar_id ?? null,
          sangat_id:       m.sangat_id ?? null,
          name:            m.name,
          father_name:     m.father_name,
          gender:          m.gender,
          age:             m.age,
          address:         m.address,
          mobile:          m.mobile,
          department:      m.department,
          is_jathedar:     m.is_jathedar,
          centre:          user.centre,
        }))

        await supabase.from('nr_members').insert(memberRows)
      }

      if (andSubmit) {
        setNRStatus('submitted')
        navigate(`/nominal-roles/${currentNRId}`)
      } else {
        setNRStatus('draft')
        if (!nrId && currentNRId) navigate(`/nominal-roles/${currentNRId}`, { replace: true })
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
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

  if (!schedule && !isEdit) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-slate-400 text-sm">No jatha schedule linked.</p>
        <Link to="/jatha-schedule" className="text-maroon-600 text-sm mt-2 inline-block">
          ← View Jatha Schedules
        </Link>
      </div>
    )
  }

  const sorted = sortedMembers()
  const maleCount   = members.filter(m => m.gender === 'M').length
  const femaleCount = members.filter(m => m.gender === 'F').length

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/nominal-roles" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Edit Nominal Role' : 'New Nominal Role'}
          </h1>
          <p className="text-xs text-slate-400">{user?.centre} · {schedule?.jatha_name}</p>
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

      {/* Schedule info */}
      {schedule && (
        <div className="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-maroon-700">{schedule.jatha_name}</p>
          <p className="text-[10px] text-maroon-500 mt-0.5">
            {schedule.destination} · {schedule.department} ·{' '}
            {new Date(schedule.from_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
            {' – '}
            {new Date(schedule.to_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
          </p>
        </div>
      )}

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            NR is {nrStatus} — editing is locked. Contact ASO for changes.
          </p>
        </div>
      )}

      {/* ── NR Header Details ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">NR Details</p>

        {/* SRS ID */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
            SRS ID <span className="text-slate-300">(required before submitting)</span>
          </label>
          <input
            value={header.srs_id}
            onChange={e => setHeader(h => ({ ...h, srs_id: e.target.value }))}
            placeholder="e.g. 12345"
            disabled={isLocked}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-maroon-400 disabled:bg-slate-50"
          />
        </div>

        {/* Jathedar */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
            Jathedar (जथेदार) *
          </label>

          {/* Selected jathedar display */}
          {header.jathedar_name && (
            <div className="flex items-center gap-3 p-3 bg-maroon-50 border border-maroon-200 rounded-lg mb-2">
              <User size={16} className="text-maroon-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-maroon-800">{header.jathedar_name}</p>
                {header.jathedar_badge && (
                  <p className="text-[10px] font-mono text-maroon-500">{header.jathedar_badge}</p>
                )}
              </div>
              {!isLocked && (
                <button onClick={() => { setHeader(h => ({ ...h, jathedar_name:'', jathedar_badge:'', jathedar_phone:'' })); setShowJatSearch(true) }}
                  className="text-maroon-400 hover:text-maroon-600 touch-manipulation">
                  ✕
                </button>
              )}
            </div>
          )}

          {(!header.jathedar_name || showJatSearch) && !isLocked && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={jatSearchQ}
                  onChange={e => { setJatSearchQ(e.target.value); setShowJatSearch(true) }}
                  placeholder="Search sewadar by name or badge..."
                  className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
                />
              </div>
              {jatResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {jatResults.map(sw => (
                    <button key={sw.id} onClick={() => selectJathedar(sw)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-maroon-50 border-b border-slate-100 last:border-0 touch-manipulation">
                      <p className="font-medium text-slate-800">{sw.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{sw.badge_number}</p>
                    </button>
                  ))}
                </div>
              )}
              {/* Manual entry option */}
              <div className="grid grid-cols-2 gap-2">
                <input value={header.jathedar_name}
                  onChange={e => setHeader(h => ({ ...h, jathedar_name: e.target.value }))}
                  placeholder="Or type name manually"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
                <input value={header.jathedar_phone}
                  onChange={e => setHeader(h => ({ ...h, jathedar_phone: e.target.value }))}
                  placeholder="Phone number"
                  type="tel" inputMode="numeric"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
              </div>
            </div>
          )}

          {/* Jathedar phone (always editable) */}
          {header.jathedar_name && !showJatSearch && (
            <input
              value={header.jathedar_phone}
              onChange={e => setHeader(h => ({ ...h, jathedar_phone: e.target.value }))}
              placeholder="Jathedar phone number"
              type="tel" inputMode="numeric"
              disabled={isLocked}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50 mt-2"
            />
          )}
        </div>

        {/* Vehicle details */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
            Vehicle Details
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select value={header.vehicle_type}
              onChange={e => setHeader(h => ({ ...h, vehicle_type: e.target.value }))}
              disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50">
              <option value="">Vehicle type</option>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input value={header.driver_name}
              onChange={e => setHeader(h => ({ ...h, driver_name: e.target.value }))}
              placeholder="Driver name" disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
            <input value={header.driver_mobile}
              onChange={e => setHeader(h => ({ ...h, driver_mobile: e.target.value }))}
              placeholder="Driver mobile" type="tel" inputMode="numeric" disabled={isLocked}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
          </div>
        </div>
      </div>

      {/* ── Member List ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Members
            <span className="text-slate-400 font-normal ml-1 text-xs">
              ({members.length} total · M:{maleCount} F:{femaleCount})
            </span>
          </h3>
        </div>

        {/* Add member search */}
        {!isLocked && (
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['sewadar','sangat'] as const).map(t => (
                <button key={t} onClick={() => { setSearchTab(t); setSearchQuery(''); setSearchRes([]) }}
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
                placeholder={searchTab === 'sewadar'
                  ? 'Search by name or badge...'
                  : 'Search by name or SG ID...'
                }
                className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>

            {searching && <p className="text-xs text-slate-400 text-center">Searching...</p>}

            {searchRes.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {searchRes.map(r => {
                  const isSew      = 'badge_number' in r
                  const displayId  = isSew ? (r as SewadarResult).badge_number : (r as SangatResult).sangat_id
                  const alreadyIn  = members.find(m => m.display_id === displayId)
                  return (
                    <button key={r.id} onClick={() => !alreadyIn && addMember(r)} disabled={!!alreadyIn}
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
          <div className="py-8 text-center text-sm text-slate-400">No members added yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sorted.map((m, idx) => (
              <div key={m.display_id} className={`flex items-center gap-3 px-4 py-3 ${m.is_jathedar ? 'bg-maroon-50/50' : ''}`}>
                <span className="text-[10px] text-slate-400 w-6 text-right flex-shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">
                      {m.gender}
                    </Badge>
                    {m.is_jathedar && (
                      <Badge variant="gold" className="text-[9px] flex-shrink-0">Jathedar</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{m.display_id}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {m.father_name ?? '—'} · Age {m.age ?? '—'}
                  </p>
                </div>
                {!isLocked && (
                  <button onClick={() => removeMember(m.display_id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 touch-manipulation flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Member count footer */}
        {members.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between text-xs font-medium text-slate-600">
            <span>Total: {members.length} members</span>
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

      {/* Action buttons */}
      {!isLocked && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => saveNR(false)} disabled={saving || submitting}
            className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 transition-transform touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><span className="w-4 h-4 border-2 border-maroon-300 border-t-maroon-600 rounded-full animate-spin" />Saving...</> : <><Save size={15} />Save Draft</>}
          </button>
          <button onClick={() => saveNR(true)} disabled={saving || submitting}
            className="py-3.5 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</> : <><Send size={15} />Submit to HQ</>}
          </button>
        </div>
      )}
      <div className="pb-4" />
    </div>
  )
}
