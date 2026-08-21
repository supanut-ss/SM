"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

// ต้องตรงกับ docs/DESIGN.md §3.6: "--ease: cubic-bezier(.2,.8,.2,1) ระยะ 120–180ms เท่านั้น"
// นี่คือ 1 ใน 4 จุดที่อนุญาตให้มี motion (Sheet เลื่อนเข้า)
const TRANSITION_MS = 160;

/**
 * แผงเลื่อนจากขวา — ใช้แทน modal สำหรับฟอร์มยาว (ดู docs/DESIGN.md §3.5: "ห้ามใช้ modal ซ้อน modal
 * ฟอร์มยาวให้ใช้ Sheet เลื่อนจากขวา") เขียนเองล้วน ๆ ไม่มี dependency ใหม่ (ดู CLAUDE.md, precedent
 * เดียวกับ Select ที่ใช้ native <select> โดยตั้งใจ) — ใช้ core Tailwind transition utilities ล้วน
 * ไม่พึ่ง plugin tailwindcss-animate ที่ไม่ได้ติดตั้ง
 *
 * เลือกอยู่ใน DOM ตลอด (ไม่ conditional unmount) แล้วสลับ visibility ด้วย CSS transform/opacity แทน —
 * เลี่ยงปัญหาการ sync state "mounted" กับ prop "open" ผ่าน effect/ref ระหว่าง render ที่ชนกับกฎ
 * react-hooks/refs และ react-hooks/set-state-in-effect ของ eslint config นี้ (ดู docs/decisions.md)
 *
 * portal ไปที่ document.body เสมอ — ถ้า render อยู่ในตำแหน่งเดิมของ component tree แล้วมี ancestor
 * ที่ตั้ง CSS `transform`/`filter`/`will-change` ไว้ (เช่น layout wrapper ใด ๆ ในอนาคต) fixed positioning
 * ของแผงจะอ้างอิงกับ containing block ของ ancestor นั้นแทนที่จะเป็น viewport จริง ทำให้ตำแหน่งเพี้ยน
 * (เจอบั๊กนี้จริงตอนทดสอบ T2.1 ใน browser — แผงเลื่อนไปอยู่นอกจอทั้งที่ class ถูกต้อง)
 *
 * a11y ระดับพื้นฐาน: role="dialog" + aria-modal, ย้าย focus เข้าแผงตอนเปิดและคืน focus ให้ trigger
 * ตอนปิด, Escape ปิดได้, คลิก overlay ปิดได้, inert ตอนปิดกันคีย์บอร์ด/screen reader หลงเข้าไปในแผงที่
 * มองไม่เห็น — ยังไม่ทำ focus trap แบบวนครบ (คีย์บอร์ดใช้งานได้ปกติเพราะแผงอยู่ท้าย DOM ตาม tab order)
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // รอ 1 frame ให้เล่น transition ที่ตำแหน่งเริ่มต้นก่อน ค่อยย้าย focus
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}>
      <div
        aria-hidden
        onClick={open ? onClose : undefined}
        className={cn(
          "absolute inset-0 bg-ink/40 transition-opacity motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface shadow-pop",
          "transition-transform ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none focus:outline-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="sheet-title" className="font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-DEFAULT p-1.5 text-ink-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
