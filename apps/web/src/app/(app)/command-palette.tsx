"use client";

import { useEffect, useRef, useState } from "react";
import type { NavItem } from "./nav-items";

export interface CommandPaletteProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: NavItem[];
  onNavigate: (href: string) => void;
}

/**
 * Cmd/Ctrl+K — ไปที่หน้าที่มีสิทธิ์เห็นจริง (ดู docs/DESIGN.md §5 ที่ระบุว่าต้องมีช่องค้นหาสากลนี้อยู่แล้ว
 * แต่ยังไม่เคยมี UI จริง — ดู docs/decisions.md ADR-047) ยังไม่ค้นข้ามโมดูล (สมาชิก/บิล/คอร์ส) เพราะต้องต่อ
 * API ค้นหาที่ยังไม่มี ขอบเขตรอบนี้ทำแค่นำทางเมนูเท่านั้น — คอมโพเนนต์นี้ mount ค้างตลอดเพื่อให้ปุ่มลัดทำงาน
 * ได้ทุกหน้า ไม่ต้องรอเปิด dialog ก่อน
 */
export function CommandPalette({ open, onOpen, onClose, items, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // เคลียร์คำค้นหาตอนเพิ่งเปิด — ปรับ state ระหว่าง render ตามแพทเทิร์นที่ React แนะนำสำหรับ "จำค่า render
  // ก่อนหน้า" (ไม่ใช้ useEffect เพราะ setState synchronous ในนั้นจะโดน react-hooks/set-state-in-effect
  // และทำให้ render ซ้อน render โดยไม่จำเป็น —ดู https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onOpen, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/35 pt-[14vh] backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ค้นหาและไปที่หน้า"
        className="flex max-h-[60vh] w-[min(520px,calc(100%-48px))] flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop"
      >
        <form
          className="flex items-center gap-2.5 border-b border-line px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (filtered[0]) onNavigate(filtered[0].href);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ไปที่หน้า..."
            aria-label="ไปที่หน้า"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="rounded border border-line-strong bg-surface-sunk px-1.5 py-0.5 font-data text-[10.5px] text-ink-faint">
            esc
          </span>
        </form>
        <div className="overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">ไม่พบเมนูที่ตรงกับ &quot;{query}&quot;</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => onNavigate(item.href)}
              className="group flex w-full items-center gap-3 rounded-DEFAULT px-3 py-2 text-left text-sm text-ink hover:bg-celadon-tint hover:text-celadon-hover"
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-ink-faint group-hover:text-celadon-hover">
                <item.icon className="h-[15px] w-[15px]" />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
