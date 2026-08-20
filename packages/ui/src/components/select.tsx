import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

// ใช้ native <select> โดยตั้งใจ — คีย์บอร์ดและ screen reader ใช้งานได้ดีกว่า custom dropdown
// โดยไม่ต้องเพิ่ม dependency (ดู CLAUDE.md กฎเหล็กด้าน UI: ทุก interactive element ต้องใช้คีย์บอร์ดได้)
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
