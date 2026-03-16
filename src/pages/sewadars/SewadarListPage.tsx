import { useState, useEffect, useCallback } from 'react'
import { Search, Download, ChevronRight, Filter, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/index'
import type { Sewadar } from '@/types'

const DEPARTMENTS = [
  'ADMINISTRATION', 'AREA SECRETARY OFFICE', 'AUDIO-VISUAL', 'B.A.V.',
  'BAAL SATSANG', 'BAAL SATSANG KARTA', 'ELECTRIC', 'HORTICULTURE',
  'MAINTENANCE', 'MEDICAL', 'OFFICE', 'PANDAL', 'PATHI', 'SANITATION',
  'SATSANG KARTA', 'SECURITY', 'STORE', 'TRAFFIC', 'WATER', 'SANGAT',
]

const STATUSES = ['Permanent', 'Open', 'Elderly', 'Withdrawn', 'Expired', 'Cancelled']

const statusVariant: Record<string, 'green' | 'navy' | 'gold' | 'red' | 'gray'> = {
  Permanent: 'green',
  Open: 'navy',
  Elderly: 'gold',
  Withdrawn: 'gray',
  Expired: 'red',
  Cancelled: 'red',
}

interface Filters {
  centre: string
  department: string
  status: string
  gender: string
  search: string
}

const DEFAULT_FILTERS: Filters = {
  centre: '', department: '', status: '', gender: '', search: '',
}

export default function SewadarListPage() {
  const { user } = useAuth()
  const [sewadars, setSewadars] = useState<Sewadar[]>([])
  const [centres, setCentres] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  const PAGE_SIZE = 50

  const isASO = user?.role === 'aso'

  // Load centres for filter dropdown
  useEffect(() => {
    supabase.from('centres').select('centre_name').eq('is_active', true).order('centre_name')
      .then(({ data }) => {
        if (data) setCentres(data.map(c => c.centre_name))
      })
  }, [])

  // Build query based on role + filters
  const buildQuery = useCallback((forCount = false) => {
    let q = supabase.from('sewadars').select(
      forCount ? '*' : '*',
      forCount ? { count: 'exact', head: true } : undefined
    )

    if (!isASO && user?.centre) {
      q = q.eq('centre', user.centre)
    }
    if (filters.centre) q = q.eq('centre', filters.centre)
    if (filters.department) q = q.eq('department', filters.department)
    if (filters.status) q = q.eq('badge_status', filters.status)
    if (filters.gender) q = q.eq('gender', filters.gender)
    if (filters.search) {
      q = q.or(`name.ilike.%${filters.search}%,badge_number.ilike.%${filters.search}%`)
    }

    return q
  }, [isASO, user, filters])

  const fetchSewadars = useCallback(async () => {
    setLoading(true)
    try {
      const [countRes, dataRes] = await Promise.all([
        buildQuery(true),
        buildQuery(false)
          .order('name')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      ])
      setTotalCount(countRes.count ?? 0)
      setSewadars((dataRes.data ?? []) as Sewadar[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [buildQuery, page])

  useEffect(() => {
    if (user) fetchSewadars()
  }, [user, fetchSewadars])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [filters])

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setPage(0)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setPage(0)
    setFilters(DEFAULT_FILTERS)
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length

  // Export to Excel
  const exportToExcel = async () => {
    setExporting(true)
    try {
      // Fetch ALL matching rows (no pagination)
      let q = supabase.from('sewadars').select(
        'badge_number,name,father_name,gender,age,mobile,address,centre,department,badge_status,is_active'
      )
      if (!isASO && user?.centre) q = q.eq('centre', user.centre)
      if (filters.centre) q = q.eq('centre', filters.centre)
      if (filters.department) q = q.eq('department', filters.department)
      if (filters.status) q = q.eq('badge_status', filters.status)
      if (filters.gender) q = q.eq('gender', filters.gender)
      if (filters.search) q = q.or(`name.ilike.%${filters.search}%,badge_number.ilike.%${filters.search}%`)
      q = q.order('centre').order('name')

      const { data } = await q
      if (!data) return

      const rows = data.map(s => ({
        'Badge Number': s.badge_number,
        'Name': s.name,
        'Father Name': s.father_name ?? '',
        'Gender': s.gender === 'M' ? 'Male' : 'Female',
        'Age': s.age ?? '',
        'Mobile': s.mobile ?? '',
        'Address': s.address ?? '',
        'Centre': s.centre,
        'Department': s.department ?? '',
        'Badge Status': s.badge_status,
        'Active': s.is_active ? 'Yes' : 'No',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sewadars')

      // Column widths
      ws['!cols'] = [
        { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 8 },
        { wch: 5 }, { wch: 14 }, { wch: 36 }, { wch: 20 },
        { wch: 20 }, { wch: 12 }, { wch: 7 },
      ]

      const filename = `ASMS_Sewadars_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            Sewadars
            <span className="text-slate-400 font-normal ml-1 text-sm">(सेवादार)</span>
          </h1>
          <p className="text-xs text-slate-400">
            {totalCount.toLocaleString('en-IN')} records
            {!isASO && ` · ${user?.centre}`}
          </p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-transform touch-manipulation disabled:opacity-50"
        >
          <Download size={13} />
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            placeholder="Search name or badge..."
            className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-maroon-400"
          />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={[
            'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all touch-manipulation',
            showFilters || activeFilterCount > 0
              ? 'bg-maroon-50 border-maroon-300 text-maroon-700'
              : 'bg-white border-slate-200 text-slate-600',
          ].join(' ')}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-maroon-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-maroon-600 font-medium">
                <X size={11} /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isASO && (
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Centre</label>
                <select
                  value={filters.centre}
                  onChange={e => handleFilterChange('centre', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-maroon-400"
                >
                  <option value="">All Centres</option>
                  {centres.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Department</label>
              <select
                value={filters.department}
                onChange={e => handleFilterChange('department', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-maroon-400"
              >
                <option value="">All Depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Status</label>
              <select
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-maroon-400"
              >
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-1">Gender</label>
              <select
                value={filters.gender}
                onChange={e => handleFilterChange('gender', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:border-maroon-400"
              >
                <option value="">All</option>
                <option value="M">Male (GA)</option>
                <option value="F">Female (LA)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sewadar list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="asms-table">
            <thead>
              <tr>
                <th>Badge</th>
                <th>Name</th>
                <th>Father's Name</th>
                <th>Centre</th>
                <th>Department</th>
                <th>Status</th>
                <th>Gender</th>
                <th>Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(9)].map((_, j) => (
                    <td key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
              {!loading && sewadars.map(s => (
                <tr key={s.id}>
                  <td><span className="badge-chip">{s.badge_number}</span></td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-slate-500">{s.father_name ?? '—'}</td>
                  <td className="text-slate-500">{s.centre}</td>
                  <td className="text-slate-500">{s.department ?? '—'}</td>
                  <td>
                    <Badge variant={statusVariant[s.badge_status] ?? 'gray'} className="text-[10px]">
                      {s.badge_status}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={s.gender === 'M' ? 'navy' : 'maroon'} className="text-[10px]">
                      {s.gender === 'M' ? 'M' : 'F'}
                    </Badge>
                  </td>
                  <td className="text-slate-500">{s.age ?? '—'}</td>
                  <td>
                    <Link to={`/sewadars/${s.id}`}>
                      <ChevronRight size={14} className="text-slate-300 hover:text-maroon-500 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && sewadars.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                    No sewadars found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-slate-50">
          {loading && [...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
          {!loading && sewadars.map(s => (
            <Link key={s.id} to={`/sewadars/${s.id}`}>
              <div className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
                <div className="w-9 h-9 rounded-full bg-maroon-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-maroon-700 text-xs font-bold">{s.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <Badge variant={s.gender === 'M' ? 'navy' : 'maroon'} className="text-[9px] flex-shrink-0">{s.gender}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{s.badge_number}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.centre} · {s.department ?? '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant={statusVariant[s.badge_status] ?? 'gray'} className="text-[9px]">
                    {s.badge_status}
                  </Badge>
                  <ChevronRight size={12} className="text-slate-300" />
                </div>
              </div>
            </Link>
          ))}
          {!loading && sewadars.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">No sewadars found</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString('en-IN')}
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
