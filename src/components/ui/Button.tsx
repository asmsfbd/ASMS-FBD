import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-maroon-600 text-white hover:bg-maroon-700 border-maroon-600 hover:border-maroon-700',
  secondary: 'bg-white text-maroon-600 border-maroon-300 hover:bg-maroon-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 border-red-600',
  ghost:     'bg-transparent text-navy-600 border-transparent hover:bg-navy-50',
  gold:      'bg-gold-500 text-maroon-800 hover:bg-gold-600 border-gold-500',
}

const sizeClasses: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-xs',
  md:  'px-4 py-2 text-sm',
  lg:  'px-6 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium',
        'border rounded-lg transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-maroon-400 focus:ring-offset-1',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
