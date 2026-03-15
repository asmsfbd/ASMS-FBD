import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Edit2, Trash2, User, Phone, MapPin, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface SangatRecord {
  id:           number
  sangat_id:    string
  aadhaar_last4: string
  name:         string
  father_name:  string | null
  gender:       string
  age:          number | null
  mobile:       string | null
  address:      string | null
  centre:       string
  is_active:    boolean
  created_at:   string
  created_by:   string | null
}

interface NRParticipation {
  id:          number
  jatha_name:  string
  destination: string
  department:  string
  from_date:   string
  to_date:     string
  nr_status:   string
}

export default function SangatProfilePage() {
  const { id }       = useParams<{ id: string }>()
  const { user }     = useAuth()
  const navigate     = useNavigate()

  const [sangat,     setSangat]     = useState<SangatRecord | null>(null)
  const [nrs,        setNRs]        = useState<NRParticipation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isASO         = user?.role === 'aso'
  const isCentreAdmin = user?.role === 'centre_admin'
  const canEdit       = isASO || (isCentreAdmin && sangat?.centre === user?.centre)
  const canDelete     = isCentreAdmin && sangat?.centre === user?.centre || isASO

  useEffect(() => { if (id) fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [swRes, nrRes] = await Promise.all([
        supabase.from('sangat').select('*').eq('id', id).single(),
        supabase.from('nr_members')
          .select(`
            id,
            nominal_roles!nr_members_nominal_role_id_fkey (
              jatha_name, status,
              jatha_schedule!nominal_roles_jatha_schedule_id_fkey (
                destination, department, from_date, to_date
              )
            )
          `)
          .eq('sangat_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setSangat(swRes.data as SangatRecord | null)

      const nrData = (nrRes.data ?? []).map((m: any) => {
        const nr = m.nominal_roles
        const js = nr?.jatha_schedule
        return {
          id:          m.id,
          jatha_name:  nr?.jatha_name ?? '—',
          destination: js?.destination ?? '—',
          department:  js?.department ?? '—',
          from_date:   js?.from_date ?? '—',
          to_date:     js?.to_date ?? '—',
          nr_status:   nr?.status ?? '—',
        }
      })
      setNRs(nrData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!sangat || !user) return
    setDeleting(true)
    try {
      await supabase.from('sangat').delete().eq('id', sangat.id)

      // Log the deletion
      await supabase.from('logs').insert({
        user_badge: user.badge_number,
        user_role:  user.role,
        action:     'DELETE',
        table_name: 'sangat',
        record_id:  String(sangat.id),
        details: {
          deleted_name:   sangat.name,
          deleted_id:     sangat.sangat_id,
          aadhaar_last4:  sangat.aadhaar_last4,
          centre:         sangat.centre,
        },
      })

      navigate('/sangat')
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-1/3" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!sangat) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-slate-400">Sangat record not found</p>
        <Link to="/sangat" className="text-maroon-600 text-sm mt-2 inline-block">← Back to list</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/sangat" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Sangat Profile</h1>
            <p className="text-xs text-slate-400">संगत प्रोफाइल</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link to={`/sangat/${sangat.id}/edit`}>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-navy-50 text-navy-700 border border-navy-200 rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation">
                <Edit2 size={12} /> Edit
              </button>
            </Link>
            {canDelete && (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
            <User size={22} className="text-navy-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{sangat.name}</h2>
            <p className="text-sm text-slate-500">S/O {sangat.father_name ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={sangat.gender === 'M' ? 'navy' : 'maroon'} className="text-[10px]">
                {sangat.gender === 'M' ? 'Male' : 'Female'}
              </Badge>
              {sangat.age && (
                <span className="text-xs text-slate-400">Age {sangat.age}</span>
              )}
              <Badge variant="gray" className="text-[10px]">Sangat</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 py-2 border-b border-slate-50">
            <span className="text-[10px] font-mono bg-navy-50 text-navy-700 px-2 py-1 rounded font-bold">
              {sangat.sangat_id}
            </span>
            <span className="text-xs text-slate-400">System ID</span>
          </div>

          <div className="flex items-center gap-3 py-2 border-b border-slate-50">
            <span className="w-5 text-center text-slate-400 font-mono text-xs">ID</span>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Aadhaar</p>
              <p className="font-mono text-slate-700">XXXXXXXX{sangat.aadhaar_last4}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2 border-b border-slate-50">
            <User size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Centre</p>
              <p className="text-slate-800">{sangat.centre}</p>
            </div>
          </div>

          {sangat.mobile && (
            <div className="flex items-center gap-3 py-2 border-b border-slate-50">
              <Phone size={15} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Mobile</p>
                <a href={`tel:${sangat.mobile}`} className="text-maroon-600 font-medium">{sangat.mobile}</a>
              </div>
            </div>
          )}

          {sangat.address && (
            <div className="flex items-start gap-3 py-2">
              <MapPin size={15} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-slate-600 text-xs leading-relaxed">{sangat.address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Jatha history */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText size={14} className="text-maroon-500" />
          <h3 className="text-sm font-semibold text-slate-700">NR Participations</h3>
          <span className="text-xs text-slate-400 ml-auto">{nrs.length} records</span>
        </div>
        {nrs.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Not yet added to any NR</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {nrs.map(j => (
              <div key={j.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{j.jatha_name}</p>
                    <p className="text-xs text-slate-500">{j.destination} · {j.department}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{j.from_date} – {j.to_date}</p>
                  </div>
                  <Badge
                    variant={j.nr_status === 'issued' ? 'maroon' : j.nr_status === 'approved' ? 'green' : 'gray'}
                    className="text-[9px] flex-shrink-0"
                  >
                    {j.nr_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit info */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-[10px] text-slate-400">
          Created on {new Date(sangat.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {sangat.created_by && ` · by ${sangat.created_by}`}
        </p>
      </div>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center mb-1">Delete Sangat Record?</h3>
            <p className="text-sm text-slate-500 text-center mb-1">{sangat.name}</p>
            <p className="text-xs text-slate-400 text-center mb-5">
              This will permanently delete the record and log the action. Cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:scale-95 transition-transform touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:scale-95 transition-transform touch-manipulation disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
