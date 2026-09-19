import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function ErrorState({
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-rose/25 bg-rose-tint text-rose",
        compact ? "flex flex-wrap items-center justify-between gap-3 px-4 py-3" : "p-5 sm:p-6",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="text-balance text-sm font-semibold">{title}</p>
        {description && <p className="text-pretty mt-1 text-sm leading-6 opacity-90">{description}</p>}
      </div>
      {action && <div className={cn("shrink-0", !compact && "mt-4")}>{action}</div>}
    </div>
  );
}
