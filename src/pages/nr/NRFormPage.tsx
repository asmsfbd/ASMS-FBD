import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Save, Send, Search, Plus, Trash2,
  Star, AlertTriangle, CheckCircle, Check, Users, Info
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Schedule {
  id: number; jatha_name: string; destination: string
  department: string; from_date: string; to_date: string
}

interface NRMember {
  id?: number; display_id: string; member_type: 'sewadar' | 'sangat'
  name: string; father_name: string | null; gender: string
  age: number | null; address: string | null; mobile: string | null
  department: string | null; is_jathedar: boolean
  contributing_centre: string
  sewadar_id?: number; sangat_id?: number; badge_number?: string
}

interface SectionStatus {
  centre: string; srs_id: string; is_ready: boolean
  member_count: number; db_id?: number
}

interface SewadarResult {
  id: number; badge_number: string; name: string
  father_name: string | null; gender: string; age: number | null
  address: string | null; mobile: string | null; department: string | null
}

interface SangatResult {
  id: number; sangat_id: string; name: string
  father_name: string | null; gender: string; age: number | null
  address: string | null; mobile: string | null; aadhaar_last4: string
}

const VEHICLE_TYPES = ['Bus', 'Tempo', 'Car', 'Train', 'Van', 'Other']

export default function NRFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const scheduleIdParam = searchParams.get('schedule')
  const isEdit = !!id && id !== 'new'
  const { user } = useAuth()
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [nrId, setNRId] = useState<number | null>(null)
  const [nrStatus, setNRStatus] = useState('draft')
  const [ownerCentre, setOwnerCentre] = useState('')
  const [myQuota, setMyQuota] = useState(0)
  const [mySubQuota, setMySubQuota] = useState(0)
  const [vehicleType, setVehicleType] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverMobile, setDriverMobile] = useState('')
  const [sections, setSections] = useState<SectionStatus[]>([])
  const [members, setMembers] = useState<NRMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [markingReady, setMarkingReady] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'my-section' | 'all' | 'summary'>('my-section')
  const [searchTab, setSearchTab] = useState<'sewadar' | 'sangat'>('sewadar')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRes, setSearchRes] = useState<(SewadarResult | SangatResult)[]>([])
  const [searching, setSearching] = useState(false)

  const isASO = user?.role === 'aso'
  const isOwner = isASO || user?.centre === ownerCentre
  const mySection = sections.find(s => s.centre === user?.centre)
  const iAmReady = mySection?.is_ready ?? false
  const canAddMembers = nrStatus === 'draft' && !iAmReady
  const canSubmitToASO = isOwner && nrStatus === 'draft'

  const myMembers = members.filter(m => m.contributing_centre === user?.centre)
  const allMaleCount = members.filter(m => m.gender === 'M').length
  const allFemCount = members.filter(m => m.gender === 'F').length
  const myMaleCount = myMembers.filter(m => m.gender === 'M').length
  const myFemCount = myMembers.filter(m => m.gender === 'F').length
  const jathedar = members.find(m => m.is_jathedar)
  const effectiveQuota = user?.centre === ownerCentre ? myQuota : mySubQuota
  const remainingQuota = effectiveQuota > 0 ? effectiveQuota - myMembers.length : null
  const allSectionsReady = sections.length > 0 && sections.every(s => s.is_ready)

  const vehicleNameLabel = vehicleType === 'Train' ? 'Train Name' : 'Driver Name'
  const vehicleMobileLabel = vehicleType === 'Train' ? 'Train Time' : 'Driver Mobile'
  const vehicleIcon = vehicleType === 'Train' ? '🚂' : '🚌'

  useEffect(() => { if (user) init() }, [user, id, scheduleIdParam])

  const init = async () => {
    setLoading(true)
    try {
      if (isEdit && id) {
        const { data: nr } = await supabase
          .from('nominal_roles').select('*').eq('id', id).single()

        if (nr) {
          setNRId(nr.id); setNRStatus(nr.status ?? 'draft')
          setOwnerCentre(nr.centre)
          setVehicleType(nr.vehicle_type ?? '')
          setDriverName(nr.driver_name ?? '')
          setDriverMobile(nr.driver_mobile ?? '')

          if (nr.sewa_schedule_id) {
            const { data: s } = await supabase.from('sewa_schedule')
              .select('id,jatha_name,destination,department,from_date,to_date')
              .eq('id', nr.sewa_schedule_id).single()
            if (s) setSchedule(s as Schedule)

            const { data: sq } = await supabase.from('sewa_quota')
              .select('quota_count').eq('sewa_schedule_id', nr.sewa_schedule_id)
              .eq('centre', nr.centre).maybeSingle()
            setMyQuota(sq?.quota_count ?? 0)

            if (user?.centre !== nr.centre) {
              const { data: scq } = await supabase.from('sub_centre_quota')
                .select('quota_count').eq('sewa_schedule_id', nr.sewa_schedule_id)
                .eq('sub_centre', user?.centre ?? '').maybeSingle()
              setMySubQuota(scq?.quota_count ?? 0)
            }
          }
        }

        const { data: mData } = await supabase
          .from('nr_members').select('*').eq('nominal_role_id', id)
        setMembers((mData ?? []) as NRMember[])

        const { data: sData } = await supabase
          .from('nr_section_status').select('*').eq('nominal_role_id', id).order('centre')
        setSections((sData ?? []).map((s: any) => ({
          centre: s.centre, srs_id: s.srs_id ?? '',
          is_ready: s.is_ready, member_count: s.member_count, db_id: s.id,
        })))

      } else if (scheduleIdParam && user) {
        const schedId = parseInt(scheduleIdParam)

        // Check if NR already exists for this schedule + owner centre
        // For sub-centres, owner is the parent centre
        const { data: centreInfo } = await supabase
          .from('centres').select('parent_centre')
          .eq('centre_name', user.centre).single()
        const isSub   = centreInfo?.parent_centre !== user.centre
        const ownerC  = isSub ? (centreInfo?.parent_centre ?? user.centre) : user.centre

        const { data: existingNR } = await supabase
          .from('nominal_roles')
          .select('id')
          .eq('sewa_schedule_id', schedId)
          .eq('centre', ownerC)
          .maybeSingle()

        if (existingNR) {
          // NR already exists — redirect to it instead of creating a new one
          navigate(`/nominal-roles/${existingNR.id}`, { replace: true })
          return
        }

        const { data: s } = await supabase.from('sewa_schedule')
          .select('id,jatha_name,destination,department,from_date,to_date')
          .eq('id', schedId).single()
        if (s) setSchedule(s as Schedule)
        setOwnerCentre(ownerC)

        const { data: sq } = await supabase.from('sewa_quota')
          .select('quota_count').eq('sewa_schedule_id', schedId)
          .eq('centre', ownerC).maybeSingle()
        setMyQuota(sq?.quota_count ?? 0)

        // Sub-centre quota
        if (isSub) {
          const { data: scq } = await supabase.from('sub_centre_quota')
            .select('quota_count').eq('sewa_schedule_id', schedId)
            .eq('sub_centre', user.centre).maybeSingle()
          setMySubQuota(scq?.quota_count ?? 0)
        }
      }
    } finally { setLoading(false) }
  }

  const doSearch = useCallback(async () => {
    if (!user || searchQuery.length < 2) { setSearchRes([]); return }
    setSearching(true)
    try {
      if (searchTab === 'sewadar') {
        const { data } = await supabase.from('sewadars')
          .select('id,badge_number,name,father_name,gender,age,address,mobile,department')
          .eq('centre', user.centre).eq('is_active', true)
          .or(`name.ilike.%${searchQuery}%,badge_number.ilike.%${searchQuery}%`).limit(8)
        setSearchRes((data ?? []) as SewadarResult[])
      } else {
        const { data } = await supabase.from('sangat')
          .select('id,sangat_id,name,father_name,gender,age,address,mobile,aadhaar_last4')
          .eq('centre', user.centre)
          .or(`name.ilike.%${searchQuery}%,sangat_id.ilike.%${searchQuery}%`).limit(8)
        setSearchRes((data ?? []) as SangatResult[])
      }
    } finally { setSearching(false) }
  }, [user, searchQuery, searchTab])

  useEffect(() => {
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchTab, doSearch])

  const addMember = (r: SewadarResult | SangatResult) => {
    const isSew = 'badge_number' in r
    const displayId = isSew ? (r as SewadarResult).badge_number : (r as SangatResult).sangat_id
    if (members.find(m => m.display_id === displayId)) return
    setMembers(prev => [...prev, {
      display_id: displayId, member_type: isSew ? 'sewadar' : 'sangat',
      name: r.name, father_name: r.father_name, gender: r.gender, age: r.age,
      address: r.address, mobile: r.mobile,
      department: isSew ? (r as SewadarResult).department : null,
      is_jathedar: false, contributing_centre: user?.centre ?? '',
      ...(isSew ? { sewadar_id: r.id, badge_number: (r as SewadarResult).badge_number } : { sangat_id: r.id }),
    }])
    setSearchQuery(''); setSearchRes([])
  }

  const removeMember = (displayId: string) => {
    setMembers(prev => prev.filter(m => {
      if (m.display_id !== displayId) return true
      // Can only remove own members
      return m.contributing_centre !== user?.centre
    }))
  }

  const setAsJathedar = (displayId: string) => {
    setMembers(prev => prev.map(m => ({ ...m, is_jathedar: m.display_id === displayId })))
  }
  const clearJathedar = () => setMembers(prev => prev.map(m => ({ ...m, is_jathedar: false })))

  const updateSectionSrsId = (srsId: string) => {
    setSections(prev => {
      const exists = prev.find(s => s.centre === user?.centre)
      if (exists) {
        return prev.map(s => s.centre === user?.centre ? { ...s, srs_id: srsId } : s)
      }
      // Create new section entry for this centre
      return [...prev, { centre: user?.centre ?? '', srs_id: srsId, is_ready: false, member_count: 0 }]
    })
  }

  // Save NR (owner creates/updates header + all members)
  const saveNR = async (andSubmit = false) => {
    if (!user || !schedule) return
    if (members.length === 0) { setError('Add at least one member'); return }
    if (isOwner && !jathedar) { setError('Set a Jathedar before submitting (tap ★ on a member)'); return }
    if (andSubmit) {
      const notReady = sections.filter(s => !s.is_ready && s.centre !== ownerCentre)
      if (notReady.length > 0) {
        setError(`${notReady.map(s => s.centre).join(', ')} have not marked their section as Ready`)
        return
      }
    }

    setSaving(true); setError('')
    try {
      const sorted = sortAllMembers()
      let currentNRId = nrId

      const payload: Record<string, unknown> = {
        centre: ownerCentre,
        sewa_schedule_id: schedule.id,
        jatha_name: schedule.jatha_name,
        schedule_dates: `${schedule.from_date} to ${schedule.to_date}`,
        jathedar_badge: jathedar?.badge_number ?? null,
        jathedar_name: jathedar?.name ?? null,
        jathedar_phone: jathedar?.mobile ?? null,
        vehicle_type: vehicleType || null,
        driver_name: driverName || null,
        driver_mobile: driverMobile || null,
        is_sub_centre: false,
        parent_centre: ownerCentre,
        status: andSubmit ? 'submitted' : 'draft',
        ...(andSubmit ? { submitted_at: new Date().toISOString() } : {}),
      }

      if (currentNRId) {
        const { error: e } = await supabase.from('nominal_roles').update(payload).eq('id', currentNRId)
        if (e) throw e
      } else {
        const { data: nr, error: e } = await supabase.from('nominal_roles')
          .insert({ ...payload, created_by: user.badge_number }).select('id').single()
        if (e) throw e
        currentNRId = nr.id; setNRId(currentNRId)
      }

      // Delete and re-insert all members
      await supabase.from('nr_members').delete().eq('nominal_role_id', currentNRId)
      if (sorted.length > 0) {
        const { error: me } = await supabase.from('nr_members').insert(
          sorted.map((m, idx) => ({
            nominal_role_id: currentNRId,
            serial_no: idx + 1,
            display_id: m.display_id,
            member_type: m.member_type,
            sewadar_id: m.sewadar_id ?? null,
            sangat_id: m.sangat_id ?? null,
            name: m.name,
            father_name: m.father_name ?? null,
            gender: m.gender,
            age: m.age ?? null,
            address: m.address ?? null,
            mobile: m.mobile ?? null,
            department: m.department ?? null,
            is_jathedar: m.is_jathedar,
            contributing_centre: m.contributing_centre,
            centre: m.contributing_centre,
          }))
        )
        if (me) throw me
      }

      // Upsert owner's section status
      if (currentNRId) await upsertMySection(currentNRId, false)

      if (andSubmit) setNRStatus('submitted')
      navigate(`/nominal-roles/${currentNRId}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  // Save only my section's members (sub-centre flow)
  const saveMySection = async () => {
    if (!user || !nrId) return
    setSaving(true); setError('')
    try {
      // Delete my old members, insert new ones
      const { error: de } = await supabase.from('nr_members')
        .delete().eq('nominal_role_id', nrId).eq('contributing_centre', user.centre)
      if (de) throw de

      const myMems = myMembers
      if (myMems.length > 0) {
        const { error: ie } = await supabase.from('nr_members').insert(
          myMems.map((m, idx) => ({
            nominal_role_id: nrId,
            serial_no: idx + 1,
            display_id: m.display_id,
            member_type: m.member_type,
            sewadar_id: m.sewadar_id ?? null,
            sangat_id: m.sangat_id ?? null,
            name: m.name,
            father_name: m.father_name ?? null,
            gender: m.gender,
            age: m.age ?? null,
            address: m.address ?? null,
            mobile: m.mobile ?? null,
            department: m.department ?? null,
            is_jathedar: false,
            contributing_centre: user.centre,
            centre: user.centre,
          }))
        )
        if (ie) throw ie
      }

      await upsertMySection(nrId, false)

      const { data: refreshedMembers } = await supabase
        .from('nr_members').select('*').eq('nominal_role_id', nrId)
      if (refreshedMembers) {
        setMembers(refreshedMembers as NRMember[])
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const upsertMySection = async (nrRoleId: number, isReady: boolean) => {
    if (!user) return
    const mySrs = sections.find(s => s.centre === user.centre)?.srs_id ?? ''
    const myCount = members.filter(m => m.contributing_centre === user.centre).length
    const existing = sections.find(s => s.centre === user.centre)

    if (existing?.db_id) {
      await supabase.from('nr_section_status').update({
        srs_id: mySrs || null, is_ready: isReady,
        member_count: myCount, updated_at: new Date().toISOString(),
        ...(isReady ? { ready_at: new Date().toISOString() } : {}),
      }).eq('id', existing.db_id)
    } else {
      const { data } = await supabase.from('nr_section_status').insert({
        nominal_role_id: nrRoleId, centre: user.centre,
        srs_id: mySrs || null, is_ready: isReady,
        member_count: myCount,
        ...(isReady ? { ready_at: new Date().toISOString() } : {}),
      }).select('id').single()
      if (data) {
        setSections(prev => {
          const existing = prev.find(s => s.centre === user.centre)
          if (existing) return prev.map(s => s.centre === user.centre ? { ...s, db_id: data.id } : s)
          return [...prev, { centre: user.centre, srs_id: mySrs, is_ready: isReady, member_count: myCount, db_id: data.id }]
        })
      }
    }

    setSections(prev => prev.map(s =>
      s.centre === user.centre
        ? { ...s, is_ready: isReady, member_count: myCount }
        : s
    ))
  }

  const markReady = async () => {
    if (!user || !nrId) return
    const mySrs = sections.find(s => s.centre === user.centre)?.srs_id ?? ''
    if (!mySrs) { setError('Enter your SRS ID before marking ready'); return }
    setMarkingReady(true)
    try {
      await saveMySection()
      if (nrId) await upsertMySection(nrId, true)
    } catch (err: any) {
      setError(err.message ?? 'Failed')
    } finally { setMarkingReady(false) }
  }

  const unmarkReady = async () => {
    if (!user || !nrId) return
    if (nrId) await upsertMySection(nrId, false)
  }

  // Sort: jathedar first, then by centre (owner first, then sub-centres alphabetically),
  // within each centre: males A-Z then females A-Z
  const sortAllMembers = (): NRMember[] => {
    const jath = members.filter(m => m.is_jathedar)
    const rest = members.filter(m => !m.is_jathedar)
    const centreOrder = [ownerCentre, ...sections.map(s => s.centre).filter(c => c !== ownerCentre).sort()]
    const sorted: NRMember[] = []
    for (const centre of centreOrder) {
      const cm = rest.filter(m => m.contributing_centre === centre)
      const males = cm.filter(m => m.gender === 'M').sort((a, b) => a.name.localeCompare(b.name))
      const females = cm.filter(m => m.gender === 'F').sort((a, b) => a.name.localeCompare(b.name))
      sorted.push(...males, ...females)
    }
    return [...jath, ...sorted]
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!schedule) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <p className="text-slate-400 text-sm">No jatha schedule linked.</p>
      <Link to="/jatha-schedule" className="text-maroon-600 text-sm mt-2 inline-block">← Jatha Schedules</Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/nominal-roles" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Nominal Role' : 'New Nominal Role'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400">{user?.centre}</p>
            {!isOwner && <Badge variant="navy" className="text-[9px]">Sub-centre</Badge>}
            {isOwner && <Badge variant="maroon" className="text-[9px]">NR Owner</Badge>}
          </div>
        </div>
        <Badge variant={
          nrStatus === 'approved' || nrStatus === 'issued' ? 'green' :
            nrStatus === 'submitted' ? 'navy' :
              nrStatus === 'rejected' ? 'red' : 'gray'
        } className="text-[10px] flex-shrink-0">
          {nrStatus.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Schedule info */}
      <div className="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-maroon-700">{schedule.jatha_name}</p>
        <p className="text-[10px] text-maroon-500 mt-0.5">
          {schedule.destination} · {schedule.department} ·{' '}
          {new Date(schedule.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {' – '}
          {new Date(schedule.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Sub-centre info banner */}
      {!isOwner && isEdit && (
        <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={14} className="text-navy-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-navy-700">
              You are contributing to {ownerCentre}'s NR
            </p>
            <p className="text-[10px] text-navy-500 mt-0.5">
              Add your centre's members here. Enter your SRS ID and mark ready when done.
              {ownerCentre} will submit the full NR to ASO.
            </p>
          </div>
        </div>
      )}

      {/* Locked banner */}
      {iAmReady && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            <p className="text-xs font-semibold text-green-700">
              Your section is marked Ready — editing locked
            </p>
          </div>
          {nrStatus === 'draft' && (
            <button onClick={unmarkReady} className="text-xs text-green-600 underline touch-manipulation">
              Undo
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        <button onClick={() => setActiveTab('my-section')}
          className={['flex-1 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation',
            activeTab === 'my-section' ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
          My Section ({myMembers.length})
        </button>
        {isOwner && (
          <button onClick={() => setActiveTab('all')}
            className={['flex-1 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation',
              activeTab === 'all' ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
            All ({members.length})
          </button>
        )}
        <button onClick={() => setActiveTab('summary')}
          className={['flex-1 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation',
            activeTab === 'summary' ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
          Summary
        </button>
      </div>

      {/* ── MY SECTION TAB ── */}
      {activeTab === 'my-section' && (
        <>
          {/* My SRS ID */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {user?.centre} — Section Details
            </p>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                SRS ID for {user?.centre} *
              </label>
              <input
                value={sections.find(s => s.centre === user?.centre)?.srs_id ?? ''}
                onChange={e => updateSectionSrsId(e.target.value)}
                placeholder="Enter your centre's SRS ID"
                disabled={iAmReady || nrStatus !== 'draft'}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-maroon-400 disabled:bg-slate-50"
              />
            </div>

            {/* Quota counter */}
            {effectiveQuota > 0 && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-maroon-50 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-maroon-600">{effectiveQuota}</p>
                  <p className="text-[10px] text-slate-500">Quota</p>
                </div>
                <div className="bg-navy-50 rounded-xl p-2.5">
                  <p className="text-lg font-bold text-navy-600">{myMembers.length}</p>
                  <p className="text-[10px] text-slate-500">Added</p>
                </div>
                <div className={`rounded-xl p-2.5 ${remainingQuota === null ? 'bg-slate-50' :
                  remainingQuota < 0 ? 'bg-red-50' :
                    remainingQuota === 0 ? 'bg-green-50' : 'bg-amber-50'
                  }`}>
                  <p className={`text-lg font-bold ${remainingQuota === null ? 'text-slate-400' :
                    remainingQuota < 0 ? 'text-red-600' :
                      remainingQuota === 0 ? 'text-green-600' : 'text-amber-600'
                    }`}>{remainingQuota === null ? '—' : Math.abs(remainingQuota)}</p>
                  <p className="text-[10px] text-slate-500">
                    {remainingQuota === null ? '' : remainingQuota < 0 ? 'Over' : remainingQuota === 0 ? 'Full ✓' : 'Left'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Jathedar (owner only) */}
          {isOwner && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Overall Jathedar * <span className="text-slate-300 font-normal">— tap ★ on any member</span>
              </p>
              {jathedar ? (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Star size={15} className="text-amber-500 fill-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{jathedar.name}</p>
                    <p className="text-[10px] font-mono text-slate-500">{jathedar.display_id}</p>
                    <p className="text-[10px] text-slate-400">{jathedar.contributing_centre}</p>
                  </div>
                  {nrStatus === 'draft' && (
                    <button onClick={clearJathedar} className="text-xs text-slate-400 hover:text-red-500 touch-manipulation">Remove</button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-amber-600">Add members first, then tap ★ to set Jathedar</p>
                </div>
              )}
            </div>
          )}

          {/* Owner vehicle details */}
          {isOwner && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vehicle</p>
              <div className="grid grid-cols-3 gap-2">
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                  disabled={nrStatus !== 'draft'}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50">
                  <option value="">Type</option>
                  {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <input value={driverName} onChange={e => setDriverName(e.target.value)}
                  placeholder={vehicleNameLabel} disabled={nrStatus !== 'draft'}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
                <input value={driverMobile} onChange={e => setDriverMobile(e.target.value)}
                  placeholder={vehicleMobileLabel} disabled={nrStatus !== 'draft'}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 disabled:bg-slate-50" />
              </div>
              {vehicleType && (
                <p className="text-[10px] text-slate-400">
                  {vehicleIcon} {vehicleType}
                  {driverName && ` · ${vehicleNameLabel}: ${driverName}`}
                  {driverMobile && ` · ${vehicleMobileLabel}: ${driverMobile}`}
                </p>
              )}
            </div>
          )}

          {/* My members list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">
                {user?.centre} Members
                <span className="text-slate-400 font-normal ml-1 text-xs">
                  (M:{myMaleCount} F:{myFemCount})
                </span>
              </h3>
            </div>

            {/* Search — only if can add */}
            {canAddMembers && (
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {(['sewadar', 'sangat'] as const).map(t => (
                    <button key={t} onClick={() => { setSearchTab(t); setSearchQuery(''); setSearchRes([]) }}
                      className={['flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all touch-manipulation',
                        searchTab === t ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
                      {t === 'sewadar' ? 'Add Sewadar' : 'Add Sangat'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={searchTab === 'sewadar' ? 'Name or badge...' : 'Name or SG ID...'}
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
                </div>
                {searching && <p className="text-xs text-slate-400 text-center">Searching...</p>}
                {searchRes.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {searchRes.map(r => {
                      const isSew = 'badge_number' in r
                      const dId = isSew ? (r as SewadarResult).badge_number : (r as SangatResult).sangat_id
                      const already = !!members.find(m => m.display_id === dId)
                      return (
                        <button key={r.id} onClick={() => !already && addMember(r)} disabled={already}
                          className="w-full text-left px-4 py-3 hover:bg-maroon-50 border-b border-slate-100 last:border-0 disabled:opacity-40 touch-manipulation flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{dId}</p>
                            <p className="text-[10px] text-slate-400">{r.gender === 'M' ? 'Male' : 'Female'} · Age {r.age ?? '—'}</p>
                          </div>
                          {already ? <CheckCircle size={14} className="text-green-500" /> : <Plus size={14} className="text-maroon-500" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {myMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No members added yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {[...myMembers.filter(m => m.gender === 'M').sort((a, b) => a.name.localeCompare(b.name)),
                ...myMembers.filter(m => m.gender === 'F').sort((a, b) => a.name.localeCompare(b.name))]
                  .map((m, idx) => (
                    <div key={m.display_id} className={`flex items-center gap-3 px-4 py-3 ${m.is_jathedar ? 'bg-amber-50/40' : ''}`}>
                      <span className="text-[10px] text-slate-300 w-5 text-right flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                          <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">{m.gender}</Badge>
                          {m.is_jathedar && <Badge variant="gold" className="text-[9px] flex-shrink-0">★</Badge>}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{m.display_id}</p>
                        <p className="text-[10px] text-slate-400">{m.father_name ?? '—'} · Age {m.age ?? '—'}</p>
                      </div>
                      {canAddMembers && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isOwner && (
                            <button onClick={() => m.is_jathedar ? clearJathedar() : setAsJathedar(m.display_id)}
                              className={['p-1.5 rounded-lg transition-colors touch-manipulation',
                                m.is_jathedar ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500'].join(' ')}>
                              <Star size={13} className={m.is_jathedar ? 'fill-amber-400' : ''} />
                            </button>
                          )}
                          <button onClick={() => removeMember(m.display_id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 touch-manipulation rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {myMembers.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between text-xs text-slate-500">
                <span>Total: {myMembers.length}</span>
                <span>M:{myMaleCount} F:{myFemCount}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ALL MEMBERS TAB (owner only) ── */}
      {activeTab === 'all' && isOwner && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              All Members <span className="text-slate-400 font-normal text-xs">(M:{allMaleCount} F:{allFemCount})</span>
            </h3>
            <span className="text-xs text-slate-400">{members.length} total</span>
          </div>
          {sortAllMembers().map((m, idx) => {
            const showCentreHeader = idx === 0 ||
              sortAllMembers()[idx - 1].contributing_centre !== m.contributing_centre
            const centreMembers = members.filter(x => x.contributing_centre === m.contributing_centre)
            const sec = sections.find(s => s.centre === m.contributing_centre)
            return (
              <div key={m.display_id}>
                {showCentreHeader && (
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{m.contributing_centre}</span>
                      {sec?.srs_id && <span className="text-[10px] font-mono text-slate-500">SRS: {sec.srs_id}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{centreMembers.length} members</span>
                      {sec?.is_ready
                        ? <Badge variant="green" className="text-[9px]">✓ Ready</Badge>
                        : <Badge variant="gray" className="text-[9px]">Pending</Badge>
                      }
                    </div>
                  </div>
                )}
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 ${m.is_jathedar ? 'bg-amber-50/40' : ''}`}>
                  <span className="text-[10px] text-slate-300 w-5 text-right flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                      <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">{m.gender}</Badge>
                      {m.is_jathedar && <Badge variant="gold" className="text-[9px] flex-shrink-0">★ Jathedar</Badge>}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{m.display_id}</p>
                    <p className="text-[10px] text-slate-400">{m.father_name ?? '—'} · Age {m.age ?? '—'}</p>
                  </div>
                  {isOwner && nrStatus === 'draft' && (
                    <button onClick={() => m.is_jathedar ? clearJathedar() : setAsJathedar(m.display_id)}
                      className={['p-1.5 rounded-lg touch-manipulation',
                        m.is_jathedar ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-500'].join(' ')}>
                      <Star size={13} className={m.is_jathedar ? 'fill-amber-400' : ''} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="px-4 py-3 bg-slate-50 flex justify-between text-xs font-medium text-slate-600">
            <span>Grand Total: {members.length}</span>
            <span>M:{allMaleCount} F:{allFemCount}</span>
          </div>
        </div>
      )}

      {/* ── SUMMARY TAB ── */}
      {activeTab === 'summary' && (
        <div className="space-y-3">
          {/* Section readiness */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Section Status</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {sections.filter(s => s.is_ready).length} of {sections.length} sections ready
              </p>
            </div>
            {sections.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No sections yet — save the NR first
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {[ownerCentre, ...sections.map(s => s.centre).filter(c => c !== ownerCentre).sort()]
                  .filter(c => sections.some(s => s.centre === c))
                  .map(centre => {
                    const s = sections.find(s => s.centre === centre)!
                    return (
                      <div key={centre} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-700">{centre}</p>
                            {centre === ownerCentre && <Badge variant="maroon" className="text-[9px]">Owner</Badge>}
                          </div>
                          <div className="flex gap-3 mt-0.5">
                            <span className="text-[10px] text-slate-400">{s.member_count} members</span>
                            {s.srs_id && <span className="text-[10px] font-mono text-slate-400">SRS: {s.srs_id}</span>}
                          </div>
                        </div>
                        {s.is_ready
                          ? <Badge variant="green" className="text-[10px] flex items-center gap-1"><Check size={10} />Ready</Badge>
                          : <Badge variant="gray" className="text-[10px]">Pending</Badge>
                        }
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Overall stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-navy-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-navy-600">{allMaleCount}</p>
              <p className="text-[10px] text-slate-500">Total Male</p>
            </div>
            <div className="bg-maroon-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-maroon-600">{allFemCount}</p>
              <p className="text-[10px] text-slate-500">Total Female</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}

      {/* Sub-centre: Save + Mark Ready */}
      {!isOwner && nrStatus === 'draft' && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={saveMySection} disabled={saving || iAmReady}
            className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><span className="w-4 h-4 border-2 border-maroon-300 border-t-maroon-600 rounded-full animate-spin" />Saving...</> : <><Save size={15} />Save</>}
          </button>
          <button onClick={iAmReady ? unmarkReady : markReady} disabled={markingReady}
            className={['py-3.5 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2',
              iAmReady ? 'border-2 border-green-200 text-green-700' : 'bg-green-600 text-white'].join(' ')}>
            {markingReady ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
              iAmReady ? <><CheckCircle size={15} />Marked Ready</> : <><Check size={15} />Mark Ready</>}
          </button>
        </div>
      )}

      {/* Owner: Save Draft + Submit to ASO */}
      {isOwner && nrStatus === 'draft' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => saveNR(false)} disabled={saving}
              className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-maroon-300 border-t-maroon-600 rounded-full animate-spin" />Saving...</> : <><Save size={15} />Save Draft</>}
            </button>
            <button onClick={() => saveNR(true)} disabled={saving}
              className="py-3.5 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={15} /> Submit to HQ
            </button>
          </div>
          {!allSectionsReady && sections.length > 0 && (
            <p className="text-center text-[10px] text-amber-600">
              ⚠ {sections.filter(s => !s.is_ready).length} section(s) not yet marked ready
            </p>
          )}
        </>
      )}
      <div className="pb-4" />
    </div>
  )
}
