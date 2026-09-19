"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
 * มองไม่เห็น และกัก focus ไว้ในแผงจนกว่าจะปิด
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  // ระยะที่ลาก handle ลงมาแล้วถือว่าตั้งใจปิด (จอ < md เท่านั้น — ดู docs/DESIGN.md §9.3)
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  function handleHandlePointerDown(event: ReactPointerEvent) {
    dragStartY.current = event.clientY;
  }
  function handleHandlePointerMove(event: ReactPointerEvent) {
    if (dragStartY.current === null) return;
    setDragOffset(Math.max(0, event.clientY - dragStartY.current));
  }
  function handleHandlePointerUp() {
    if (dragOffset > 80) onClose();
    dragStartY.current = null;
    setDragOffset(0);
  }

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const backgroundState = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== rootRef.current)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    backgroundState.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    // รอ 1 frame ให้เล่น transition ที่ตำแหน่งเริ่มต้นก่อน ค่อยย้าย focus
    const raf = requestAnimationFrame(() => panelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      if (previouslyFocused.current?.isConnected) previouslyFocused.current.focus();
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      aria-hidden={open ? undefined : true}
      className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}
    >
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
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        inert={!open}
        className={cn(
          // จอ < md: เลื่อนจากล่าง สูง 92dvh มุมบนโค้ง (docs/DESIGN.md §9.3) — จอ ≥ md: เลื่อนจากขวาเหมือนเดิม
          "fixed inset-x-0 bottom-0 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg border-t border-line bg-surface shadow-pop",
          "md:inset-y-0 md:right-0 md:bottom-auto md:left-auto md:h-full md:w-full md:max-w-md md:rounded-t-none md:border-l md:border-t-0",
          "transition-transform duration-200 ease-out motion-reduce:transition-none focus:outline-none",
          open ? "translate-x-0 translate-y-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        )}
        style={{
          transitionDuration: dragOffset ? "0ms" : `${TRANSITION_MS}ms`,
          transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
        }}
      >
        {/* แถบจับปัดลงเพื่อปิด — เฉพาะจอ < md เท่านั้น (ดู docs/DESIGN.md §9.3) */}
        <div
          className="flex shrink-0 justify-center py-2 md:hidden"
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
        >
          <div className="h-1 w-9 rounded-DEFAULT bg-line-strong" />
        </div>
        <div className="flex shrink-0 items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id={titleId} className="text-balance font-display text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && <p id={descriptionId} className="text-pretty mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-DEFAULT text-ink-muted hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1 lg:size-8"
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
