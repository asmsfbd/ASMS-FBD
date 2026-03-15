import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
}

export function Input({
  label,
  hint,
  error,
  leftIcon,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-navy-700 tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={[
            'w-full px-3 py-2.5 text-sm border rounded-lg',
            'bg-white text-slate-800 placeholder-slate-400',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-maroon-400 focus:border-maroon-400',
            error
              ? 'border-red-400 bg-red-50'
              : 'border-slate-200 hover:border-slate-300',
            leftIcon ? 'pl-9' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  )
}
