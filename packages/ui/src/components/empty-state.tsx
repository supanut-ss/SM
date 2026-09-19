import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-sunk/40 p-6 text-center sm:p-8",
        className,
      )}
      {...props}
    >
      {icon && (
        <div aria-hidden="true" className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface text-ink-muted">
          {icon}
        </div>
      )}
      <p className="text-balance text-sm font-semibold text-ink">{title}</p>
      {description && <p className="text-pretty mt-1 max-w-md text-sm leading-6 text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
