import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle, XCircle, Edit2, Send,
  FileText, Star, Info, Download, ThumbsUp, ThumbsDown, Award,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateNRPDF } from '@/lib/nrPDF'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface NRDetail {
  id:                      number
  centre:                  string
  parent_centre:           string | null
  is_sub_centre:           boolean
  status:                  string
  srs_id:                  string | null
  jatha_name:              string | null
  destination:             string | null
  department:              string | null
  from_date:               string | null
  to_date:                 string | null
  quota:                   number
  member_count:            number
  male_count:              number
  female_count:            number
  jathedar_name:           string | null
  jathedar_phone:          string | null
  vehicle_type:            string | null
  driver_name:             string | null
  driver_mobile:           string | null
  rejection_reason:        string | null
  centre_rejection_reason: string | null
  submitted_at:            string | null
  approved_at:             string | null
  sewa_schedule_id:        number | null
  aso_notes:               string | null
  centre_notes:            string | null
}

interface NRMember {
  id:                  number
  serial_no:           number
  display_id:          string
  name:                string
  father_name:         string | null
  gender:              string
  age:                 number | null
  address:             string | null
  mobile:              string | null
  department:          string | null
  is_jathedar:         boolean
  contributing_centre: string
  member_type:         'sewadar' | 'sangat'
  aadhaar_masked:      string | null
}

interface SectionStatus {
  centre:       string
  srs_id:       string | null
  is_ready:     boolean
  member_count: number
}

interface Review {
  id:           number
  author_badge: string
  author_role:  string
  comment_text: string
  is_resolved:  boolean
  created_at:   string
  sewadars:     { name: string } | null
}

const STATUS_CONFIG: Record<string, { variant: 'gray'|'navy'|'green'|'maroon'|'red'|'gold'; label: string }> = {
  draft:               { variant: 'gray',   label: 'Draft' },
  submitted_to_centre: { variant: 'navy',   label: 'Submitted to Centre' },
  centre_approved:     { variant: 'gold',   label: 'Centre Approved' },
  centre_rejected:     { variant: 'red',    label: 'Centre Rejected' },
  submitted:           { variant: 'navy',   label: 'Submitted to HQ' },
  approved:            { variant: 'green',  label: 'Approved' },
  rejected:            { variant: 'red',    label: 'Rejected' },
  issued:              { variant: 'maroon', label: 'Issued' },
}

function getVehicleLabels(vehicleType: string | null) {
  if (vehicleType === 'Train') return { nameLabel: 'Train Name', mobileLabel: 'Train Time', icon: '🚂' }
  return { nameLabel: 'Driver Name', mobileLabel: 'Driver Mobile', icon: '🚌' }
}

