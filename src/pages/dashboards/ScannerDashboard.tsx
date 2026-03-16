import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Camera, Keyboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'
import type { Sewadar, AttendanceType } from '@/types'
import BarcodeScanner, { type BarcodeScannerHandle } from '@/components/scanner/BarcodeScanner'

const BADGE_REGEX = /^FB\d{4}(GA|LA)\d{4,}$/
const SCAN_COOLDOWN_MS = 300

interface ScanLogEntry {
  id:       string
  badge:    string
  name:     string
  centre:   string
  type:     AttendanceType | 'BLOCKED' | 'ERROR'
  time:     string
  message?: string
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'blocked' | 'error'

interface ScanState {
  status:     ScanStatus
  sewadar?:   Sewadar
  action?:    AttendanceType
  message?:   string
  jathaInfo?: string
}

export default function ScannerDashboard() {
  const { user }                          = useAuth()
  const [mode,         setMode]           = useState<'camera' | 'manual'>('camera')
  const [manualInput,  setManualInput]    = useState('')
  const [scanState,    setScanState]      = useState<ScanState>({ status: 'idle' })
  const [log,          setLog]            = useState<ScanLogEntry[]>([])
  const [stats,        setStats]          = useState({ inCount: 0, outCount: 0, blocked: 0 })
  const [showModal,    setShowModal]      = useState(false)
  const [pendingBadge, setPendingBadge]   = useState<{ sewadar: Sewadar; action: AttendanceType } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const scannerRef    = useRef<BarcodeScannerHandle>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const resetTimer    = useRef<ReturnType<typeof setTimeout>>()
  const lastScanTime  = useRef<number>(0)   // cooldown tracker
  const isProcessing  = useRef(false)        // prevent concurrent lookups

  const duty = new Date().getDay() === 0 || new Date().getDay() === 3
    ? { label: 'Satsang Point Duty', variant: 'gold'  as const }
    : { label: 'Daily Duty',          variant: 'navy'  as const }

  // ── Load last 5 scans by this scanner from DB ──────────────────
  useEffect(() => {
    if (user) fetchHistory()
  }, [user])

  const fetchHistory = async () => {
    if (!user) return
    setLoadingHistory(true)
    try {
      const { data } = await supabase
        .from('attendance')
        .select('id, badge_number, sewadar_name, centre, type, scan_time')
        .eq('scanner_badge', user.badge_number)
        .order('scan_time', { ascending: false })
        .limit(5)

      if (data) {
        const entries: ScanLogEntry[] = data.map(r => ({
          id:     String(r.id),
          badge:  r.badge_number,
          name:   r.sewadar_name,
          centre: r.centre,
          type:   r.type as AttendanceType,
          time:   new Date(r.scan_time).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
        }))
        setLog(entries)

        // Also update today's stats
        const today = new Date().toISOString().split('T')[0]
        const { data: todayData } = await supabase
          .from('attendance')
          .select('type')
          .eq('scanner_badge', user.badge_number)
          .gte('scan_time', `${today}T00:00:00+05:30`)

        if (todayData) {
          setStats({
            inCount:  todayData.filter(r => r.type === 'IN').length,
            outCount: todayData.filter(r => r.type === 'OUT').length,
            blocked:  0,
          })
        }
      }
    } catch (err) {
      console.error('History fetch error:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // ── Add entry to log (prepend, keep 20 max) ────────────────────
  const addToLog = (badge: string, name: string, centre: string, type: ScanLogEntry['type'], message?: string) => {
    setLog(prev => [{
      id:      `${Date.now()}-${Math.random()}`,
      badge, name, centre, type, message,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev].slice(0, 20))
  }

  // ── Auto-reset scan state after 3s ────────────────────────────
  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setScanState({ status: 'idle' })
      setManualInput('')
      isProcessing.current = false
      if (mode === 'camera') scannerRef.current?.resume()
    }, 3000)
  }, [mode])

  // ── Main badge lookup logic ────────────────────────────────────
  const lookupBadge = useCallback(async (rawBadge: string) => {
    if (!user) return

    // 300ms cooldown between scans
    const now = Date.now()
    if (now - lastScanTime.current < SCAN_COOLDOWN_MS) return
    lastScanTime.current = now

    // Prevent concurrent processing
    if (isProcessing.current) return
    isProcessing.current = true

    setScanState({ status: 'scanning' })
    if (mode === 'camera') scannerRef.current?.stop()

    const badge = rawBadge.trim().toUpperCase()

    // 1. Format check
    if (!BADGE_REGEX.test(badge)) {
      setScanState({ status: 'error', message: `Invalid badge format: ${badge}` })
      addToLog(badge, '—', '—', 'ERROR', 'Invalid format')
      scheduleReset()
      return
    }

    try {
      // 2. Lookup sewadar
      const { data: sewadar, error } = await supabase
        .from('sewadars')
        .select('*')
        .eq('badge_number', badge)
        .single()

      if (error || !sewadar) {
        setScanState({ status: 'error', message: 'Badge not found in system' })
        addToLog(badge, '—', '—', 'ERROR', 'Not found')
        scheduleReset()
        return
      }

      // 3. Scannable status check (Permanent / Open / Elderly only)
      if (!sewadar.is_scannable) {
        setScanState({
          status: 'error',
          message: `Badge status: ${sewadar.badge_status} — not valid for scanning`,
          sewadar,
        })
        addToLog(badge, sewadar.name, sewadar.centre, 'ERROR', `Status: ${sewadar.badge_status}`)
        scheduleReset()
        return
      }

      // 4. Centre scope check
      // ASO → can scan ANY sewadar from any centre (no restriction)
      // Special dept → can be scanned at any centre
      // Others → must belong to scanner's centre or sub-centre
      if (user.role !== 'aso' && !sewadar.is_special_dept) {
        const { data: centres } = await supabase
          .from('centres')
          .select('centre_name, parent_centre')
          .in('centre_name', [user.centre, sewadar.centre])

        const myC  = centres?.find(c => c.centre_name === user.centre)
        const swC  = centres?.find(c => c.centre_name === sewadar.centre)

        const inScope =
          sewadar.centre === user.centre ||
          swC?.parent_centre === user.centre ||
          sewadar.centre === myC?.parent_centre

        if (!inScope) {
          setScanState({
            status:  'error',
            message: `${sewadar.name} belongs to ${sewadar.centre} — not in your scope`,
            sewadar,
          })
          addToLog(badge, sewadar.name, sewadar.centre, 'ERROR', 'Out of scope')
          scheduleReset()
          return
        }
      }

      // 5. Jatha block check
      const { data: jathaBlock } = await supabase
        .from('v_active_jatha_blocks')
        .select('jatha_name, from_date, to_date')
        .eq('badge_or_id', badge)
        .maybeSingle()

      if (jathaBlock) {
        setScanState({
          status:    'blocked',
          sewadar,
          jathaInfo: `${jathaBlock.jatha_name} · ${jathaBlock.from_date} to ${jathaBlock.to_date}`,
        })
        setStats(s => ({ ...s, blocked: s.blocked + 1 }))
        addToLog(badge, sewadar.name, sewadar.centre, 'BLOCKED', jathaBlock.jatha_name)
        scheduleReset()
        return
      }

      // 6. Determine IN / OUT from last scan today
      const today = new Date().toISOString().split('T')[0]
      const { data: lastScan } = await supabase
        .from('attendance')
        .select('type')
        .eq('badge_number', badge)
        .gte('scan_time', `${today}T00:00:00+05:30`)
        .order('scan_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      const action: AttendanceType = (!lastScan || lastScan.type === 'OUT') ? 'IN' : 'OUT'

      // Show confirmation modal
      setPendingBadge({ sewadar, action })
      setShowModal(true)

    } catch (err) {
      console.error('Scan error:', err)
      setScanState({ status: 'error', message: 'System error — try again' })
      scheduleReset()
    }
  }, [user, mode, scheduleReset, showModal])

  // ── Confirm the scan and write to DB ──────────────────────────
  const confirmScan = async () => {
    if (!pendingBadge || !user) return
    const { sewadar, action } = pendingBadge
    setShowModal(false)

    try {
      await supabase.from('attendance').insert({
        badge_number:  sewadar.badge_number,
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

      setScanState({ status: 'success', sewadar, action })
      setStats(s => ({
        ...s,
        inCount:  action === 'IN'  ? s.inCount + 1  : s.inCount,
        outCount: action === 'OUT' ? s.outCount + 1 : s.outCount,
      }))
      addToLog(sewadar.badge_number, sewadar.name, sewadar.centre, action)
      scheduleReset()
    } catch {
      setScanState({ status: 'error', message: 'Failed to record — try again' })
      scheduleReset()
    }
    setPendingBadge(null)
  }

  const cancelScan = () => {
    setShowModal(false)
    setPendingBadge(null)
    setScanState({ status: 'idle' })
    isProcessing.current = false
    if (mode === 'camera') scannerRef.current?.resume()
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) lookupBadge(manualInput.trim().toUpperCase())
  }

  const handleModeSwitch = (newMode: 'camera' | 'manual') => {
    setMode(newMode)
    setScanState({ status: 'idle' })
    isProcessing.current = false
    if (newMode === 'manual') {
      scannerRef.current?.stop()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Daily Duty Scanner</h1>
          <p className="text-xs text-slate-400">
            {user?.centre}
            {user?.role === 'aso' && (
              <span className="ml-1.5 text-gold-600 font-medium">· All centres</span>
            )}
          </p>
        </div>
        <Badge variant={duty.variant} dot className="text-[10px]">{duty.label}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'IN',      value: stats.inCount,  color: 'text-green-600', bg: 'bg-green-50'  },
          { label: 'OUT',     value: stats.outCount, color: 'text-navy-600',  bg: 'bg-navy-50'   },
          { label: 'Blocked', value: stats.blocked,  color: 'text-amber-600', bg: 'bg-amber-50'  },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {[
          { key: 'camera', label: 'Camera Scan', icon: <Camera size={14} /> },
          { key: 'manual', label: 'Manual Entry', icon: <Keyboard size={14} /> },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => handleModeSwitch(m.key as 'camera' | 'manual')}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation',
              mode === m.key ? 'bg-white text-maroon-700 shadow-sm' : 'text-slate-500',
            ].join(' ')}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Camera */}
      {mode === 'camera' && (
        <BarcodeScanner
          ref={scannerRef}
          onScan={lookupBadge}
          active={mode === 'camera' && !showModal}
        />
      )}

      {/* Manual entry */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <input
            ref={inputRef}
            value={manualInput}
            onChange={e => setManualInput(e.target.value.toUpperCase())}
            placeholder="FB5971GA0001"
            className="w-full px-4 py-4 text-center font-mono text-xl tracking-widest border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:border-maroon-400 uppercase"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || scanState.status === 'scanning'}
            className="w-full py-4 bg-maroon-600 text-white rounded-xl text-base font-semibold active:scale-95 transition-all disabled:opacity-50 touch-manipulation"
          >
            {scanState.status === 'scanning' ? 'Looking up...' : 'Check Badge'}
          </button>
        </form>
      )}

