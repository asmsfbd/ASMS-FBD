import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface SangatForm {
  name:          string
  father_name:   string
  gender:        string
  age:           string
  mobile:        string
  address:       string
  aadhaar:       string
  aadhaar_last4: string
  centre:        string
}

const EMPTY_FORM: SangatForm = {
  name: '', father_name: '', gender: 'M', age: '',
  mobile: '', address: '', aadhaar: '', aadhaar_last4: '', centre: '',
}

export default function SangatFormPage() {
  const { id }       = useParams<{ id: string }>()
  const isEdit       = !!id && id !== 'new'
  const { user }     = useAuth()
  const navigate     = useNavigate()

  const [form,        setForm]        = useState<SangatForm>(EMPTY_FORM)
  const [loading,     setLoading]     = useState(isEdit)
  const [notFound,    setNotFound]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [dupCheck,    setDupCheck]    = useState<{ found: boolean; name?: string; id?: string } | null>(null)
  const [checkingDup, setCheckingDup] = useState(false)
  const [centres,     setCentres]     = useState<string[]>([])

  useEffect(() => {
    supabase.from('centres').select('centre_name').eq('is_active', true).order('centre_name')
      .then(({ data }) => { if (data) setCentres(data.map(c => c.centre_name)) })

    if (!isEdit && user?.role !== 'aso') {
      setForm(f => ({ ...f, centre: user?.centre ?? '' }))
    }

    if (isEdit && id) {
      supabase.from('sangat').select('*').eq('id', id).single()
        .then(({ data, error }) => {
          if (error || !data) {
            setNotFound(true)
            setLoading(false)
            return
          }
          setForm({
            name:          data.name,
            father_name:   data.father_name ?? '',
            gender:        data.gender,
            age:           data.age?.toString() ?? '',
            mobile:        data.mobile ?? '',
            address:       data.address ?? '',
            aadhaar:       '',
            aadhaar_last4: data.aadhaar_last4,
            centre:        data.centre,
          })
          setLoading(false)
        })
    }
  }, [id, isEdit, user])

  const handleChange = (key: keyof SangatForm, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    if (key === 'aadhaar') setDupCheck(null)
    setError('')
  }

  const checkAadhaar = async () => {
    if (form.aadhaar.length !== 12) return
    setCheckingDup(true)
    try {
      const last4 = form.aadhaar.slice(-4)
      const { data } = await supabase
        .from('sangat')
        .select('id, name, aadhaar_last4')
        .eq('aadhaar_last4', last4)
        .limit(1)
        .maybeSingle()
      setDupCheck(data
        ? { found: true, name: data.name, id: String(data.id) }
        : { found: false }
      )
    } finally {
      setCheckingDup(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')

    if (!form.name.trim())   { setError('Name is required'); return }
    if (!form.centre)        { setError('Centre is required'); return }
    if (!isEdit && form.aadhaar.length !== 12) {
      setError('Enter full 12-digit Aadhaar number'); return
    }
    if (!isEdit && dupCheck?.found) {
      setError('This Aadhaar is already registered.'); return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name:        form.name.trim(),
        father_name: form.father_name.trim() || null,
        gender:      form.gender,
        age:         form.age ? parseInt(form.age) : null,
        mobile:      form.mobile.trim() || null,
        address:     form.address.trim() || null,
        centre:      form.centre,
      }

      if (!isEdit) {
        payload.aadhaar_last4 = form.aadhaar.slice(-4)

        // Try to encrypt full Aadhaar using DB function
        // If the function doesn't exist or fails, store null (column is nullable)
        try {
          const { data: encData } = await supabase
            .rpc('encrypt_aadhaar', { aadhaar: form.aadhaar })
          payload.aadhaar_enc = encData ?? null
        } catch {
          payload.aadhaar_enc = null
        }
      }

      if (isEdit && id) {
        const { error: updateErr } = await supabase
          .from('sangat').update(payload).eq('id', id)
        if (updateErr) throw updateErr

        await supabase.from('logs').insert({
          user_badge: user.badge_number,
          user_role:  user.role,
          action:     'UPDATE',
          table_name: 'sangat',
          record_id:  id,
          details:    { changes: payload, edited_name: form.name },
        })
      } else {
        const { data: newSangat, error: insertErr } = await supabase
          .from('sangat')
          .insert({ ...payload, created_by: user.badge_number })
          .select('id, sangat_id')
          .single()
        if (insertErr) throw insertErr

        await supabase.from('logs').insert({
          user_badge: user.badge_number,
          user_role:  user.role,
          action:     'INSERT',
          table_name: 'sangat',
          record_id:  String(newSangat.id),
          details:    { sangat_id: newSangat.sangat_id, name: form.name, centre: form.centre },
        })
      }

      navigate('/sangat')
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-1/2" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/sangat" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
            <ChevronLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold text-slate-800">Sangat Not Found</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-600 text-sm">The requested sangat record was not found.</p>
          <Link to="/sangat" className="text-maroon-600 text-sm mt-2 inline-block">← Back to Sangat List</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Back */}
      <div className="flex items-center gap-2">
        <Link to="/sangat" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Edit Sangat' : 'Add New Sangat'}
          </h1>
          <p className="text-xs text-slate-400">{isEdit ? 'संगत अपडेट करें' : 'नया संगत जोड़ें'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Aadhaar — new only */}
        {!isEdit && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              Aadhaar Number (आधार संख्या) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              value={form.aadhaar}
              onChange={e => handleChange('aadhaar', e.target.value.replace(/\D/g, ''))}
              onBlur={checkAadhaar}
              placeholder="Enter 12-digit Aadhaar"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:border-maroon-400"
            />
            <p className="text-[10px] text-slate-400 mt-1">Only last 4 digits shown on NR prints</p>

            {checkingDup && <p className="text-xs text-slate-400 mt-2">Checking duplicates...</p>}

            {dupCheck?.found && (
              <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-700">Possible duplicate</p>
                  <p className="text-[10px] text-amber-600">{dupCheck.name} already has matching Aadhaar last 4</p>
                  <Link to={`/sangat/${dupCheck.id}`} className="text-[10px] text-maroon-600 font-medium underline">
                    View existing →
                  </Link>
                </div>
              </div>
            )}
            {dupCheck?.found === false && form.aadhaar.length === 12 && (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle size={13} className="text-green-500" />
                <p className="text-xs text-green-600">No duplicate found</p>
              </div>
            )}
          </div>
        )}

        {/* Masked Aadhaar on edit */}
        {isEdit && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Aadhaar Number</p>
            <p className="font-mono text-sm text-slate-700">XXXXXXXX{form.aadhaar_last4}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cannot be changed after registration</p>
          </div>
        )}

        {/* Personal details */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Personal Details</p>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Name *</label>
            <input value={form.name} onChange={e => handleChange('name', e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Father / Husband Name</label>
            <input value={form.father_name} onChange={e => handleChange('father_name', e.target.value)}
              placeholder="Father or husband name"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Gender *</label>
              <select value={form.gender} onChange={e => handleChange('gender', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400">
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Age</label>
              <input type="number" inputMode="numeric" min={1} max={120}
                value={form.age} onChange={e => handleChange('age', e.target.value)}
                placeholder="Age"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Mobile</label>
            <input type="tel" inputMode="numeric"
              value={form.mobile}
              onChange={e => handleChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-maroon-400" />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Address</label>
            <textarea value={form.address} onChange={e => handleChange('address', e.target.value)}
              placeholder="Full address with city and pincode" rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 resize-none" />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Centre *</label>
            {user?.role === 'aso' ? (
              <select value={form.centre} onChange={e => handleChange('centre', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400">
                <option value="">Select centre</option>
                {centres.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input value={form.centre} readOnly
                className="w-full px-3 py-2.5 border border-slate-100 rounded-lg text-sm bg-slate-50 text-slate-600" />
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={saving}
          className="w-full py-4 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2">
          {saving
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            : <><Save size={15} /> {isEdit ? 'Save Changes' : 'Add Sangat'}</>
          }
        </button>
      </form>
    </div>
  )
} 