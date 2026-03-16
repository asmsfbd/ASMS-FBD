import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, ChevronRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'

interface Sangat {
  id:            number
  sangat_id:     string
  aadhaar_last4: string
  name:          string
  father_name:   string | null
  gender:        string
  age:           number | null
  mobile:        string | null
  address:       string | null
  centre:        string
  is_active:     boolean
  created_at:    string
}

const PAGE_SIZE = 50

export default function SangatListPage() {
  const { user }                     = useAuth()
  const [sangat,     setSangat]      = useState<Sangat[]>([])
  const [search,     setSearch]      = useState('')
  const [loading,    setLoading]     = useState(true)
  const [totalCount, setTotalCount]  = useState(0)
  const [page,       setPage]        = useState(0)
  const isASO = user?.role === 'aso'

  const fetchSangat = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const filter = search.trim()
        ? `name.ilike.%${search.trim()}%,aadhaar_last4.ilike.%${search.trim()}%,sangat_id.ilike.%${search.trim()}%`
        : null

      // FIX: build both queries properly so filters are applied before execution
      let dataQ = supabase.from('sangat').select('*')
      let countQ = supabase.from('sangat').select('*', { count: 'exact', head: true })

      if (!isASO) {
        dataQ  = dataQ.eq('centre', user.centre)
        countQ = countQ.eq('centre', user.centre)
      }
      if (filter) {
        dataQ  = dataQ.or(filter)
        countQ = countQ.or(filter)
      }

      const [{ count }, { data }] = await Promise.all([
        countQ,
        dataQ.order('name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      ])

      setTotalCount(count ?? 0)
      setSangat((data ?? []) as Sangat[])
    } catch (err) {
      console.error('fetchSangat error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isASO, search, page])

  useEffect(() => { fetchSangat() }, [fetchSangat])

  // FIX: reset page in the same handler to avoid double-fetch from two separate effects
  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(0)  // resetting page here means only one fetchSangat fires (via fetchSangat deps)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            Sangat
            <span className="text-slate-400 font-normal ml-1 text-sm">(संगत)</span>
          </h1>
          <p className="text-xs text-slate-400">
            {totalCount.toLocaleString('en-IN')} records
            {!isASO && ` · ${user?.centre}`}
          </p>
        </div>
        <Link to="/sangat/new">
          <button className="flex items-center gap-1.5 px-3 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation">
            <Plus size={13} /> Add Sangat
          </button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search name, Aadhaar last 4, or SG ID..."
          className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-maroon-400"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="asms-table">
            <thead>
              <tr>
                <th>SG ID</th>
                <th>Name</th>
                <th>Father's Name</th>
                <th>Aadhaar</th>
                <th>Centre</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Mobile</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(6)].map((_, i) => (
                <tr key={i}>{[...Array(9)].map((_, j) => (
                  <td key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {!loading && sangat.map(s => (
                <tr key={s.id}>
                  <td><span className="badge-chip text-[10px]">{s.sangat_id}</span></td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-slate-500">{s.father_name ?? '—'}</td>
                  <td className="font-mono text-slate-500">XXXX-XXXX-{s.aadhaar_last4}</td>
                  <td className="text-slate-500">{s.centre}</td>
                  <td>
                    <Badge variant={s.gender === 'M' ? 'navy' : 'maroon'} className="text-[10px]">
                      {s.gender}
                    </Badge>
                  </td>
                  <td className="text-slate-500">{s.age ?? '—'}</td>
                  <td className="text-slate-500">{s.mobile ?? '—'}</td>
                  <td>
                    <Link to={`/sangat/${s.id}`}>
                      <ChevronRight size={14} className="text-slate-300 hover:text-maroon-500 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && sangat.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                    {search ? `No results for "${search}"` : 'No sangat records found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-slate-50">
          {loading && [...Array(5)].map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
            </div>
          ))}
          {!loading && sangat.map(s => (
            <Link key={s.id} to={`/sangat/${s.id}`}>
              <div className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 touch-manipulation">
                <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                  <Users size={14} className="text-navy-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <Badge variant={s.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">
                      {s.gender}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{s.sangat_id} · XXXX-XXXX-{s.aadhaar_last4}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.centre}</p>
                </div>
                <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
              </div>
            </Link>
          ))}
          {!loading && sangat.length === 0 && (
            <div className="py-10 text-center">
              <Users size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {search ? `No results for "${search}"` : 'No sangat records found'}
              </p>
              <Link to="/sangat/new">
                <button className="mt-3 px-4 py-2 bg-maroon-600 text-white rounded-xl text-xs font-semibold touch-manipulation">
                  Add First Sangat
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString('en-IN')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 touch-manipulation"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs bg-maroon-50 text-maroon-700 rounded-lg font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 touch-manipulation"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}