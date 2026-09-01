import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div 
      onClick={onClick}
      className={twMerge(
        "bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all", 
        onClick ? "cursor-pointer active:scale-95 hover:shadow-md" : "",
        className
      )}
    >
      {children}
    </div>
  );
}