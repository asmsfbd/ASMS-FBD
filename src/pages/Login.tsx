import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, BadgeCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function Login() {
  const { user, loading, error, signIn, clearError } = useAuth()
  const navigate = useNavigate()

  const [badge,    setBadge]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  // If already logged in, go to dashboard
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
    else clearError()
  }, [user, navigate, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!badge.trim() || !password.trim()) return
    await signIn(badge.trim(), password)
  }

  const handleBadgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBadge(e.target.value.toUpperCase())
    if (error) clearError()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-700 via-maroon-600 to-navy-700 flex items-center justify-center p-4">

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white rounded-2xl shadow-modal overflow-hidden">

        {/* Left — branding panel */}
        <div className="bg-gradient-to-br from-maroon-700 to-navy-700 p-10 flex flex-col justify-between">
          <div>
            {/* Logo mark */}
            <div className="w-14 h-14 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center mb-8">
              <div className="w-7 h-7 rounded-full bg-gold-500 border-2 border-white/40" />
            </div>

            <h1 className="text-white text-2xl font-bold leading-tight mb-2">
              Area Sewadar<br />Management System
            </h1>
            <p className="text-white/60 text-sm">
              क्षेत्र सेवादार प्रबंधन प्रणाली
            </p>
            <p className="text-white/40 text-xs mt-2">
              Faridabad Area · 41 Centres
            </p>
          </div>

          {/* Role guide */}
          <div>
            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-3">
              Access Levels · पहुँच स्तर
            </p>
            {[
              { role: 'ASO / Area HQ',       desc: 'Full access',         color: 'bg-gold-500' },
              { role: 'Centre Admin',         desc: 'NR + centre mgmt',   color: 'bg-blue-400' },
              { role: 'Scanner',              desc: 'Daily duty scanning', color: 'bg-green-400' },
              { role: 'Jatha Sewadar',        desc: 'Jatha attendance',    color: 'bg-purple-400' },
            ].map(r => (
              <div key={r.role} className="flex items-center gap-3 mb-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.color}`} />
                <div>
                  <span className="text-white text-xs font-medium">{r.role}</span>
                  <span className="text-white/40 text-xs ml-2">{r.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — login form */}
        <div className="p-10 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800">Sign In</h2>
            <p className="text-slate-400 text-sm mt-1">
              Use your Badge Number to sign in
              <span className="block text-xs text-slate-300 mt-0.5">
                अपने बैज नंबर से साइन इन करें
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Badge Number (बैज संख्या)"
              placeholder="FB5971GA0001"
              value={badge}
              onChange={handleBadgeChange}
              autoComplete="username"
              autoFocus
              leftIcon={<BadgeCheck size={15} />}
              className="font-mono tracking-wider uppercase"
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-navy-700 tracking-wide uppercase">
                Password (पासवर्ड)
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) clearError() }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-maroon-400 focus:border-maroon-400 hover:border-slate-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-red-600 text-xs font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!badge.trim() || !password.trim()}
              className="mt-2"
            >
              Sign In · प्रवेश करें
            </Button>
          </form>

          <p className="text-xs text-slate-300 text-center mt-6">
            Forgot password? Contact your Area HQ.
            <span className="block">पासवर्ड भूल गए? क्षेत्र मुख्यालय से संपर्क करें।</span>
          </p>
        </div>

      </div>
    </div>
  )
}
