import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-DEFAULT border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-faint lg:h-9 lg:text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
