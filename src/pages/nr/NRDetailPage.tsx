import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle, XCircle, Edit2,
  MessageSquare, Send, Download, FileText, AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'
import { generateNRPDF } from '@/lib/nrPDF'

interface NRDetail {
  id:              number
  centre:          string
  status:          string
  srs_id:          string | null
  jatha_name:      string | null
  schedule_dates:  string | null
  destination:     string | null
  department:      string | null
  from_date:       string | null
  to_date:         string | null
  quota:           number
  member_count:    number
  male_count:      number
  female_count:    number
  jathedar_name:   string | null
  jathedar_phone:  string | null
  vehicle_type:    string | null
  driver_name:     string | null
  driver_mobile:   string | null
  rejection_reason: string | null
  aso_notes:       string | null
  submitted_at:    string | null
  approved_at:     string | null
  sewa_schedule_id: number | null
}

interface NRMember {
  id:          number
  serial_no:   number
  display_id:  string
  name:        string
  father_name: string | null
  gender:      string
  age:         number | null
  address:     string | null
  mobile:      string | null
  department:  string | null
  is_jathedar: boolean
  member_type: string
}

interface Review {
  id:           number
  author_badge: string
  author_role:  string
  author_name:  string
  comment:      string
  created_at:   string
}

const statusConfig: Record<string, { variant: 'gray' | 'navy' | 'green' | 'maroon' | 'red'; label: string }> = {
  draft:     { variant: 'gray',   label: 'Draft' },
  submitted: { variant: 'navy',   label: 'Submitted to HQ' },
  approved:  { variant: 'green',  label: 'Approved' },
  issued:    { variant: 'maroon', label: 'Issued' },
  rejected:  { variant: 'red',    label: 'Rejected' },
}

