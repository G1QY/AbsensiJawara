import React, { useState, forwardRef } from 'react';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
  icon?: 'email' | 'lock' | React.ReactNode;
  isPassword?: boolean;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(({
  id,
  label,
  required = false,
  error,
  icon,
  isPassword = false,
  type = 'text',
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  disabled = false,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isFloating = isFocused || hasValue;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  // Render left icon
  const renderIcon = () => {
    if (!icon) return null;

    if (icon === 'email') {
      return (
        <svg 
          className={`w-[19px] h-[19px] transition-colors duration-200 ${
            error 
              ? 'text-[#ea580c]' 
              : isFocused 
                ? 'text-[#2e0052]' 
                : 'text-[#64748b]'
          }`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.75" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <rect width="20" height="15" x="2" y="4.5" rx="2" />
          <polyline points="22 5.5 12 12.5 2 5.5" />
        </svg>
      );
    }

    if (icon === 'lock') {
      return (
        <svg 
          className={`w-[19px] h-[19px] transition-colors duration-200 ${
            error 
              ? 'text-[#ea580c]' 
              : isFocused 
                ? 'text-[#2e0052]' 
                : 'text-[#64748b]'
          }`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.75" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    }

    return icon;
  };

  return (
    <div className="w-full">
      <div className="relative w-full">
        {/* Left Icon */}
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-10">
            {renderIcon()}
          </div>
        )}

        {/* Input element */}
        <input
          {...props}
          ref={ref}
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder=""
          className={`w-full bg-white text-[#1a1c1c] text-[14px] outline-none rounded-[6px] transition-all duration-200 ${
            icon ? 'pl-11' : 'pl-3.5'
          } ${
            isPassword ? 'pr-10' : 'pr-3.5'
          } py-3.5 border ${
            error
              ? 'border-[#ea580c] focus:border-[#ea580c] focus:ring-1 focus:ring-[#ea580c]/30'
              : isFocused
                ? 'border-[#2e0052] ring-1 ring-[#2e0052]/20'
                : 'border-[#cbd5e1] hover:border-[#94a3b8]'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''} ${className}`}
        />

        {/* Floating Label */}
        <label
          htmlFor={id}
          className={`absolute pointer-events-none transition-all duration-200 origin-left select-none ${
            isFloating
              ? 'left-3 top-0 -translate-y-1/2 text-[11px] font-medium bg-white px-1.5 z-20 ' +
                (error
                  ? 'text-[#ea580c]'
                  : isFocused
                    ? 'text-[#2e0052]'
                    : 'text-[#64748b]')
              : (icon ? 'left-11' : 'left-3.5') +
                ' top-1/2 -translate-y-1/2 text-[14px] ' +
                (error ? 'text-[#ea580c]' : 'text-[#64748b]')
          }`}
        >
          {label}
          {required && (
            <span className={`ml-1 ${error ? 'text-[#ea580c]' : 'text-[#ea580c]'}`}>*</span>
          )}
        </label>

        {/* Password toggle button */}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748b] hover:text-[#2e0052] transition-colors rounded focus:outline-none z-10"
            title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
          >
            {showPassword ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Field Error Message */}
      {error && (
        <p className="text-[12px] text-[#ea580c] mt-1.5 ml-1 flex items-center gap-1 font-normal animate-fadeIn">
          {error}
        </p>
      )}
    </div>
  );
});

FloatingInput.displayName = 'FloatingInput';

export default FloatingInput;
