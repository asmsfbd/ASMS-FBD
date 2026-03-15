import React from 'react'
import { Loader2 } from 'lucide-react'

// ── Badge ────────────────────────────────────────────────────

type BadgeVariant = 'maroon' | 'navy' | 'gold' | 'green' | 'red' | 'gray' | 'blue'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const badgeStyles: Record<BadgeVariant, string> = {
  maroon: 'bg-maroon-100 text-maroon-700 border-maroon-200',
  navy:   'bg-navy-100 text-navy-700 border-navy-200',
  gold:   'bg-gold-100 text-gold-700 border-gold-200',
  green:  'bg-green-100 text-green-700 border-green-200',
  red:    'bg-red-100 text-red-700 border-red-200',
  gray:   'bg-slate-100 text-slate-600 border-slate-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
}

export function Badge({ variant = 'gray', children, className = '', dot }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border',
        badgeStyles[variant],
        className,
      ].join(' ')}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ── Card ─────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  accent?: 'maroon' | 'navy' | 'gold' | 'none'
}

const paddingStyles = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

const accentStyles = {
  none:   '',
  maroon: 'border-t-2 border-t-maroon-600',
  navy:   'border-t-2 border-t-navy-600',
  gold:   'border-t-2 border-t-gold-500',
}

export function Card({ children, className = '', padding = 'md', accent = 'none' }: CardProps) {
  return (
    <div
      className={[
        'bg-white border border-slate-200 rounded-xl shadow-card',
        paddingStyles[padding],
        accentStyles[accent],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

// ── Metric Card ──────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'maroon' | 'navy' | 'gold' | 'green'
}

const metricAccent = {
  maroon: 'text-maroon-600',
  navy:   'text-navy-600',
  gold:   'text-gold-600',
  green:  'text-green-600',
}

export function MetricCard({ label, value, sub, accent = 'maroon' }: MetricCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${metricAccent[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Spinner ──────────────────────────────────────────────────

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-maroon-600 ${className}`}
    />
  )
}

// ── Full Page Loader ─────────────────────────────────────────

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
      <Spinner size={32} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
