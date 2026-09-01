import { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline' | 'success';
  children: ReactNode;
}

export const Button = ({ variant = 'primary', className = '', children, ...props }: ButtonProps) => {
  const baseStyle = "px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-slate-800 text-white hover:bg-slate-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };

  return (
    <button className={twMerge(baseStyle, variants[variant], className)} {...props}>
      {children}
    </button>
  );
};