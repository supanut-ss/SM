import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-DEFAULT text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // ใช้ *-solid (ค่าคงที่ไม่สลับตามธีม) ไม่ใช่ token สีปกติ — เพราะพื้นทึบ + ตัวอักษรขาว
        // ต้องเข้มพอผ่าน AA เสมอ ในขณะที่ --celadon/--rose ปกติถูกทำให้สว่างขึ้นในโหมดมืด
        // สำหรับใช้เป็นสีตัวอักษร/เส้นขอบ ไม่ใช่พื้นทึบ (ดู docs/decisions.md ADR-003)
        primary: "bg-celadon-solid text-white hover:brightness-110",
        secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-sunk",
        ghost: "bg-transparent text-ink hover:bg-surface-sunk",
        destructive: "bg-rose-solid text-white hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-11 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
