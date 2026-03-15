import { useState, useEffect } from 'react'
import { FileText, Users, CheckCircle, Clock, PlusCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { MetricCard, Card, Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import type { NRSummary } from '@/types'

const statusConfig = {
  draft:     { label: 'Draft',     labelHi: 'मसौदा',    variant: 'gray'   as const },
  submitted: { label: 'Submitted', labelHi: 'जमा किया', variant: 'navy'   as const },
  approved:  { label: 'Approved',  labelHi: 'स्वीकृत',  variant: 'green'  as const },
  issued:    { label: 'Issued',    labelHi: 'जारी',      variant: 'maroon' as const },
  rejected:  { label: 'Rejected',  labelHi: 'अस्वीकृत', variant: 'red'    as const },
}

export default function CentreAdminDashboard() {
  const { user } = useAuth()
  const [nrs,          setNRs]         = useState<NRSummary[]>([])
  const [sewadarsCount, setSewadarsCount] = useState(0)
  const [loading,      setLoading]     = useState(true)

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [nrRes, swRes] = await Promise.all([
        supabase
          .from('v_nr_summary')
          .select('*')
          .eq('centre', user.centre)
          .order('from_date', { ascending: false })
          .limit(10),
        supabase
          .from('sewadars')
          .select('id', { count: 'exact' })
          .eq('centre', user.centre)
          .eq('is_active', true),
      ])

      setNRs((nrRes.data ?? []) as NRSummary[])
      setSewadarsCount(swRes.count ?? 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const draftCount     = nrs.filter(n => n.status === 'draft').length
  const submittedCount = nrs.filter(n => n.status === 'submitted').length
  const issuedCount    = nrs.filter(n => n.status === 'issued').length

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{user?.centre}</h2>
          <p className="text-sm text-slate-400">Centre Admin Dashboard · केंद्र प्रबंधक डैशबोर्ड</p>
        </div>
        <Link to="/nominal-roles/new">
          <Button variant="primary" size="sm">
            <PlusCircle size={14} />
            New NR
          </Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Centre Sewadars"    value={sewadarsCount} sub="Active registrations" accent="maroon" />
        <MetricCard label="NRs in Draft"       value={draftCount}    sub="Being prepared"        accent="navy" />
        <MetricCard label="Submitted to HQ"    value={submittedCount} sub="Awaiting approval"   accent="gold" />
        <MetricCard label="Issued NRs"         value={issuedCount}   sub="Ready for jatha"       accent="green" />
      </div>

      {/* Jatha cards */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-maroon-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Jatha Nominal Roles
              <span className="text-slate-400 font-normal ml-1">(जत्था नॉमिनल रोल)</span>
            </h3>
          </div>
        </div>

        {loading && (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        )}

        {!loading && nrs.length === 0 && (
          <div className="px-4 py-12 text-center">
            <FileText size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-3">No Nominal Roles yet</p>
            <p className="text-xs text-slate-300">Jatha schedules assigned by HQ will appear here as cards.</p>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {nrs.map(nr => {
            const cfg = statusConfig[nr.status]
            const pct = nr.quota > 0 ? Math.round((nr.member_count / nr.quota) * 100) : null

            return (
              <div key={nr.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800">{nr.jatha_name}</span>
                      <Badge variant={cfg.variant} className="text-[10px]">
                        {cfg.label} · {cfg.labelHi}
                      </Badge>
                      {nr.is_bhati && <Badge variant="blue" className="text-[10px]">Bhati</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">
                      {nr.destination} · {nr.department} · {nr.schedule_dates}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{nr.member_count}</span>
                        {nr.quota > 0 && <span className="text-slate-400"> / {nr.quota} quota</span>}
                        <span className="text-slate-400"> sewadars</span>
                      </span>
                      <span className="text-xs text-slate-400">
                        M: {nr.male_count} · F: {nr.female_count}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-2 w-48">
                        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-maroon-500 transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pct}% of quota</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Link to={`/nominal-roles/${nr.id}`}>
                      <Button
                        variant={nr.status === 'draft' ? 'primary' : 'secondary'}
                        size="sm"
                      >
                        {nr.status === 'draft' ? 'Edit NR' : 'View NR'}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Recent activity */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          Quick Links
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'My Sewadars',       sub: 'सेवादार सूची',  to: '/sewadars',      icon: <Users size={16} />,        color: 'bg-navy-50 text-navy-700 hover:bg-navy-100' },
            { label: 'Attendance Report', sub: 'हाजिरी रिपोर्ट', to: '/reports',       icon: <CheckCircle size={16} />,  color: 'bg-green-50 text-green-700 hover:bg-green-100' },
          ].map(item => (
            <Link
              key={item.label}
              to={item.to}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${item.color}`}
            >
              {item.icon}
              <div>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[10px] opacity-60">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
