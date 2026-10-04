import React from "react";
import { cn } from "../../utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "secondary" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tracking-wide";
  const variants = {
    default: "bg-sky-950 text-sky-400 border border-sky-800",
    success: "bg-emerald-950 text-emerald-400 border border-emerald-800",
    warning: "bg-amber-950 text-amber-400 border border-amber-800",
    danger: "bg-rose-950 text-rose-400 border border-rose-800",
    secondary: "bg-slate-800 text-slate-300 border border-slate-700",
    outline: "border border-slate-700 text-slate-400",
  };

  return (
    <span className={cn(base, variants[variant], className)} {...props}>
      {children}
    </span>
  );
};
