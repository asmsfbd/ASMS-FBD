import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { CameraOff, RefreshCw, Zap, FlashlightOff } from 'lucide-react'

const BADGE_REGEX = /^FB\d{4}(GA|LA)\d{4,}$/

function clean(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

async function hasLinearBarcodeSupport(): Promise<boolean> {
  if (!('BarcodeDetector' in window)) return false
  try {
    const formats = await (window as any).BarcodeDetector.getSupportedFormats()
    return formats.includes('code_39') || formats.includes('code_128')
  } catch {
    return false
  }
}

async function loadPolyfill() {
  const { BarcodeDetectorPolyfill } = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@undecaf/barcode-detector-polyfill@0.9.21/dist/es/index.js'
  )
  ;(window as any).BarcodeDetector = BarcodeDetectorPolyfill
}

export interface BarcodeScannerHandle {
  stop: () => void
  resume: () => void
  restart: () => void
}

interface BarcodeScannerProps {
  onScan: (badge: string) => void
  active?: boolean
}

const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(
  function BarcodeScanner({ onScan, active = true }, ref) {
    const videoRef      = useRef<HTMLVideoElement>(null)
    const streamRef     = useRef<MediaStream | null>(null)
    const rafRef        = useRef<number | null>(null)
    const detectorRef   = useRef<any>(null)
    const mountedRef    = useRef(true)
    const lastScanRef   = useRef({ badge: '', time: 0 })
    const isDetectingRef = useRef(false)

    const [status,      setStatus]      = useState<'loading' | 'ready' | 'error'>('loading')
    const [errorMsg,    setErrorMsg]    = useState('')
    const [engineLabel, setEngineLabel] = useState('')
    const [fps,         setFps]         = useState(0)
    const [lastScanned, setLastScanned] = useState('')
    const fpsRef = useRef({ frames: 0, last: Date.now() })

    const stopScanner = useCallback(() => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (videoRef.current) videoRef.current.srcObject = null
      isDetectingRef.current = false
    }, [])

    const startScanner = useCallback(async () => {
      if (!mountedRef.current) return
      stopScanner()
      setStatus('loading')
      setErrorMsg('')

      // Step 1 — ensure linear barcode support
      const hasNative = await hasLinearBarcodeSupport()
      if (!hasNative) {
        try {
          await loadPolyfill()
          setEngineLabel('WASM')
        } catch {
          if (mountedRef.current) {
            setStatus('error')
            setErrorMsg('Could not load barcode engine. Check internet and retry.')
          }
          return
        }
      } else {
        setEngineLabel('Native')
      }

      // Step 2 — create detector
      try {
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['code_39', 'code_128', 'codabar'],
        })
      } catch {
        if (mountedRef.current) { setStatus('error'); setErrorMsg('Failed to start barcode detector') }
        return
      }

      // Step 3 — camera stream (rear camera, high resolution)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err: any) {
        if (!mountedRef.current) return
        setStatus('error')
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in your browser settings and retry.'
            : 'Camera not available on this device.'
        )
        return
      }

      if (!mountedRef.current) return
      setStatus('ready')

      // Step 4 — detection loop
      const detect = async () => {
        if (!mountedRef.current) return

        fpsRef.current.frames++
        const now = Date.now()
        if (now - fpsRef.current.last >= 1000) {
          setFps(fpsRef.current.frames)
          fpsRef.current = { frames: 0, last: now }
        }

        if (!isDetectingRef.current && videoRef.current?.readyState === 4) {
          isDetectingRef.current = true
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current)
            for (const b of barcodes) {
              const text = clean(b.rawValue)
              if (!BADGE_REGEX.test(text)) continue
              const t = Date.now()
              if (text === lastScanRef.current.badge && t - lastScanRef.current.time < 2000) continue
              lastScanRef.current = { badge: text, time: t }
              setLastScanned(text)
              setTimeout(() => { if (mountedRef.current) setLastScanned('') }, 1500)
              onScan(text)
              break
            }
          } catch { /* ignore frame errors */ }
          isDetectingRef.current = false
        }

        rafRef.current = requestAnimationFrame(detect)
      }

      rafRef.current = requestAnimationFrame(detect)
    }, [onScan, stopScanner])

    useEffect(() => {
      mountedRef.current = true
      if (active) startScanner()
      return () => { mountedRef.current = false; stopScanner() }
    }, [active, startScanner, stopScanner])

    useImperativeHandle(ref, () => ({
      stop:    stopScanner,
      resume:  () => { if (mountedRef.current) startScanner() },
      restart: () => { stopScanner(); setTimeout(() => { if (mountedRef.current) startScanner() }, 100) },
    }), [startScanner, stopScanner])

    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center bg-slate-100 rounded-2xl">
          <CameraOff size={36} className="text-slate-400" />
          <p className="text-sm text-slate-600 max-w-xs">{errorMsg}</p>
          <button
            onClick={startScanner}
            className="flex items-center gap-2 px-4 py-2.5 bg-maroon-600 text-white rounded-xl text-sm font-medium active:scale-95 transition-transform touch-manipulation"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )
    }

    return (
      <div className="relative w-full bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3' }}>

        {/* Video feed */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white/80 text-sm">
              {engineLabel === 'WASM' ? 'Loading iOS engine...' : 'Starting camera...'}
            </span>
          </div>
        )}

        {/* Scan frame overlay */}
        {status === 'ready' && (
          <>
            {/* Dimmed edges */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/40" />
              {/* Clear scan zone */}
              <div
                className="absolute bg-transparent"
                style={{
                  top: '25%', left: '10%',
                  width: '80%', height: '50%',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  borderRadius: 8,
                }}
              />
            </div>

            {/* Corner markers */}
            <div className="absolute pointer-events-none" style={{ top: '25%', left: '10%', width: '80%', height: '50%' }}>
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-6 h-6 border-maroon-400 ${cls}`} />
              ))}
              {/* Scan line */}
              <div className="absolute top-1/2 left-1 right-1 h-0.5 bg-maroon-400/80 animate-pulse" />
            </div>

            {/* FPS badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white/80 text-[10px] px-2 py-1 rounded-full">
              <Zap size={9} />
              {fps}fps · {engineLabel}
            </div>

            {/* Scan result flash */}
            {lastScanned && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-mono font-bold shadow-lg animate-bounce">
                {lastScanned}
              </div>
            )}

            {/* Tip */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="bg-black/60 text-white/80 text-xs px-3 py-1.5 rounded-full">
                Point camera at badge barcode
              </span>
            </div>
          </>
        )}
      </div>
    )
  }
)

export default BarcodeScanner
