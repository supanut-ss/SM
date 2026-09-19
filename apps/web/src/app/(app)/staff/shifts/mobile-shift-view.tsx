"use client";

import { LEAVE_TYPE_LABEL } from "@lotus-desk/contracts";
import { Button, Select } from "@lotus-desk/ui";
import type { ShiftTemplate, StaffLeave, StaffProfile, StaffShift } from "../../../../lib/api-client";
import { isoToDateKey, minToTimeString, toDateKey, weekdayLabel } from "./time-format";

/**
 * ตารางกะสำหรับจอ < md (T10.6, ดู docs/DESIGN.md §9.4) — แทนตารางกริด 2 มิติ (พนักงาน×วัน) ที่เลื่อน
 * แนวนอนบนจอกว้างเท่านั้น ด้วย dropdown เลือกพนักงาน 1 คน + การ์ดกะรายวัน 7 วันแนวตั้ง เพิ่ม/ลบกะทำผ่าน
 * ปุ่มเปิด Sheet แทนลากวาง (จอสัมผัสลากวางแม่นยำไม่พอ)
 */
export function MobileShiftView({
  staffList,
  selectedStaffId,
  onSelectStaff,
  dates,
  shifts,
  leaves,
  canManage,
  pendingRemoveShiftId,
  onRequestRemoveShift,
  onConfirmRemoveShift,
  onCancelRemoveShift,
  pendingRemoveLeaveId,
  onRequestRemoveLeave,
  onConfirmRemoveLeave,
  onCancelRemoveLeave,
  onOpenAssignSheet,
  onOpenLeaveSheet,
}: {
  staffList: StaffProfile[];
  selectedStaffId: string | null;
  onSelectStaff: (staffId: string) => void;
  dates: Date[];
  shifts: StaffShift[];
  leaves: StaffLeave[];
  canManage: boolean;
  pendingRemoveShiftId: string | null;
  onRequestRemoveShift: (id: string) => void;
  onConfirmRemoveShift: (id: string) => void;
  onCancelRemoveShift: () => void;
  pendingRemoveLeaveId: string | null;
  onRequestRemoveLeave: (id: string) => void;
  onConfirmRemoveLeave: (id: string) => void;
  onCancelRemoveLeave: () => void;
  onOpenAssignSheet: (staffId: string, date: Date) => void;
  onOpenLeaveSheet: (staffId: string, date: Date) => void;
}) {
  const activeStaffId = staffList.some((s) => s.id === selectedStaffId) ? selectedStaffId : (staffList[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-3">
      <Select
        aria-label="เลือกพนักงาน"
        value={activeStaffId ?? ""}
        onChange={(e) => onSelectStaff(e.target.value)}
      >
        {staffList.map((staff) => (
          <option key={staff.id} value={staff.id}>
            {staff.name}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-2.5">
        {dates.map((date, i) => {
          const dateKey = toDateKey(date);
          const dayShifts = shifts.filter((s) => s.staffId === activeStaffId && isoToDateKey(s.date) === dateKey);
          const dayLeave = leaves.find((l) => l.staffId === activeStaffId && isoToDateKey(l.date) === dateKey);

          return (
            <div key={dateKey} className="rounded-lg border border-line bg-surface p-3.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink">{weekdayLabel(i)}</span>
                <span className="font-data tabular-nums text-xs text-ink-muted">
                  {date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              </div>

              {dayShifts.map((shift) =>
                pendingRemoveShiftId === shift.id ? (
                  <div
                    key={shift.id}
                    className="mb-1.5 flex items-center justify-between gap-2 rounded-DEFAULT bg-rose-tint px-2.5 py-1.5 text-xs text-rose"
                  >
                    <span>ลบกะนี้?</span>
                    <span className="flex gap-2">
                      <button type="button" className="font-medium underline" onClick={() => onConfirmRemoveShift(shift.id)}>
                        ลบ
                      </button>
                      <button type="button" onClick={onCancelRemoveShift}>
                        ไม่
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    key={shift.id}
                    type="button"
                    disabled={!canManage}
                    onClick={() => onRequestRemoveShift(shift.id)}
                    className="mb-1.5 block w-full rounded-DEFAULT bg-indigo-tint px-2.5 py-1.5 text-left text-xs text-indigo disabled:opacity-70"
                  >
                    {shift.shiftTemplate.name}{" "}
                    <span className="font-data tabular-nums">
                      {minToTimeString(shift.startMin)}-{minToTimeString(shift.endMin)}
                    </span>
                  </button>
                ),
              )}

              {dayLeave &&
                (pendingRemoveLeaveId === dayLeave.id ? (
                  <div className="flex items-center justify-between gap-2 rounded-DEFAULT bg-rose-tint px-2.5 py-1.5 text-xs text-rose">
                    <span>ลบวันลา?</span>
                    <span className="flex gap-2">
                      <button type="button" className="font-medium underline" onClick={() => onConfirmRemoveLeave(dayLeave.id)}>
                        ลบ
                      </button>
                      <button type="button" onClick={onCancelRemoveLeave}>
                        ไม่
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => onRequestRemoveLeave(dayLeave.id)}
                    className="block w-full rounded-DEFAULT bg-rose-tint px-2.5 py-1.5 text-left text-xs text-rose disabled:opacity-70"
                  >
                    {LEAVE_TYPE_LABEL[dayLeave.type]}
                  </button>
                ))}

              {canManage && dayShifts.length === 0 && !dayLeave && activeStaffId && (
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => onOpenAssignSheet(activeStaffId, date)}>
                    + มอบหมายกะ
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpenLeaveSheet(activeStaffId, date)}>
                    + ลา
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** เนื้อหา Sheet เลือกแม่แบบกะเพื่อมอบหมาย — ใช้แทนการลากวางบนจอสัมผัส */
export function AssignShiftSheetBody({
  templates,
  onPick,
}: {
  templates: ShiftTemplate[];
  onPick: (templateId: string) => void;
}) {
  if (templates.length === 0) {
    return <p className="text-pretty text-sm text-ink-muted">ยังไม่มีแม่แบบกะที่เปิดใช้งาน — ไปสร้างที่ &ldquo;จัดการแม่แบบกะ&rdquo; ก่อน</p>;
  }
  return (
    <div className="grid gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.id)}
          className="rounded-DEFAULT border border-line-strong p-3 text-left hover:border-celadon"
        >
          <p className="text-pretty text-sm font-medium text-ink">{t.name}</p>
          <p className="text-pretty font-data tabular-nums text-xs text-ink-muted">
            {minToTimeString(t.startMin)}-{minToTimeString(t.endMin)}
          </p>
        </button>
      ))}
    </div>
  );
}
