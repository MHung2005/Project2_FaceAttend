import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  children:  ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:   'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200',
  secondary: 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700',
  danger:    'bg-red-500 hover:bg-red-600 text-white',
  ghost:     'hover:bg-slate-100 text-slate-600',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2    text-sm',
  lg: 'px-6 py-3    text-sm',
};

/**
 * Button — Component nút bấm đa năng hỗ trợ nhiều biến thể và trạng thái.
 */
export function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl
        transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
