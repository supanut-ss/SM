import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * สลับระหว่างตาราง (จอ ≥ md) กับการ์ดรายการ (จอ < md) ตาม docs/DESIGN.md §9.3 — รับ node สำเร็จรูปทั้งสอง
 * แบบแทนที่จะพยายามสร้าง column abstraction ใหม่ เพราะแต่ละหน้ามี logic ต่อแถว (เช่น flow ยืนยันปิดใช้งาน)
 * ที่ต่างกันอยู่แล้ว การให้ผู้เรียกส่ง JSX ที่ประกอบเสร็จมาเข้ามาปลอดภัยกว่าและคงพฤติกรรมเดิมของตาราง
 * ฝั่ง desktop ไว้เป๊ะ (เกณฑ์ผ่านของ T10.3: "≥ 768px เห็นตารางเดิมไม่เปลี่ยนแปลง")
 */
export interface ResponsiveListProps {
  /** ตารางเดิม (Table/TableHeader/... ) แสดงเฉพาะจอ ≥ md */
  table: ReactNode;
  /** การ์ดต่อแถว (ปกติคือ array ของ <ListCard />) แสดงเฉพาะจอ < md */
  cards: ReactNode;
}

export function ResponsiveList({ table, cards }: ResponsiveListProps) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="flex flex-col gap-2.5 md:hidden">{cards}</div>
    </>
  );
}

export interface ListCardProps {
  title: ReactNode;
  /** บรรทัดรองใต้ title เช่นเบอร์โทร/ทักษะ — แต่ละอันคือ 1 บรรทัด */
  lines?: ReactNode[];
  /** ป้ายสถานะมุมขวาบน (ใช้ span ที่มีสีเดิมจากหน้านั้นได้เลย ไม่ต้องสร้างสีใหม่) */
  badge?: ReactNode;
  /** แถวปุ่ม action ใต้เส้นคั่น — ส่ง node เดียวกับที่ใช้ในเซลล์ "จัดการ" ของตาราง เพื่อให้พฤติกรรมตรงกัน */
  actions?: ReactNode;
  className?: string;
}

export function ListCard({ title, lines, badge, actions, className }: ListCardProps) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{title}</div>
          {lines?.map((line, i) => (
            <div key={i} className="mt-0.5 truncate text-xs text-ink-muted">
              {line}
            </div>
          ))}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {actions && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}
