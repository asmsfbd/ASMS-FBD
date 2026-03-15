import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const DESTINATIONS = [
  'Beas', 'Delhi', 'Sikanderpur', 'Amritsar', 'Patiala',
  'Ludhiana', 'Chandigarh', 'Haridwar', 'Dehradun',
]

const DEPARTMENTS = [
  'Langar', 'Security', 'Sewadar', 'Medical',
  'Car Sewa', 'Administration', 'Pandal', 'Sanitation',
  'Horticulture', 'Store', 'Water', 'Electric',
]

interface CentreQuota {
  centre:       string
  quota_count:  number
}

interface FormData {
  jatha_name:   string
  destination:  string
  department:   string
  is_bhati:     boolean
  from_date:    string
  to_date:      string
  description:  string
}

const EMPTY_FORM: FormData = {
  jatha_name:  '',
  destination: '',
  department:  '',
  is_bhati:    false,
  from_date:   '',
  to_date:     '',
  description: '',
}

export default function JathaScheduleFormPage() {
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [form,        setForm]        = useState<FormData>(EMPTY_FORM)
  const [allCentres,  setAllCentres]  = useState<string[]>([])
  const [selected,    setSelected]    = useState<CentreQuota[]>([])
  const [centreSearch, setCentreSearch] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [step,        setStep]        = useState<1 | 2>(1)

  useEffect(() => {
    supabase.from('centres')
      .select('centre_name')
      .eq('is_active', true)
      .order('centre_name')
      .then(({ data }) => {
        if (data) setAllCentres(data.map(c => c.centre_name))
      })
  }, [])

  const handleChange = (key: keyof FormData, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }))
    setError('')
  }

  // Auto-generate jatha name from fields
  const autoName = () => {
    if (form.destination && form.department && form.from_date) {
      const month = new Date(form.from_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      return `${form.destination} ${form.department} ${month}`
    }
    return ''
  }

  const validateStep1 = () => {
    if (!form.destination)  return 'Select a destination'
    if (!form.department)   return 'Select a department'
    if (!form.from_date)    return 'Set start date'
    if (!form.to_date)      return 'Set end date'
    if (form.to_date < form.from_date) return 'End date must be after start date'
    return ''
  }

  const goToStep2 = () => {
    const err = validateStep1()
    if (err) { setError(err); return }
    // Auto-fill name if empty
    if (!form.jatha_name) {
      setForm(f => ({ ...f, jatha_name: autoName() }))
    }
    setError('')
    setStep(2)
  }

  const addCentre = (centre: string) => {
    if (selected.find(s => s.centre === centre)) return
    setSelected(prev => [...prev, { centre, quota_count: 0 }])
    setCentreSearch('')
  }

  const removeCentre = (centre: string) => {
    setSelected(prev => prev.filter(s => s.centre !== centre))
  }

  const updateQuota = (centre: string, val: string) => {
    const n = parseInt(val) || 0
    setSelected(prev => prev.map(s => s.centre === centre ? { ...s, quota_count: n } : s))
  }

  const addAllCentres = () => {
    const existing = new Set(selected.map(s => s.centre))
    const toAdd = allCentres.filter(c => !existing.has(c))
    setSelected(prev => [...prev, ...toAdd.map(c => ({ centre: c, quota_count: 0 }))])
  }

  const handleSave = async (publish: boolean) => {
    if (!user) return
    if (selected.length === 0) { setError('Add at least one centre'); return }
    const zeroQuota = selected.filter(s => s.quota_count === 0)
    if (zeroQuota.length > 0 && !window.confirm(`${zeroQuota.length} centre(s) have 0 quota. Continue?`)) return

    setSaving(true)
    setError('')
    try {
      // Create schedule
      const { data: schedule, error: schedErr } = await supabase
        .from('jatha_schedule')
        .insert({
          jatha_name:   form.jatha_name || autoName(),
          destination:  form.destination,
          department:   form.department,
          is_bhati:     form.is_bhati,
          from_date:    form.from_date,
          to_date:      form.to_date,
          description:  form.description || null,
          is_published: publish,
          is_active:    true,
          created_by:   user.badge_number,
        })
        .select('id')
        .single()

      if (schedErr) throw schedErr

      // Insert quotas
      const quotaRows = selected.map(s => ({
        jatha_schedule_id: schedule.id,
        centre:            s.centre,
        quota_count:       s.quota_count,
        set_by:            user.badge_number,
      }))

      const { error: quotaErr } = await supabase
        .from('jatha_quota')
        .insert(quotaRows)

      if (quotaErr) throw quotaErr

      navigate(`/jatha-schedule/${schedule.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const filteredCentres = allCentres.filter(c =>
    c.toLowerCase().includes(centreSearch.toLowerCase()) &&
    !selected.find(s => s.centre === c)
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/jatha-schedule" className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-slate-800">New Jatha Schedule</h1>
          <p className="text-xs text-slate-400">नया जत्था शेड्यूल</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {[
          { n: 1, label: 'Schedule Details' },
          { n: 2, label: 'Assign Centres & Quotas' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`h-0.5 w-8 ${step >= s.n ? 'bg-maroon-500' : 'bg-slate-200'}`} />}
            <div className={`flex items-center gap-2 ${step >= s.n ? 'text-maroon-600' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s.n ? 'bg-maroon-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>{s.n}</div>
              <span className="text-xs font-medium hidden sm:block">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 1: Schedule details ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jatha Details</p>

            {/* Type toggle */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
                Jatha Type
              </label>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => handleChange('is_bhati', false)}
                  className={[
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation',
                    !form.is_bhati ? 'bg-maroon-600 text-white shadow-sm' : 'text-slate-500',
                  ].join(' ')}
                >
                  Beas / Outstation
                </button>
                <button
                  onClick={() => handleChange('is_bhati', true)}
                  className={[
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation',
                    form.is_bhati ? 'bg-navy-600 text-white shadow-sm' : 'text-slate-500',
                  ].join(' ')}
                >
                  Bhati
                </button>
              </div>
            </div>

            {/* Destination */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                Destination (गंतव्य) *
              </label>
              <select
                value={form.destination}
                onChange={e => handleChange('destination', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              >
                <option value="">Select destination</option>
                {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                Department (विभाग) *
              </label>
              <select
                value={form.department}
                onChange={e => handleChange('department', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">From Date *</label>
                <input type="date" value={form.from_date}
                  onChange={e => handleChange('from_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">To Date *</label>
                <input type="date" value={form.to_date}
                  onChange={e => handleChange('to_date', e.target.value)}
                  min={form.from_date}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
                />
              </div>
            </div>

            {/* Jatha name */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                Jatha Name
                <span className="text-slate-300 font-normal ml-1">(auto-generated if left blank)</span>
              </label>
              <input
                value={form.jatha_name}
                onChange={e => handleChange('jatha_name', e.target.value)}
                placeholder={autoName() || 'e.g. Beas Langar March 2026'}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                Notes (optional)
              </label>
              <textarea
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Any notes for Centre Admins..."
                rows={2}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={goToStep2}
            className="w-full py-4 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all touch-manipulation"
          >
            Next: Assign Centres →
          </button>
        </div>
      )}

      {/* ── STEP 2: Centre quotas ── */}
      {step === 2 && (
        <div className="space-y-4">

          {/* Summary card */}
          <div className="bg-maroon-50 border border-maroon-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-maroon-800">
              {form.jatha_name || autoName()}
            </p>
            <p className="text-xs text-maroon-600 mt-0.5">
              {form.destination} · {form.department} ·{' '}
              {form.is_bhati ? 'Bhati' : 'Beas/Outstation'}
            </p>
            <p className="text-xs text-maroon-500 mt-0.5">
              {new Date(form.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(form.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Centre search + add */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Participating Centres ({selected.length})
              </p>
              <button
                onClick={addAllCentres}
                className="text-xs text-maroon-600 font-medium touch-manipulation"
              >
                + Add All 41
              </button>
            </div>

            {/* Search to add */}
            <div className="relative">
              <input
                value={centreSearch}
                onChange={e => setCentreSearch(e.target.value)}
                placeholder="Search centre to add..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-maroon-400"
              />
              {centreSearch && filteredCentres.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredCentres.map(c => (
                    <button
                      key={c}
                      onClick={() => addCentre(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-maroon-50 flex items-center justify-between touch-manipulation"
                    >
                      {c}
                      <Plus size={13} className="text-maroon-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected centres with quota inputs */}
            {selected.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">No centres added yet</p>
                <p className="text-xs text-slate-300 mt-1">Search above or click "Add All 41"</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {/* Total */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-xs font-medium text-slate-600">
                  <span>{selected.length} centres selected</span>
                  <span>Total quota: {selected.reduce((s, c) => s + c.quota_count, 0)}</span>
                </div>

                {selected.map(s => (
                  <div key={s.centre} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
                    <p className="flex-1 text-sm font-medium text-slate-700 truncate">{s.centre}</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999}
                      value={s.quota_count || ''}
                      onChange={e => updateQuota(s.centre, e.target.value)}
                      placeholder="0"
                      className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center font-semibold focus:outline-none focus:border-maroon-400"
                    />
                    <button
                      onClick={() => removeCentre(s.centre)}
                      className="p-1.5 text-slate-400 hover:text-red-500 touch-manipulation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Save buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setStep(1)}
              className="py-3.5 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-600 active:scale-95 transition-transform touch-manipulation"
            >
              ← Back
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="py-3.5 border-2 border-maroon-200 rounded-xl text-sm font-semibold text-maroon-700 active:scale-95 transition-transform touch-manipulation disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="w-full py-4 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              : <><Save size={15} /> Save & Publish</>
            }
          </button>
          <p className="text-center text-xs text-slate-400">
            Publishing makes the schedule visible to assigned Centre Admins
          </p>
        </div>
      )}
    </div>
  )
}
