import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-DEFAULT bg-surface-sunk", className)}
      {...props}
    />
  );
}

export interface SkeletonGroupProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function SkeletonGroup({ className, label = "กำลังโหลด...", ...props }: SkeletonGroupProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("space-y-2", className)}
      {...props}
    />
  );
}
