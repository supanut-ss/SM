import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn("rounded-lg border border-dashed border-line-strong p-8 text-center", className)}
      {...props}
    >
      <p className="text-sm text-ink-muted">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