      {/* Status feedback */}
      {scanState.status !== 'idle' && scanState.status !== 'scanning' && (
        <div className={[
          'rounded-xl p-4 flex items-start gap-3',
          scanState.status === 'success' ? 'bg-green-50 border border-green-200' :
          scanState.status === 'blocked' ? 'bg-amber-50 border border-amber-200' :
          'bg-red-50 border border-red-200',
        ].join(' ')}>
          {scanState.status === 'success' && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
          {scanState.status === 'blocked' && <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />}
          {scanState.status === 'error'   && <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />}
          <div>
            {scanState.sewadar && (
              <>
                <p className="text-sm font-semibold text-slate-800">{scanState.sewadar.name}</p>
                <p className="text-xs text-slate-500 font-mono">{scanState.sewadar.badge_number}</p>
                <p className="text-xs text-slate-400">{scanState.sewadar.centre} · {scanState.sewadar.department}</p>
              </>
            )}
            {scanState.status === 'success' && (
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
                scanState.action === 'IN' ? 'bg-green-500 text-white' : 'bg-slate-600 text-white'
              }`}>
                Marked {scanState.action}
              </span>
            )}
            {scanState.status === 'blocked' && (
              <p className="text-xs text-amber-700 mt-1 font-medium">{scanState.jathaInfo}</p>
            )}
            {scanState.status === 'error' && (
              <p className="text-xs text-red-600 mt-0.5">{scanState.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Recent scans — last 5 from DB */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Recent Scans
            <span className="text-slate-400 font-normal ml-1 text-xs">(your last 5)</span>
          </h3>
          <button
            onClick={fetchHistory}
            className="text-xs text-maroon-500 font-medium touch-manipulation active:opacity-60"
          >
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : log.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">No scans yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {log.map(entry => (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${
                entry.type === 'ERROR'   ? 'bg-red-50/50' :
                entry.type === 'BLOCKED' ? 'bg-amber-50/50' : ''
              }`}>
                <span className="text-[10px] text-slate-400 font-mono w-16 flex-shrink-0">{entry.time}</span>
                <span className={`text-[10px] font-bold w-12 flex-shrink-0 ${
                  entry.type === 'IN'      ? 'text-green-600' :
                  entry.type === 'OUT'     ? 'text-slate-500' :
                  entry.type === 'BLOCKED' ? 'text-amber-600' : 'text-red-500'
                }`}>{entry.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{entry.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{entry.message ?? entry.badge}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && pendingBadge && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              pendingBadge.action === 'IN' ? 'bg-green-100' : 'bg-slate-100'
            }`}>
              {pendingBadge.action === 'IN'
                ? <CheckCircle size={28} className="text-green-600" />
                : <XCircle    size={28} className="text-slate-500" />
              }
            </div>

            <h3 className="text-lg font-bold text-slate-800 text-center mb-1">
              Mark {pendingBadge.action}?
            </h3>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 text-center">
              <p className="text-base font-semibold text-slate-800">{pendingBadge.sewadar.name}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{pendingBadge.sewadar.badge_number}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {pendingBadge.sewadar.centre} · {pendingBadge.sewadar.department}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={cancelScan}
                className="py-3.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:scale-95 transition-transform touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={confirmScan}
                className={`py-3.5 rounded-xl text-white font-semibold text-sm active:scale-95 transition-transform touch-manipulation ${
                  pendingBadge.action === 'IN' ? 'bg-green-600' : 'bg-maroon-600'
                }`}
              >
                Confirm {pendingBadge.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}