export default function NRDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const { user }     = useAuth()
  const navigate     = useNavigate()

  const [nr,          setNR]          = useState<NRDetail | null>(null)
  const [members,     setMembers]     = useState<NRMember[]>([])
  const [reviews,     setReviews]     = useState<Review[]>([])
  const [loading,     setLoading]     = useState(true)
  const [comment,     setComment]     = useState('')
  const [posting,     setPosting]     = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject,  setShowReject]  = useState(false)
  const [acting,      setActing]      = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [activeTab,   setActiveTab]   = useState<'members' | 'comments'>('members')
  const commentRef    = useRef<HTMLTextAreaElement>(null)

  const isASO = user?.role === 'aso'

  useEffect(() => { if (id && user) fetchAll() }, [id, user])

  const fetchAll = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [nrRes, membersRes, reviewsRes] = await Promise.all([
        supabase.from('v_nr_summary').select('*, vehicle_type, driver_name, driver_mobile, rejection_reason, aso_notes').eq('id', id).single(),
        supabase.from('nr_members').select('*').eq('nominal_role_id', id).order('is_jathedar', { ascending: false }).order('gender').order('name'),
        supabase.from('nr_reviews').select('*').eq('nominal_role_id', id).order('created_at'),
      ])
      setNR(nrRes.data as unknown as NRDetail)
      setMembers((membersRes.data ?? []) as NRMember[])
      setReviews((reviewsRes.data ?? []) as Review[])
    } finally { setLoading(false) }
  }

  const postComment = async () => {
    if (!user || !comment.trim() || !id) return
    setPosting(true)
    try {
      await supabase.from('nr_reviews').insert({
        nominal_role_id: parseInt(id),
        author_badge:    user.badge_number,
        author_role:     user.role,
        author_name:     user.name,
        comment:         comment.trim(),
      })
      setComment('')
      await fetchAll()
    } finally { setPosting(false) }
  }

  const approve = async () => {
    if (!id || !user) return
    setActing(true)
    try {
      await supabase.from('nominal_roles').update({
        status:      'approved',
        approved_at: new Date().toISOString(),
        aso_notes:   null,
        rejection_reason: null,
      }).eq('id', id)
      await fetchAll()
    } finally { setActing(false) }
  }

  const reject = async () => {
    if (!id || !rejectReason.trim()) return
    setActing(true)
    try {
      await supabase.from('nominal_roles').update({
        status:           'rejected',
        rejected_at:      new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      }).eq('id', id)
      setShowReject(false)
      setRejectReason('')
      await fetchAll()
    } finally { setActing(false) }
  }

  const issueNR = async () => {
    if (!id) return
    setActing(true)
    try {
      await supabase.from('nominal_roles').update({
        status:    'issued',
        issued_at: new Date().toISOString(),
      }).eq('id', id)
      await fetchAll()
    } finally { setActing(false) }
  }

  const downloadPDF = async () => {
    if (!nr || !id) return
    setGenerating(true)
    try {
      await generateNRPDF({
        nr,
        members,
        centreName: nr.centre,
        isConsolidated: false,
      })
    } finally { setGenerating(false) }
  }

  if (loading || !nr) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const cfg = statusConfig[nr.status] ?? statusConfig.draft
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
          <h1 className="text-base font-semibold text-slate-800 truncate">
            {nr.jatha_name ?? 'Nominal Role'}
          </h1>
          <p className="text-xs text-slate-400">{nr.centre}</p>
        </div>
        <Badge variant={cfg.variant} className="text-[10px] flex-shrink-0">{cfg.label}</Badge>
      </div>

      {/* NR Info card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Destination</p>
            <p className="font-medium text-slate-800">{nr.destination} · {nr.department}</p>
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
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">SRS ID</p>
            <p className="font-mono font-medium text-slate-800">{nr.srs_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Members</p>
            <p className="font-medium text-slate-800">{nr.member_count} · M:{maleCount} F:{femaleCount}</p>
          </div>
        </div>

        {/* Jathedar */}
        {nr.jathedar_name && (
          <div className="bg-maroon-50 border border-maroon-100 rounded-lg p-3">
            <p className="text-[10px] text-maroon-500 uppercase tracking-wide font-semibold mb-1">Jathedar</p>
            <p className="text-sm font-semibold text-maroon-800">{nr.jathedar_name}</p>
            {nr.jathedar_phone && <p className="text-xs text-maroon-600">{nr.jathedar_phone}</p>}
          </div>
        )}

        {/* Vehicle */}
        {(nr.vehicle_type || nr.driver_name) && (
          <div className="text-xs text-slate-500 flex gap-4">
            {nr.vehicle_type && <span>🚌 {nr.vehicle_type}</span>}
            {nr.driver_name  && <span>Driver: {nr.driver_name}</span>}
            {(nr as any).driver_mobile && <span>{(nr as any).driver_mobile}</span>}
          </div>
        )}

        {/* Rejection reason */}
        {nr.status === 'rejected' && nr.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Rejection Reason</p>
            <p className="text-sm text-red-700">{nr.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* ASO action buttons */}
      {isASO && nr.status === 'submitted' && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={approve} disabled={acting}
            className="py-3 bg-green-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle size={15} /> Approve
          </button>
          <button onClick={() => setShowReject(true)} disabled={acting}
            className="py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
            <XCircle size={15} /> Reject
          </button>
        </div>
      )}

      {isASO && nr.status === 'approved' && (
        <button onClick={issueNR} disabled={acting}
          className="w-full py-3 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
          <FileText size={15} /> Issue NR
        </button>
      )}

      {/* Edit button */}
      {(nr.status === 'draft' || isASO) && (
        <Link to={`/nominal-roles/${nr.id}/edit`}>
          <button className="w-full py-3 border border-maroon-200 text-maroon-700 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation flex items-center justify-center gap-2">
            <Edit2 size={14} /> Edit NR
          </button>
        </Link>
      )}

      {/* PDF download */}
      {(nr.status === 'approved' || nr.status === 'issued') && (
        <button onClick={downloadPDF} disabled={generating}
          className="w-full py-3 border border-green-200 text-green-700 bg-green-50 rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
          <Download size={15} /> {generating ? 'Generating PDF...' : 'Download NR PDF'}
        </button>
      )}

      {/* Tabs: members | comments */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {[
          { key: 'members',  label: `Members (${members.length})` },
          { key: 'comments', label: `Comments (${reviews.length})` },
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-50">
            {members.map((m, idx) => (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${m.is_jathedar ? 'bg-maroon-50/40' : ''}`}>
                <span className="text-[10px] text-slate-300 w-6 text-right flex-shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    <Badge variant={m.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">{m.gender}</Badge>
                    {m.is_jathedar && <Badge variant="gold" className="text-[9px] flex-shrink-0">Jathedar</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{m.display_id}</p>
                  <p className="text-[10px] text-slate-400">{m.father_name ?? '—'} · Age {m.age ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
          {members.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">No members</div>
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
                      <span className="text-xs font-semibold text-slate-700">{r.author_name}</span>
                      <Badge variant={r.author_role === 'aso' ? 'navy' : 'gray'} className="text-[9px]">
                        {r.author_role === 'aso' ? 'ASO/HQ' : 'Centre Admin'}
                      </Badge>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        {' '}
                        {new Date(r.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add comment */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex gap-2">
            <textarea
              ref={commentRef}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-400 resize-none"
            />
            <button onClick={postComment} disabled={posting || !comment.trim()}
              className="px-3 py-2 bg-maroon-600 text-white rounded-lg self-end active:scale-95 touch-manipulation disabled:opacity-50">
              <Send size={14} />
            </button>
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
            <h3 className="text-base font-bold text-slate-800 text-center mb-3">Reject NR</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-400 resize-none mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setShowReject(false); setRejectReason('') }}
                className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm touch-manipulation">
                Cancel
              </button>
              <button onClick={reject} disabled={!rejectReason.trim() || acting}
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
