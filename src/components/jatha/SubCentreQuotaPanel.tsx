// Component: Sub-Centre Quota Distribution Panel
// Used inside JathaScheduleFormPage for parent centres to distribute quota to sub-centres
// Place in: src/components/jatha/SubCentreQuotaPanel.tsx

import { useState, useEffect } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface SubCentre {
  centre_name:  string
  quota_count:  number
  db_id?:       number
}

interface Props {
  scheduleId:   number
  parentCentre: string
  parentQuota:  number  // total quota assigned by ASO to this parent centre
}

export function SubCentreQuotaPanel({ scheduleId, parentCentre, parentQuota }: Props) {
  const { user }                      = useAuth()
  const [subCentres, setSubCentres]   = useState<SubCentre[]>([])
  const [loading,    setLoading]      = useState(true)
  const [saving,     setSaving]       = useState(false)
  const [saved,      setSaved]        = useState(false)
  const [error,      setError]        = useState('')

  const totalDistributed = subCentres.reduce((s, c) => s + c.quota_count, 0)
  const remaining        = parentQuota - totalDistributed

  useEffect(() => { fetchSubCentres() }, [scheduleId, parentCentre])

  const fetchSubCentres = async () => {
    setLoading(true)
    try {
      // Get all sub-centres of this parent
      const { data: centresData } = await supabase
        .from('centres')
        .select('centre_name')
        .eq('parent_centre', parentCentre)
        .neq('centre_name', parentCentre) // exclude parent itself
        .eq('is_active', true)
        .order('centre_name')

      if (!centresData || centresData.length === 0) {
        setSubCentres([])
        setLoading(false)
        return
      }

      // Get existing quotas
      const { data: quotaData } = await supabase
        .from('sub_centre_quota')
        .select('id, sub_centre, quota_count')
        .eq('sewa_schedule_id', scheduleId)
        .eq('parent_centre', parentCentre)

      const quotaMap = new Map(quotaData?.map(q => [q.sub_centre, { count: q.quota_count, id: q.id }]) ?? [])

      setSubCentres(centresData.map(c => ({
        centre_name: c.centre_name,
        quota_count: quotaMap.get(c.centre_name)?.count ?? 0,
        db_id:       quotaMap.get(c.centre_name)?.id,
      })))
    } finally {
      setLoading(false)
    }
  }

  const updateQuota = (centreName: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0)
    setSubCentres(prev => prev.map(c => c.centre_name === centreName ? { ...c, quota_count: n } : c))
    setSaved(false)
    setError('')
  }

  const saveAll = async () => {
    if (!user) return
    if (totalDistributed > parentQuota) {
      setError(`Total distributed (${totalDistributed}) exceeds your quota (${parentQuota})`)
      return
    }
    setSaving(true)
    setError('')
    try {
      for (const sc of subCentres) {
        if (sc.quota_count > 0) {
          if (sc.db_id) {
            await supabase.from('sub_centre_quota')
              .update({ quota_count: sc.quota_count, set_by: user.badge_number, set_at: new Date().toISOString() })
              .eq('id', sc.db_id)
          } else {
            const { data: newRow } = await supabase.from('sub_centre_quota')
              .insert({ sewa_schedule_id: scheduleId, parent_centre: parentCentre, sub_centre: sc.centre_name, quota_count: sc.quota_count, set_by: user.badge_number })
              .select('id').single()
            if (newRow) {
              setSubCentres(prev => prev.map(c => c.centre_name === sc.centre_name ? { ...c, db_id: newRow.id } : c))
            }
          }
        } else if (sc.db_id) {
          // Was > 0, now 0 — delete
          await supabase.from('sub_centre_quota').delete().eq('id', sc.db_id)
          setSubCentres(prev => prev.map(c => c.centre_name === sc.centre_name ? { ...c, db_id: undefined } : c))
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
    </div>
  )

  if (subCentres.length === 0) return (
    <p className="text-sm text-slate-400 text-center py-4">No sub-centres under {parentCentre}</p>
  )

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-maroon-50 rounded-xl p-3">
          <p className="text-lg font-bold text-maroon-600">{parentQuota}</p>
          <p className="text-[10px] text-slate-500">Your Quota</p>
        </div>
        <div className="bg-navy-50 rounded-xl p-3">
          <p className="text-lg font-bold text-navy-600">{totalDistributed}</p>
          <p className="text-[10px] text-slate-500">Distributed</p>
        </div>
        <div className={`rounded-xl p-3 ${remaining < 0 ? 'bg-red-50' : remaining === 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {Math.abs(remaining)}
          </p>
          <p className="text-[10px] text-slate-500">
            {remaining < 0 ? 'Over' : remaining === 0 ? 'Done ✓' : 'Keep for self'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {parentQuota > 0 && (
        <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${
            totalDistributed > parentQuota ? 'bg-red-500' :
            totalDistributed === parentQuota ? 'bg-green-500' : 'bg-maroon-500'
          }`} style={{ width: `${Math.min(parentQuota > 0 ? (totalDistributed / parentQuota) * 100 : 0, 100)}%` }} />
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Remaining quota after distribution will be your own centre's quota
      </p>

      {/* Sub-centre quota table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Sub-Centre</th>
              <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide w-28">Quota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {subCentres.map(sc => (
              <tr key={sc.centre_name} className={sc.quota_count > 0 ? 'bg-maroon-50/20' : ''}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{sc.centre_name}</span>
                    {sc.quota_count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-maroon-500" />}
                  </div>
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="number" inputMode="numeric" min={0} max={999}
                    value={sc.quota_count || ''}
                    onChange={e => updateQuota(sc.centre_name, e.target.value)}
                    placeholder="0"
                    className={[
                      'w-20 px-2 py-1.5 text-center text-sm font-semibold border rounded-lg focus:outline-none focus:border-maroon-400 transition-colors',
                      sc.quota_count > 0
                        ? 'border-maroon-300 bg-maroon-50 text-maroon-700'
                        : 'border-slate-200 text-slate-400',
                    ].join(' ')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                {subCentres.filter(c => c.quota_count > 0).length} sub-centres assigned
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className={`text-sm font-bold ${
                  totalDistributed > parentQuota ? 'text-red-600' :
                  totalDistributed === parentQuota ? 'text-green-600' : 'text-maroon-600'
                }`}>{totalDistributed}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <button onClick={saveAll} disabled={saving}
        className="w-full py-3 bg-maroon-600 text-white rounded-xl text-sm font-semibold active:scale-95 touch-manipulation disabled:opacity-50 flex items-center justify-center gap-2">
        {saving
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
          : saved
            ? <><span>✓</span> Saved!</>
            : <><Save size={14} />Save Sub-Centre Quotas</>
        }
      </button>
    </div>
  )
}
