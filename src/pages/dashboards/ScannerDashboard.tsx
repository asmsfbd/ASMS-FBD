import { useState, useEffect, useRef, useCallback } from 'react'
import { ScanLine, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, MetricCard } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import type { Sewadar, AttendanceType } from '@/types'

const BADGE_REGEX = /^FB\d{4}(GA|LA)\d{4,}$/

interface ScanLogEntry {
  id: string
  badge: string
  name: string
  centre: string
  type: AttendanceType | 'BLOCKED' | 'ERROR'
  time: string
  message?: string
}

interface ScanState {
  status: 'idle' | 'scanning' | 'success' | 'blocked' | 'error'
  sewadar?: Sewadar
  action?: AttendanceType
  message?: string
  jathaInfo?: string
}

export default function ScannerDashboard() {
  const { user } = useAuth()
  const [badgeInput, setBadgeInput] = useState('')
  const [scanState,  setScanState]  = useState<ScanState>({ status: 'idle' })
  const [log,        setLog]        = useState<ScanLogEntry[]>([])
  const [stats,      setStats]      = useState({ inCount: 0, outCount: 0, blocked: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-reset scan state after 3 seconds
  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setScanState({ status: 'idle' })
      setBadgeInput('')
      inputRef.current?.focus()
    }, 3000)
  }, [])

  const processScan = useCallback(async (rawBadge: string) => {
    const badge = rawBadge.trim().toUpperCase()
    if (!badge || !user) return

    setScanState({ status: 'scanning' })

    // Format validation
    if (!BADGE_REGEX.test(badge)) {
      setScanState({ status: 'error', message: `Invalid badge format: ${badge}` })
      addToLog(badge, '—', '—', 'ERROR', 'Invalid format')
      scheduleReset()
      return
    }

    try {
      // 1. Look up sewadar
      const { data: sewadar, error: swErr } = await supabase
        .from('sewadars')
        .select('*')
        .eq('badge_number', badge)
        .single()

      if (swErr || !sewadar) {
        setScanState({ status: 'error', message: 'Badge not found in system' })
        addToLog(badge, '—', '—', 'ERROR', 'Badge not found')
        scheduleReset()
        return
      }

      // 2. Check is_scannable (Permanent/Open/Elderly only)
      if (!sewadar.is_scannable) {
        setScanState({ status: 'error', message: `Badge status: ${sewadar.badge_status} — Not valid for scanning`, sewadar })
        addToLog(badge, sewadar.name, sewadar.centre, 'ERROR', `Status: ${sewadar.badge_status}`)
        scheduleReset()
        return
      }

      // 3. Centre scope check (skip for special depts)
      if (!sewadar.is_special_dept) {
        const { data: centreData } = await supabase
          .from('centres')
          .select('centre_name, parent_centre')
          .in('centre_name', [user.centre, sewadar.centre])

        const myCentreInfo = centreData?.find(c => c.centre_name === user.centre)
        const sewadarCentreInfo = centreData?.find(c => c.centre_name === sewadar.centre)

        const inScope =
          sewadar.centre === user.centre ||
          sewadarCentreInfo?.parent_centre === user.centre ||
          sewadar.centre === myCentreInfo?.parent_centre

        if (!inScope) {
          setScanState({ status: 'error', message: `Sewadar belongs to ${sewadar.centre} — not in your scope`, sewadar })
          addToLog(badge, sewadar.name, sewadar.centre, 'ERROR', 'Out of scope')
          scheduleReset()
          return
        }
      }

      // 4. Jatha block check
      const today = new Date().toISOString().split('T')[0]
      const { data: jathaBlock } = await supabase
        .from('v_active_jatha_blocks')
        .select('jatha_name, destination, department, from_date, to_date')
        .eq('badge_or_id', badge)
        .single()

      if (jathaBlock) {
        setScanState({
          status: 'blocked',
          sewadar,
          jathaInfo: `${jathaBlock.jatha_name} · ${jathaBlock.from_date} to ${jathaBlock.to_date}`,
        })
        setStats(s => ({ ...s, blocked: s.blocked + 1 }))
        addToLog(badge, sewadar.name, sewadar.centre, 'BLOCKED', jathaBlock.jatha_name)
        scheduleReset()
        return
      }

      // 5. Determine IN or OUT — check last scan today
      const { data: lastScan } = await supabase
        .from('attendance')
        .select('type')
        .eq('badge_number', badge)
        .gte('scan_time', `${today}T00:00:00+05:30`)
        .order('scan_time', { ascending: false })
        .limit(1)
        .single()

      const action: AttendanceType = (!lastScan || lastScan.type === 'OUT') ? 'IN' : 'OUT'

      // 6. Record attendance
      const { error: insertErr } = await supabase.from('attendance').insert({
        badge_number:  badge,
        sewadar_name:  sewadar.name,
        centre:        sewadar.centre,
        scan_centre:   user.centre,
        department:    sewadar.department,
        type:          action,
        scan_time:     new Date().toISOString(),
        scanner_badge: user.badge_number,
        scanner_name:  user.name,
        device_id:     navigator.userAgent.slice(0, 50),
        synced_at:     new Date().toISOString(),
      })

      if (insertErr) throw insertErr

      setScanState({ status: 'success', sewadar, action })
      setStats(s => ({
        ...s,
        inCount:  action === 'IN'  ? s.inCount + 1  : s.inCount,
        outCount: action === 'OUT' ? s.outCount + 1 : s.outCount,
      }))
      addToLog(badge, sewadar.name, sewadar.centre, action)
      scheduleReset()

    } catch (err) {
      console.error('Scan error:', err)
      setScanState({ status: 'error', message: 'System error — try again' })
      scheduleReset()
    }
  }, [user, scheduleReset])

  const addToLog = (badge: string, name: string, centre: string, type: ScanLogEntry['type'], message?: string) => {
    const entry: ScanLogEntry = {
      id:   `${Date.now()}-${Math.random()}`,
      badge, name, centre, type,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
    }
    setLog(prev => [entry, ...prev].slice(0, 50))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processScan(badgeInput)
      setBadgeInput('')
    }
  }

  // Scan state UI
  const scanUI = {
    idle:     { bg: 'bg-slate-50 border-slate-200',    icon: <ScanLine size={32} className="text-slate-300" />,          text: 'Ready to scan' },
    scanning: { bg: 'bg-navy-50 border-navy-200',       icon: <ScanLine size={32} className="text-navy-400 animate-pulse" />, text: 'Looking up badge...' },
    success:  { bg: 'bg-green-50 border-green-300',    icon: <CheckCircle size={32} className="text-green-500" />,        text: `Marked ${scanState.action}` },
    blocked:  { bg: 'bg-amber-50 border-amber-300',    icon: <AlertTriangle size={32} className="text-amber-500" />,      text: 'In Jatha — Blocked' },
    error:    { bg: 'bg-red-50 border-red-300',        icon: <XCircle size={32} className="text-red-400" />,              text: scanState.message ?? 'Error' },
  }[scanState.status]

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Session info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Daily Duty Scanner
            <span className="text-slate-400 font-normal text-sm ml-2">(दैनिक ड्यूटी स्कैनर)</span>
          </h2>
          <p className="text-xs text-slate-400">{user?.centre}</p>
        </div>
        <Badge variant={new Date().getDay() === 0 || new Date().getDay() === 3 ? 'gold' : 'navy'} dot>
          {new Date().getDay() === 0 || new Date().getDay() === 3 ? 'Satsang Point Duty' : 'Daily Duty'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="IN Today"  value={stats.inCount}  sub="Checked in"    accent="green" />
        <MetricCard label="OUT Today" value={stats.outCount} sub="Checked out"   accent="navy" />
        <MetricCard label="Blocked"   value={stats.blocked}  sub="In jatha"      accent="gold" />
      </div>

      {/* Scan zone */}
      <Card padding="none">
        <div
          className={`border-2 rounded-xl m-3 p-6 text-center transition-all duration-300 cursor-pointer ${scanUI.bg}`}
          onClick={() => inputRef.current?.focus()}
        >
          <div className="flex flex-col items-center gap-2 mb-5">
            {scanUI.icon}
            <p className="text-sm font-semibold text-slate-600">{scanUI.text}</p>
            {scanState.sewadar && (
              <div className="bg-white rounded-lg px-4 py-2 border border-slate-200 mt-1">
                <p className="text-sm font-bold text-slate-800">{scanState.sewadar.name}</p>
                <p className="text-xs text-slate-400 font-mono">{scanState.sewadar.badge_number}</p>
                <p className="text-xs text-slate-400">{scanState.sewadar.centre} · {scanState.sewadar.department}</p>
              </div>
            )}
            {scanState.jathaInfo && (
              <p className="text-xs text-amber-600 font-medium">{scanState.jathaInfo}</p>
            )}
          </div>

          {/* Scan frame corners */}
          <div className="relative w-32 h-16 mx-auto mb-4">
            {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
              'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 border-maroon-500 ${cls}`} />
            ))}
            <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-maroon-400/60" />
          </div>

          <input
            ref={inputRef}
            value={badgeInput}
            onChange={e => setBadgeInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="FB5971GA0001"
            className="w-full max-w-xs mx-auto block px-4 py-2.5 text-center font-mono text-lg tracking-widest border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-maroon-400 uppercase"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-slate-400 mt-2">Scan badge or type and press Enter</p>
        </div>
      </Card>

      {/* Scan log */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Scan Log
            <span className="text-slate-400 font-normal ml-1">(स्कैन रिकॉर्ड)</span>
          </h3>
          <button onClick={() => setLog([])} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RefreshCw size={11} /> Clear
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
          {log.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No scans yet this session</p>
            </div>
          )}
          {log.map(entry => (
            <div key={entry.id} className={`flex items-center gap-3 px-4 py-2.5 ${entry.type === 'ERROR' ? 'bg-red-50/50' : entry.type === 'BLOCKED' ? 'bg-amber-50/50' : ''}`}>
              <span className="text-[10px] text-slate-400 font-mono w-14 flex-shrink-0">{entry.time}</span>
              <Badge
                variant={entry.type === 'IN' ? 'green' : entry.type === 'OUT' ? 'gray' : entry.type === 'BLOCKED' ? 'gold' : 'red'}
                className="text-[10px] w-14 justify-center flex-shrink-0"
              >
                {entry.type}
              </Badge>
              <span className="text-[10px] font-mono text-slate-400 w-28 flex-shrink-0 truncate">{entry.badge}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{entry.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{entry.message ?? entry.centre}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
