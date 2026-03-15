import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Calendar, Users, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'
import type { NRSummary } from '@/types'

interface NRMember {
  id:           number
  display_id:   string
  name:         string
  father_name:  string | null
  gender:       string
  age:          number | null
  is_present?:  boolean
  attendance_id?: number | null
}

export default function JathaDashboard() {
  const { user }                              = useAuth()
  const [nrs,            setNRs]             = useState<NRSummary[]>([])
  const [selectedNR,     setSelectedNR]      = useState<NRSummary | null>(null)
  const [members,        setMembers]         = useState<NRMember[]>([])
  const [selectedDate,   setSelectedDate]    = useState(new Date().toISOString().split('T')[0])
  const [loadingNRs,     setLoadingNRs]      = useState(true)
  const [loadingMembers, setLoadingMembers]  = useState(false)
  const [saving,         setSaving]          = useState<number | null>(null)

  useEffect(() => { if (user) fetchNRs() }, [user])
  useEffect(() => { if (selectedNR) fetchMembers() }, [selectedNR, selectedDate])

  const fetchNRs = async () => {
    if (!user) return
    setLoadingNRs(true)
    try {
      const { data } = await supabase
        .from('v_nr_summary').select('*')
        .eq('centre', user.centre)
        .in('status', ['approved','issued'])
        .order('from_date', { ascending: false })
      setNRs((data ?? []) as NRSummary[])
    } finally { setLoadingNRs(false) }
  }

  const fetchMembers = async () => {
    if (!selectedNR) return
    setLoadingMembers(true)
    try {
      const { data: memberData } = await supabase
        .from('nr_members').select('id, display_id, name, father_name, gender, age')
        .eq('nominal_role_id', selectedNR.id).order('serial_no')

      const { data: attData } = await supabase
        .from('jatha_attendance').select('id, nr_member_id, is_present')
        .in('nr_member_id', (memberData ?? []).map(m => m.id))
        .eq('attendance_date', selectedDate)

      const attMap = new Map(attData?.map(a => [a.nr_member_id, a]) ?? [])
      setMembers((memberData ?? []).map(m => ({
        ...m,
        is_present:    attMap.get(m.id)?.is_present ?? false,
        attendance_id: attMap.get(m.id)?.id ?? null,
      })))
    } finally { setLoadingMembers(false) }
  }

  const togglePresent = async (member: NRMember) => {
    if (!user) return
    setSaving(member.id)
    const newValue = !member.is_present
    try {
      if (member.attendance_id) {
        await supabase.from('jatha_attendance')
          .update({ is_present: newValue, marked_at: new Date().toISOString(), marked_by: user.badge_number })
          .eq('id', member.attendance_id)
      } else {
        await supabase.from('jatha_attendance').insert({
          nr_member_id: member.id, attendance_date: selectedDate,
          is_present: newValue, marked_at: new Date().toISOString(), marked_by: user.badge_number,
        })
      }
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_present: newValue } : m))
    } finally { setSaving(null) }
  }

  const markAllPresent = async () => {
    for (const m of members.filter(m => !m.is_present)) await togglePresent(m)
  }

  const isDateValid = selectedNR
    ? selectedDate >= selectedNR.from_date && selectedDate <= selectedNR.to_date
    : false

  const presentCount = members.filter(m => m.is_present).length

  // NR selection view
  if (!selectedNR) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Jatha Attendance</h2>
          <p className="text-xs text-slate-400">{user?.centre} · जत्था हाजिरी</p>
        </div>

        {loadingNRs ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : nrs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
            <Calendar size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No approved jathas yet</p>
            <p className="text-xs text-slate-300 mt-1">Approved NRs will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nrs.map(nr => (
              <button
                key={nr.id}
                onClick={() => setSelectedNR(nr)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 active:bg-slate-50 transition-colors touch-manipulation"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{nr.jatha_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{nr.destination} · {nr.department}</p>
                    <p className="text-xs text-slate-400">{nr.schedule_dates}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold text-maroon-600">{nr.member_count}</p>
                    <p className="text-[10px] text-slate-400">members</p>
                    <Badge variant={nr.is_bhati ? 'blue' : 'maroon'} className="text-[9px] mt-1">
                      {nr.is_bhati ? 'Bhati' : 'Beas'}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Member attendance view
  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedNR(null)}
          className="p-2 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 touch-manipulation"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate">{selectedNR.jatha_name}</h2>
          <p className="text-[10px] text-slate-400">{selectedNR.destination} · {selectedNR.department}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-600">{presentCount}</p>
          <p className="text-[10px] text-slate-400">Present</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-500">{members.length - presentCount}</p>
          <p className="text-[10px] text-slate-400">Absent</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-700">{members.length}</p>
          <p className="text-[10px] text-slate-400">Total</p>
        </div>
      </div>

      {/* Date + bulk action */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          min={selectedNR.from_date}
          max={selectedNR.to_date}
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-maroon-400 touch-manipulation"
        />
        <button
          onClick={markAllPresent}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition-transform touch-manipulation flex-shrink-0"
        >
          All Present
        </button>
      </div>

      {!isDateValid && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 font-medium">
            Date outside jatha range ({selectedNR.from_date} – {selectedNR.to_date})
          </p>
        </div>
      )}

      {/* Member list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">Members · सदस्य</h3>
          </div>
          <span className="text-xs text-slate-400">{members.length} total</span>
        </div>

        {loadingMembers ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${member.is_present ? 'bg-green-50/40' : ''}`}
              >
                <span className="text-[10px] text-slate-300 w-5 flex-shrink-0 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{member.name}</p>
                    <Badge variant={member.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">
                      {member.gender}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{member.display_id}</p>
                </div>
                <button
                  onClick={() => isDateValid && togglePresent(member)}
                  disabled={saving === member.id || !isDateValid}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border touch-manipulation active:scale-95',
                    member.is_present
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200',
                    (!isDateValid || saving === member.id) ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  {saving === member.id
                    ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : member.is_present
                      ? <><CheckCircle2 size={13} /> Present</>
                      : <><XCircle size={13} /> Absent</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