export default function NRDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()

  const [nr,          setNR]         = useState<NRDetail | null>(null)
  const [members,     setMembers]    = useState<NRMember[]>([])
  const [sections,    setSections]   = useState<SectionStatus[]>([])
  const [reviews,     setReviews]    = useState<Review[]>([])
  const [loading,     setLoading]    = useState(true)
  const [comment,     setComment]    = useState('')
  const [posting,     setPosting]    = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject,   setShowReject]   = useState(false)
  const [rejectType,   setRejectType]   = useState<'aso'|'centre'>('aso')
  const [acting,       setActing]       = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [activeTab,    setActiveTab]    = useState<'members'|'comments'|'notes'>('members')
  // Notes editing
  const [editingNotes,  setEditingNotes]  = useState<'aso'|'centre'|null>(null)
  const [asoNotesVal,   setAsoNotesVal]   = useState('')
  const [centreNotesVal,setCentreNotesVal] = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)

  const isASO          = user?.role === 'aso'
  const isOwner        = nr && (isASO || user?.centre === nr.centre)
  const isSubContrib   = nr && !isOwner && user?.centre !== nr.centre
  const isParentCentre = !isASO && nr?.is_sub_centre && nr?.parent_centre === user?.centre

  const mySection     = sections.find(s => s.centre === user?.centre)
  const myMemberCount = members.filter(m => m.contributing_centre === user?.centre).length
  const mySrsId       = mySection?.srs_id ?? null

  useEffect(() => { if (id && user) fetchAll() }, [id, user])

  const fetchAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data: nrData, error: nrErr } = await supabase
        .from('v_nr_summary')
        .select('*')
        .eq('id', id)
        .single()

      if (nrErr || !nrData) { console.error('NR fetch:', nrErr); setLoading(false); return }

      // Fetch extra fields not in view
      const { data: extra } = await supabase
        .from('nominal_roles')
        .select('aso_notes, centre_notes')
        .eq('id', id)
        .single()

      const fullNR = { ...nrData, aso_notes: extra?.aso_notes ?? null, centre_notes: extra?.centre_notes ?? null } as NRDetail
      setNR(fullNR)
      setAsoNotesVal(fullNR.aso_notes ?? '')
      setCentreNotesVal(fullNR.centre_notes ?? '')

      const [mRes, rRes, sRes] = await Promise.all([
        supabase.from('nr_members')
          .select('id,serial_no,display_id,name,father_name,gender,age,address,mobile,department,is_jathedar,contributing_centre,member_type,aadhaar_masked')
          .eq('nominal_role_id', id)
          .order('contributing_centre')
          .order('gender')
          .order('name'),
        // FIX: use correct column name + join for author name
        supabase.from('nr_reviews')
          .select('id, author_badge, author_role, comment_text, is_resolved, created_at, sewadars!nr_reviews_author_badge_fkey(name)')
          .eq('nominal_role_id', id)
          .order('created_at'),
        supabase.from('nr_section_status')
          .select('centre, srs_id, is_ready, member_count')
          .eq('nominal_role_id', id)
          .order('centre'),
      ])

      setMembers((mRes.data ?? []) as NRMember[])
      setReviews((rRes.data ?? []) as Review[])
      setSections((sRes.data ?? []) as SectionStatus[])
    } finally {
      setLoading(false)
    }
  }

  // FIX: use correct column name `comment_text`; don't insert non-existent `author_name`
  const postComment = async () => {
    if (!user || !comment.trim() || !id) return
    setPosting(true)
    try {
      const { error } = await supabase.from('nr_reviews').insert({
        nominal_role_id: parseInt(id),
        author_badge:    user.badge_number,
        author_role:     user.role,
        comment_text:    comment.trim(),
      })
      if (error) throw error
      setComment('')
      await fetchAll()
    } catch (err: any) {
      console.error('Post comment error:', err)
    } finally {
      setPosting(false)
    }
  }

  // FIX: log every status action
  const doAction = async (status: string, extra: Record<string,unknown> = {}) => {
    if (!id || !user) return
    setActing(true)
    try {
      const { error } = await supabase
        .from('nominal_roles')
        .update({ status, ...extra })
        .eq('id', id)
      if (error) throw error

      // Audit log
      await supabase.from('logs').insert({
        user_badge: user.badge_number,
        user_role:  user.role,
        action:     `NR_${status.toUpperCase()}`,
        table_name: 'nominal_roles',
        record_id:  id,
        details:    { previous_status: nr?.status, new_status: status, ...extra },
      })

      setShowReject(false)
      setRejectReason('')
      await fetchAll()
    } catch (err: any) {
      console.error('doAction error:', err)
    } finally {
      setActing(false)
    }
  }

  const saveNotes = async (type: 'aso' | 'centre') => {
    if (!id || !user) return
    setSavingNotes(true)
    try {
      const field = type === 'aso' ? 'aso_notes' : 'centre_notes'
      const value = type === 'aso' ? asoNotesVal : centreNotesVal
      await supabase.from('nominal_roles').update({ [field]: value || null }).eq('id', id)
      setNR(prev => prev ? { ...prev, [field]: value || null } : prev)
      setEditingNotes(null)
    } finally {
      setSavingNotes(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!nr || !id) return
    setPdfLoading(true)
    try {
      const centreOrder = contributingCentresForPDF()
      const sectionData = centreOrder.map(centre => {
        const sec = sections.find(s => s.centre === centre)
        const centreMembers = members
          .filter(m => m.contributing_centre === centre)
          .sort((a, b) => {
            if (a.is_jathedar) return -1
            if (b.is_jathedar) return 1
            if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        return {
          centre,
          srs_id:   sec?.srs_id ?? null,
          is_ready: sec?.is_ready ?? false,
          members:  centreMembers.map((m, idx) => ({
            serial_no:           idx + 1,
            display_id:          m.display_id,
            name:                m.name,
            father_name:         m.father_name,
            gender:              m.gender,
            age:                 m.age,
            address:             m.address,
            mobile:              m.mobile,
            is_jathedar:         m.is_jathedar,
            contributing_centre: m.contributing_centre,
            member_type:         m.member_type,
            aadhaar_masked:      m.aadhaar_masked,
          })),
        }
      })

      const jathedarMember = members.find(m => m.is_jathedar) ?? null

      await generateNRPDF({
        nr: {
          id:            nr.id,
          centre:        nr.centre,
          jatha_name:    nr.jatha_name,
          destination:   nr.destination,
          department:    nr.department,
          from_date:     nr.from_date,
          to_date:       nr.to_date,
          jathedar_name: nr.jathedar_name,
          jathedar_phone: nr.jathedar_phone,
          vehicle_type:  nr.vehicle_type,
          driver_name:   nr.driver_name,
          driver_mobile: nr.driver_mobile,
          member_count:  nr.member_count,
          male_count:    nr.male_count,
          female_count:  nr.female_count,
        },
        sections: sectionData,
        jathedar: jathedarMember ? {
          serial_no:           0,
          display_id:          jathedarMember.display_id,
          name:                jathedarMember.name,
          father_name:         jathedarMember.father_name,
          gender:              jathedarMember.gender,
          age:                 jathedarMember.age,
          address:             jathedarMember.address,
          mobile:              jathedarMember.mobile,
          is_jathedar:         true,
          contributing_centre: jathedarMember.contributing_centre,
          member_type:         jathedarMember.member_type,
          aadhaar_masked:      jathedarMember.aadhaar_masked,
        } : null,
      })
    } catch (err: any) {
      console.error('PDF error:', err)
      alert('PDF generation failed: ' + (err.message ?? 'Unknown error'))
    } finally {
      setPdfLoading(false)
    }
  }

  const contributingCentresForPDF = () =>
    Array.from(new Set(members.map(m => m.contributing_centre)))
      .sort((a, b) => {
        if (a === nr!.centre) return -1
        if (b === nr!.centre) return 1
        return a.localeCompare(b)
      })

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      {[...Array(3)].map((_,i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!nr) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <p className="text-slate-400">NR not found</p>
      <Link to="/nominal-roles" className="text-maroon-600 text-sm mt-2 inline-block">← Back</Link>
    </div>
  )

  const cfg           = STATUS_CONFIG[nr.status] ?? STATUS_CONFIG.draft
  const vehicleLabels = getVehicleLabels(nr.vehicle_type)
  const contributingCentres = contributingCentresForPDF()

  const canEdit = isASO
    ? !['issued'].includes(nr.status)
    : ['draft', 'centre_rejected', 'rejected'].includes(nr.status)

  const showASOActions    = isASO && nr.status === 'submitted'
  const showASOIssue      = isASO && nr.status === 'approved'
  const showCentreActions = isParentCentre && nr.status === 'submitted_to_centre'

  const hasNotes = (nr.aso_notes && nr.aso_notes.trim()) || (nr.centre_notes && nr.centre_notes.trim())

  return (
    <div className="max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/nominal-roles" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800 truncate">{nr.jatha_name ?? 'Nominal Role'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400">{nr.centre}</p>
            {isSubContrib && <Badge variant="navy" className="text-[9px]">Contributing: {user?.centre}</Badge>}
          </div>
        </div>
        <Badge variant={cfg.variant} className="text-[10px] flex-shrink-0">{cfg.label}</Badge>
      </div>

      {/* Sub-centre contribution banner */}
      {isSubContrib && nr.status === 'draft' && (
        <div className="bg-navy-50 border border-navy-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={14} className="text-navy-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-navy-700">{user?.centre} — Your Section</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-navy-500">
                {myMemberCount} member{myMemberCount !== 1 ? 's' : ''} added
                {mySrsId && ` · SRS: ${mySrsId}`}
              </p>
              {mySection?.is_ready
                ? <Badge variant="green" className="text-[9px]">✓ Marked Ready</Badge>
                : <Badge variant="gray" className="text-[9px]">Not yet ready</Badge>
              }
            </div>
          </div>
        </div>
      )}

      {/* NR Header info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Destination</p>
            <p className="font-medium text-slate-800">{nr.destination}</p>
            <p className="text-[10px] text-slate-500">{nr.department}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Dates</p>
            <p className="font-medium text-slate-800">
              {nr.from_date && new Date(nr.from_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              {' – '}
              {nr.to_date && new Date(nr.to_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Members</p>
            <p className="font-semibold text-slate-800">{nr.member_count}</p>
            <p className="text-[10px] text-slate-500">M:{nr.male_count} F:{nr.female_count}</p>
          </div>
          {nr.quota > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Quota</p>
              <p className={`font-semibold ${
                nr.member_count > nr.quota ? 'text-red-600' :
                nr.member_count === nr.quota ? 'text-green-600' : 'text-slate-700'
              }`}>{nr.member_count}/{nr.quota}</p>
            </div>
          )}
        </div>

        {nr.jathedar_name && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-center gap-2">
            <Star size={14} className="text-amber-500 fill-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-800">{nr.jathedar_name}</p>
              {nr.jathedar_phone && <p className="text-[10px] text-slate-500">{nr.jathedar_phone}</p>}
            </div>
          </div>
        )}

        {nr.vehicle_type && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Transport</p>
            <div className="flex gap-4 text-xs text-slate-600 flex-wrap">
              <span>{vehicleLabels.icon} {nr.vehicle_type}</span>
              {nr.driver_name && <span>{vehicleLabels.nameLabel}: <strong>{nr.driver_name}</strong></span>}
              {nr.driver_mobile && <span>{vehicleLabels.mobileLabel}: <strong>{nr.driver_mobile}</strong></span>}
            </div>
          </div>
        )}

        {nr.status === 'rejected' && nr.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Rejected by HQ</p>
            <p className="text-sm text-red-700">{nr.rejection_reason}</p>
          </div>
        )}
        {nr.status === 'centre_rejected' && nr.centre_rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Rejected by Centre</p>
            <p className="text-sm text-red-700">{nr.centre_rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Section status */}
      {(isOwner || isASO) && sections.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              Section Status
              <span className="text-slate-400 font-normal ml-1 text-xs">
                ({sections.filter(s => s.is_ready).length}/{sections.length} ready)
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {sections.map(s => (
              <div key={s.centre} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-700">{s.centre}</p>
                    {s.centre === nr.centre && <Badge variant="maroon" className="text-[9px]">Owner</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {s.member_count} members
                    {s.srs_id ? ` · SRS: ${s.srs_id}` : ' · No SRS ID yet'}
                  </p>
                </div>
                {(s.is_ready || nr.status !== 'draft')
                  ? <Badge variant="green" className="text-[9px]">✓ Ready</Badge>
                  : <Badge variant="gray" className="text-[9px]">Pending</Badge>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {showCentreActions && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => doAction('centre_approved', { centre_approved_at: new Date().toISOString() })}
            disabled={acting}
            className="py-3 bg-green-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <ThumbsUp size={15} /> Approve
          </button>
          <button onClick={() => { setRejectType('centre'); setShowReject(true) }}
            disabled={acting}
            className="py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <ThumbsDown size={15} /> Reject
          </button>
        </div>
      )}

      {showASOActions && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => doAction('approved', { approved_at: new Date().toISOString(), approved_by: user?.badge_number })}
            disabled={acting}
            className="py-3 bg-green-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle size={15} /> Approve
          </button>
          <button onClick={() => { setRejectType('aso'); setShowReject(true) }}
            disabled={acting}
            className="py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <XCircle size={15} /> Reject
          </button>
        </div>
      )}

      {showASOIssue && (
        <button onClick={() => doAction('issued', { issued_at: new Date().toISOString() })}
          disabled={acting}
          className="w-full py-3 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
          <Award size={15} /> Issue NR
        </button>
      )}

      {canEdit && (
        <Link to={`/nominal-roles/${nr.id}/edit`}>
          <button className="w-full py-3 border border-maroon-200 text-maroon-700 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation flex items-center justify-center gap-2">
            <Edit2 size={14} />
            {isSubContrib ? `Add / Edit My Members (${user?.centre})` :
             isASO ? 'Edit NR (ASO)' : 'Edit NR'}
          </button>
        </Link>
      )}

      {(isOwner || isASO) && members.length > 0 && (
        <button onClick={handleDownloadPDF} disabled={pdfLoading}
          className="w-full py-3 bg-navy-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
          {pdfLoading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating PDF...</>
            : <><Download size={15} /> Download NR (PDF)</>
          }
        </button>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {[
          { key: 'members',  label: `Members (${members.length})` },
          { key: 'comments', label: `Comments (${reviews.length})` },
          { key: 'notes',    label: `Notes${hasNotes ? ' ●' : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={['flex-1 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation',
              activeTab === t.key ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500'].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-10 text-center">
              <p className="text-sm text-slate-400">No members added yet</p>
              {canEdit && (
                <Link to={`/nominal-roles/${nr.id}/edit`}>
                  <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                    {isSubContrib ? 'Add My Members' : 'Add Members'}
                  </button>
                </Link>
              )}
            </div>
          ) : (
            contributingCentres.map(centre => {
              const centreMembers = members
                .filter(m => m.contributing_centre === centre)
                .sort((a,b) => {
                  if (a.is_jathedar) return -1
                  if (b.is_jathedar) return 1
                  if (a.gender !== b.gender) return a.gender === 'M' ? -1 : 1
                  return a.name.localeCompare(b.name)
                })
              const sec        = sections.find(s => s.centre === centre)
              const isMyCentre = centre === user?.centre
              const maleC      = centreMembers.filter(m => m.gender === 'M').length
              const femaleC    = centreMembers.filter(m => m.gender === 'F').length

              return (
                <div key={centre} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center justify-between ${
                    centre === nr.centre ? 'bg-maroon-50' : isMyCentre ? 'bg-navy-50' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{centre}</span>
                      {centre === nr.centre && <Badge variant="maroon" className="text-[9px]">Owner</Badge>}
                      {isMyCentre && !isOwner && <Badge variant="navy" className="text-[9px]">My Centre</Badge>}
                      {sec?.srs_id ? (
                        <span className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-[10px] font-mono font-semibold text-slate-700">
                          SRS: {sec.srs_id}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-600">
                          SRS not set
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-shrink-0">
                      <span>M:{maleC} F:{femaleC}</span>
                      {(sec?.is_ready || nr.status !== 'draft')
                        ? <Badge variant="green" className="text-[9px]">✓ Ready</Badge>
                        : <Badge variant="gray" className="text-[9px]">Pending</Badge>
                      }
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className="px-3 py-2 text-left font-medium w-10">S.No</th>
                          <th className="px-3 py-2 text-left font-medium">Badge / Aadhaar</th>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Address</th>
                          <th className="px-3 py-2 text-center font-medium">Mobile</th>
                          <th className="px-3 py-2 text-center font-medium w-12">M/F</th>
                          <th className="px-3 py-2 text-center font-medium w-12">Age</th>
                          <th className="px-3 py-2 text-center font-medium">SRS ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {centreMembers.map((m, idx) => (
                          <tr key={m.id} className={
                            m.is_jathedar ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }>
                            <td className="px-3 py-2 text-slate-400 text-center">
                              {m.is_jathedar ? '★' : idx + 1}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">
                              {/* Show masked aadhaar for sangat, badge for sewadars */}
                              {m.member_type === 'sangat' && m.aadhaar_masked
                                ? m.aadhaar_masked
                                : m.display_id
                              }
                              {m.member_type === 'sangat' && (
                                <span className="block text-[9px] text-navy-500 font-sans">Sangat</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-800">{m.name}</p>
                              {m.father_name && <p className="text-[10px] text-slate-400">S/o {m.father_name}</p>}
                              {m.is_jathedar && <span className="text-[9px] text-amber-600 font-semibold">★ Jathedar</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 hidden sm:table-cell max-w-[180px]">
                              <p className="truncate">{m.address ?? '—'}</p>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600 font-mono">{m.mobile ?? '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px]">
                                {m.gender}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">{m.age ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-mono text-[10px] text-slate-500">
                              {sec?.srs_id ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100">
                          <td colSpan={2} className="px-3 py-1.5 text-[10px] text-slate-500 font-medium">
                            {centreMembers.length} members
                          </td>
                          <td colSpan={5} className="px-3 py-1.5 text-[10px] text-slate-500 text-right">
                            Male: {maleC} · Female: {femaleC}
                          </td>
                          <td className="px-3 py-1.5 text-[10px] font-mono text-center text-slate-500">
                            {sec?.srs_id ?? '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })
          )}

          {members.length > 0 && (
            <div className="bg-slate-700 text-white rounded-xl px-4 py-3 flex justify-between text-sm font-semibold">
              <span>Grand Total: {members.length} Members</span>
              <span>M:{nr.male_count} · F:{nr.female_count}</span>
            </div>
          )}
        </div>
      )}

      {/* Comments tab */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {reviews.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No comments yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {reviews.map(r => (
                  <div key={r.id} className={`px-4 py-3 ${r.author_role === 'aso' ? 'bg-navy-50/30' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {/* FIX: use joined name from sewadars */}
                      <span className="text-xs font-semibold text-slate-700">
                        {r.sewadars?.name ?? r.author_badge}
                      </span>
                      <Badge variant={r.author_role === 'aso' ? 'navy' : 'gray'} className="text-[9px]">
                        {r.author_role === 'aso' ? 'ASO/HQ' : 'Centre Admin'}
                      </Badge>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        {' '}
                        {new Date(r.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    {/* FIX: use comment_text not comment */}
                    <p className="text-sm text-slate-700">{r.comment_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex gap-2">
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..." rows={2}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-400 resize-none" />
            <button onClick={postComment} disabled={posting || !comment.trim()}
              className="px-3 py-2 bg-maroon-600 text-white rounded-lg self-end active:scale-95 touch-manipulation disabled:opacity-50">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {/* ASO Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">HQ / ASO Notes</h3>
              {isASO && editingNotes !== 'aso' && (
                <button onClick={() => setEditingNotes('aso')}
                  className="text-xs text-maroon-600 underline touch-manipulation">
                  {nr.aso_notes ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editingNotes === 'aso' ? (
              <div className="space-y-2">
                <textarea value={asoNotesVal} onChange={e => setAsoNotesVal(e.target.value)}
                  rows={3} placeholder="Internal notes for ASO team..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setEditingNotes(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 touch-manipulation">
                    Cancel
                  </button>
                  <button onClick={() => saveNotes('aso')} disabled={savingNotes}
                    className="flex-1 py-2 bg-maroon-600 text-white rounded-lg text-xs font-semibold touch-manipulation disabled:opacity-50">
                    {savingNotes ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {nr.aso_notes || <span className="text-slate-400 italic">No notes</span>}
              </p>
            )}
          </div>

          {/* Centre Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{nr.centre} — Centre Notes</h3>
              {isOwner && !isASO && editingNotes !== 'centre' && (
                <button onClick={() => setEditingNotes('centre')}
                  className="text-xs text-maroon-600 underline touch-manipulation">
                  {nr.centre_notes ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editingNotes === 'centre' ? (
              <div className="space-y-2">
                <textarea value={centreNotesVal} onChange={e => setCentreNotesVal(e.target.value)}
                  rows={3} placeholder="Notes for your centre..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setEditingNotes(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 touch-manipulation">
                    Cancel
                  </button>
                  <button onClick={() => saveNotes('centre')} disabled={savingNotes}
                    className="flex-1 py-2 bg-navy-600 text-white rounded-lg text-xs font-semibold touch-manipulation disabled:opacity-50">
                    {savingNotes ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {nr.centre_notes || <span className="text-slate-400 italic">No notes</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center mb-3">
              {rejectType === 'centre' ? `Reject at Centre` : 'Reject NR (ASO/HQ)'}
            </h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..." rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-400 resize-none mb-4" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setShowReject(false); setRejectReason('') }}
                className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm touch-manipulation">
                Cancel
              </button>
              <button
                onClick={() => rejectType === 'centre'
                  ? doAction('centre_rejected', {
                      centre_rejected_at: new Date().toISOString(),
                      centre_rejection_reason: rejectReason,
                    })
                  : doAction('rejected', {
                      rejected_at: new Date().toISOString(),
                      rejection_reason: rejectReason,
                    })
                }
                disabled={!rejectReason.trim() || acting}
                className="py-3 rounded-xl bg-red-600 text-white font-semibold text-sm touch-manipulation disabled:opacity-50">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pb-4" />
    </div>
  )
}