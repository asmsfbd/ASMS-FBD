import { useState, useEffect } from 'react'
import { CheckSquare, Users, Calendar, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, MetricCard } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import type { NRSummary } from '@/types'

export default function JathaDashboard() {
  const { user } = useAuth()
  const [activeNRs, setActiveNRs] = useState<NRSummary[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (user) fetchActiveNRs()
  }, [user])

  const fetchActiveNRs = async () => {
    if (!user) return
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('v_nr_summary')
        .select('*')
        .eq('centre', user.centre)
        .in('status', ['approved', 'issued'])
        .lte('from_date', today)
        .gte('to_date', today)
        .order('from_date', { ascending: false })

      setActiveNRs((data ?? []) as NRSummary[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalMembers  = activeNRs.reduce((sum, nr) => sum + nr.member_count, 0)

  return (
    <div className="space-y-6 max-w-2xl">

      <div>
        <h2 className="text-base font-semibold text-slate-800">
          Jatha Attendance
          <span className="text-slate-400 font-normal text-sm ml-2">(जत्था हाजिरी)</span>
        </h2>
        <p className="text-xs text-slate-400">{user?.centre} · Mark present / absent for today's jatha</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Active Jathas Today" value={activeNRs.length} sub="In progress"    accent="maroon" />
        <MetricCard label="Total Members"        value={totalMembers}     sub="To mark today"  accent="navy" />
      </div>

      <Card padding="none">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <CheckSquare size={15} className="text-maroon-500" />
          <h3 className="text-sm font-semibold text-slate-700">
            Today's Active Jathas
            <span className="text-slate-400 font-normal ml-1">(आज के जत्थे)</span>
          </h3>
        </div>

        {loading && (
          <div className="p-6 space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && activeNRs.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Calendar size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-medium">No active jathas today</p>
            <p className="text-xs text-slate-400 mt-1">
              Jathas with approved NRs active today will appear here.
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {activeNRs.map(nr => (
            <div key={nr.id} className="px-4 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{nr.jatha_name}</p>
                    <Badge variant="green" dot className="text-[10px]">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {nr.destination} · {nr.department}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{nr.schedule_dates}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={11} />
                      {nr.member_count} members
                    </span>
                    <span className="text-xs text-slate-400">M: {nr.male_count} · F: {nr.female_count}</span>
                  </div>
                </div>
                <Link to={`/jatha-attendance/${nr.id}`}>
                  <Button variant="primary" size="sm">
                    Mark Attendance
                    <ChevronRight size={13} />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Upcoming jathas */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Upcoming Jathas
          <span className="text-slate-400 font-normal ml-1">(आगामी जत्थे)</span>
        </h3>
        <UpcomingJathas centre={user?.centre ?? ''} />
      </Card>

    </div>
  )
}

function UpcomingJathas({ centre }: { centre: string }) {
  const [upcoming, setUpcoming] = useState<NRSummary[]>([])

  useEffect(() => {
    if (!centre) return
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('v_nr_summary')
      .select('*')
      .eq('centre', centre)
      .in('status', ['approved', 'issued'])
      .gt('from_date', today)
      .order('from_date', { ascending: true })
      .limit(5)
      .then(({ data }) => setUpcoming((data ?? []) as NRSummary[]))
  }, [centre])

  if (upcoming.length === 0) {
    return <p className="text-xs text-slate-400">No upcoming jathas scheduled.</p>
  }

  return (
    <div className="space-y-2">
      {upcoming.map(nr => (
        <div key={nr.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
          <div>
            <p className="text-xs font-medium text-slate-700">{nr.jatha_name}</p>
            <p className="text-[10px] text-slate-400">{nr.destination} · {nr.schedule_dates}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-maroon-600">{nr.member_count}</p>
            <p className="text-[10px] text-slate-400">members</p>
          </div>
        </div>
      ))}
    </div>
  )
}
