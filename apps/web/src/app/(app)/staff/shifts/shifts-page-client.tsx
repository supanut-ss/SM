"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LEAVE_TYPE_LABEL } from "@lotus-desk/contracts";
import { Button, Sheet, cn } from "@lotus-desk/ui";
import {
  ApiError,
  shiftTemplateApi,
  staffApi,
  staffLeaveApi,
  staffShiftApi,
  type ShiftTemplate,
} from "../../../../lib/api-client";
import { useCurrentBranch } from "../../current-branch-context";
import { hasPermission } from "../../permissions";
import { AssignShiftSheetBody, MobileShiftView } from "./mobile-shift-view";
import { ShiftTemplateForm, shiftTemplateDefaults } from "./shift-template-form";
import { StaffLeaveForm, defaultStaffLeaveValues, type StaffLeaveFormValues } from "./staff-leave-form";
import { addDays, isoToDateKey, minToTimeString, startOfWeek, toDateKey, weekDates, weekdayLabel } from "./time-format";

type ActiveSheet =
  | { type: "templates"; formTarget: "create" | ShiftTemplate | null }
  | { type: "leave"; defaults: StaffLeaveFormValues }
  /** มอบหมายกะผ่านปุ่ม (มือถือ) แทนลากวาง — ดู docs/DESIGN.md §9.4 (T10.6) */
  | { type: "assign"; staffId: string; date: Date };

export function ShiftsPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "staff");

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null);
  const [pendingRemoveShiftId, setPendingRemoveShiftId] = useState<string | null>(null);
  const [pendingRemoveLeaveId, setPendingRemoveLeaveId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const from = toDateKey(dates[0]!);
  const to = toDateKey(dates[6]!);

  const staffQuery = useQuery({
    queryKey: ["staff", branch?.branchId, "", "true"],
    queryFn: () => staffApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const templatesQuery = useQuery({
    queryKey: ["shift-templates", branch?.branchId, "all"],
    queryFn: () => shiftTemplateApi.list(branch!.branchId, "all"),
    enabled: !!branch?.branchId,
  });

  const shiftsQuery = useQuery({
    queryKey: ["staff-shifts", branch?.branchId, from, to],
    queryFn: () => staffShiftApi.list(branch!.branchId, { from, to }),
    enabled: !!branch?.branchId,
  });

  const leavesQuery = useQuery({
    queryKey: ["staff-leaves", branch?.branchId, from, to],
    queryFn: () => staffLeaveApi.list(branch!.branchId, { from, to }),
    enabled: !!branch?.branchId,
  });

  function invalidateShifts() {
    void queryClient.invalidateQueries({ queryKey: ["staff-shifts", branch?.branchId] });
  }
  function invalidateLeaves() {
    void queryClient.invalidateQueries({ queryKey: ["staff-leaves", branch?.branchId] });
  }
  function invalidateTemplates() {
    void queryClient.invalidateQueries({ queryKey: ["shift-templates", branch?.branchId] });
  }

  const assignMutation = useMutation({
    mutationFn: (input: { staffId: string; shiftTemplateId: string; date: string }) =>
      staffShiftApi.create(branch!.branchId, { ...input, date: new Date(input.date) }),
    onSuccess: () => {
      invalidateShifts();
      setAssignError(null);
      // ปิด sheet "มอบหมายกะ" ถ้าเปิดอยู่ (มือถือ) — ตอนลากวางบนกริด desktop ไม่มี sheet เปิดอยู่แล้ว
      // เรียก setActiveSheet(null) ตรงนี้จึงไม่กระทบ flow เดิม
      setActiveSheet(null);
    },
    onError: (err) => setAssignError(err instanceof ApiError ? err.message : "มอบหมายกะไม่สำเร็จ"),
  });

  const removeShiftMutation = useMutation({
    mutationFn: (staffShiftId: string) => staffShiftApi.remove(branch!.branchId, staffShiftId),
    onSuccess: () => {
      invalidateShifts();
      setPendingRemoveShiftId(null);
    },
  });

  const removeLeaveMutation = useMutation({
    mutationFn: (staffLeaveId: string) => staffLeaveApi.remove(branch!.branchId, staffLeaveId),
    onSuccess: () => {
      invalidateLeaves();
      setPendingRemoveLeaveId(null);
    },
  });

  const createLeaveMutation = useMutation({
    mutationFn: (input: Parameters<typeof staffLeaveApi.create>[1]) =>
      staffLeaveApi.create(branch!.branchId, input),
    onSuccess: () => {
      invalidateLeaves();
      setActiveSheet(null);
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (input: Parameters<typeof shiftTemplateApi.create>[1]) =>
      shiftTemplateApi.create(branch!.branchId, input),
    onSuccess: () => {
      invalidateTemplates();
      setActiveSheet({ type: "templates", formTarget: null });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof shiftTemplateApi.update>[2] }) =>
      shiftTemplateApi.update(branch!.branchId, id, input),
    onSuccess: () => {
      invalidateTemplates();
      setActiveSheet({ type: "templates", formTarget: null });
    },
  });

  const activeTemplates = (templatesQuery.data ?? []).filter((t) => t.isActive);

  if (!branch) {
    return (
      <div className="p-8">
        <p className="rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">ตารางกะ</h1>
          <p className="mt-1 text-sm text-ink-muted">ตารางกะรายสัปดาห์ของสาขา {branch.branchName}</p>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setActiveSheet({ type: "templates", formTarget: null })}>
            จัดการแม่แบบกะ
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ◀ สัปดาห์ก่อน
        </Button>
        <span className="font-data tabular-nums text-sm text-ink">
          {dates[0]!.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} –{" "}
          {dates[6]!.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          สัปดาห์ถัดไป ▶
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          วันนี้
        </Button>
      </div>

      {canManage && (
        // ซ่อนบนมือถือ — ลากวางใช้ไม่ได้บนจอสัมผัส มือถือมอบหมายกะผ่านปุ่ม "+ มอบหมายกะ" ใน
        // MobileShiftView แทน (ดู docs/DESIGN.md §9.4)
        <div className="mb-4 hidden flex-wrap items-center gap-2 rounded-DEFAULT border border-dashed border-line-strong p-3 md:flex">
          <span className="text-xs text-ink-muted">ลากกะไปวางบนตารางเพื่อมอบหมาย:</span>
          {activeTemplates.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              className="cursor-grab rounded-DEFAULT border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink active:cursor-grabbing"
            >
              {t.name}{" "}
              <span className="font-data tabular-nums text-ink-muted">
                {minToTimeString(t.startMin)}-{minToTimeString(t.endMin)}
              </span>
            </div>
          ))}
          {activeTemplates.length === 0 && (
            <span className="text-xs text-brass">
              ยังไม่มีแม่แบบกะที่เปิดใช้งาน — กด &ldquo;จัดการแม่แบบกะ&rdquo; เพื่อสร้างก่อน
            </span>
          )}
        </div>
      )}

      {assignError && (
        <p role="alert" className="mb-4 rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {assignError}
        </p>
      )}

      {staffQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดตารางกะ">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {staffQuery.isSuccess && staffQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">ยังไม่มีพนักงานในสาขานี้ — เพิ่มพนักงานก่อนจัดตารางกะ</p>
        </div>
      )}

      {staffQuery.isSuccess && staffQuery.data.length > 0 && (
        <div className="hidden overflow-x-auto rounded-DEFAULT border border-line md:block">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
            <div className="border-b border-r border-line bg-surface-sunk p-2" />
            {dates.map((date, i) => (
              <div
                key={toDateKey(date)}
                className="border-b border-line bg-surface-sunk p-2 text-center text-xs font-medium text-ink-muted"
              >
                {weekdayLabel(i)}
                <div className="font-data tabular-nums text-ink">
                  {date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </div>
              </div>
            ))}

            {staffQuery.data.map((staff) => (
              <Fragment key={staff.id}>
                <div className="flex items-center border-b border-r border-line p-2 text-sm font-medium text-ink">
                  {staff.name}
                </div>
                {dates.map((date) => {
                  const dateKey = toDateKey(date);
                  const cellKey = `${staff.id}:${dateKey}`;
                  const cellShifts = (shiftsQuery.data ?? []).filter(
                    (s) => s.staffId === staff.id && isoToDateKey(s.date) === dateKey,
                  );
                  const cellLeave = (leavesQuery.data ?? []).find(
                    (l) => l.staffId === staff.id && isoToDateKey(l.date) === dateKey,
                  );

                  return (
                    <div
                      key={cellKey}
                      onDragOver={(e) => {
                        if (!canManage) return;
                        e.preventDefault();
                        setDropTargetKey(cellKey);
                      }}
                      onDragLeave={() => setDropTargetKey((k) => (k === cellKey ? null : k))}
                      onDrop={(e) => {
                        if (!canManage) return;
                        e.preventDefault();
                        setDropTargetKey(null);
                        const templateId = e.dataTransfer.getData("text/plain");
                        if (!templateId) return;
                        assignMutation.mutate({ staffId: staff.id, shiftTemplateId: templateId, date: dateKey });
                      }}
                      className={cn(
                        "min-h-[68px] border-b border-r border-line p-1",
                        dropTargetKey === cellKey && "bg-celadon-tint",
                      )}
                    >
                      {cellShifts.map((shift) =>
                        pendingRemoveShiftId === shift.id ? (
                          <div
                            key={shift.id}
                            className="mb-1 flex items-center justify-between gap-1 rounded-DEFAULT bg-rose-tint px-1.5 py-0.5 text-xs text-rose"
                          >
                            <span>ลบกะ?</span>
                            <span className="flex gap-1.5">
                              <button
                                type="button"
                                className="font-medium underline"
                                onClick={() => removeShiftMutation.mutate(shift.id)}
                              >
                                ลบ
                              </button>
                              <button type="button" onClick={() => setPendingRemoveShiftId(null)}>
                                ไม่
                              </button>
                            </span>
                          </div>
                        ) : (
                          <button
                            key={shift.id}
                            type="button"
                            disabled={!canManage}
                            onClick={() => setPendingRemoveShiftId(shift.id)}
                            className="mb-1 block w-full rounded-DEFAULT bg-indigo-tint px-1.5 py-0.5 text-left text-xs text-indigo hover:brightness-95 disabled:hover:brightness-100"
                          >
                            {shift.shiftTemplate.name}
                            <div className="font-data tabular-nums">
                              {minToTimeString(shift.startMin)}-{minToTimeString(shift.endMin)}
                            </div>
                          </button>
                        ),
                      )}

                      {cellLeave &&
                        (pendingRemoveLeaveId === cellLeave.id ? (
                          <div className="flex items-center justify-between gap-1 rounded-DEFAULT bg-rose-tint px-1.5 py-0.5 text-xs text-rose">
                            <span>ลบวันลา?</span>
                            <span className="flex gap-1.5">
                              <button
                                type="button"
                                className="font-medium underline"
                                onClick={() => removeLeaveMutation.mutate(cellLeave.id)}
                              >
                                ลบ
                              </button>
                              <button type="button" onClick={() => setPendingRemoveLeaveId(null)}>
                                ไม่
                              </button>
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => setPendingRemoveLeaveId(cellLeave.id)}
                            className="block w-full rounded-DEFAULT bg-rose-tint px-1.5 py-0.5 text-left text-xs text-rose"
                          >
                            {LEAVE_TYPE_LABEL[cellLeave.type]}
                          </button>
                        ))}

                      {canManage && !cellLeave && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSheet({
                              type: "leave",
                              defaults: defaultStaffLeaveValues(staff.id, date),
                            })
                          }
                          className="mt-1 text-[11px] text-ink-faint hover:text-ink-muted"
                        >
                          + ลา
                        </button>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {staffQuery.isSuccess && staffQuery.data.length > 0 && (
        <div className="md:hidden">
          <MobileShiftView
            staffList={staffQuery.data}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            dates={dates}
            shifts={shiftsQuery.data ?? []}
            leaves={leavesQuery.data ?? []}
            canManage={canManage}
            pendingRemoveShiftId={pendingRemoveShiftId}
            onRequestRemoveShift={setPendingRemoveShiftId}
            onConfirmRemoveShift={(id) => removeShiftMutation.mutate(id)}
            onCancelRemoveShift={() => setPendingRemoveShiftId(null)}
            pendingRemoveLeaveId={pendingRemoveLeaveId}
            onRequestRemoveLeave={setPendingRemoveLeaveId}
            onConfirmRemoveLeave={(id) => removeLeaveMutation.mutate(id)}
            onCancelRemoveLeave={() => setPendingRemoveLeaveId(null)}
            onOpenAssignSheet={(staffId, date) => setActiveSheet({ type: "assign", staffId, date })}
            onOpenLeaveSheet={(staffId, date) =>
              setActiveSheet({ type: "leave", defaults: defaultStaffLeaveValues(staffId, date) })
            }
          />
        </div>
      )}

      <Sheet
        open={activeSheet?.type === "assign"}
        onClose={() => setActiveSheet(null)}
        title="มอบหมายกะ"
      >
        {activeSheet?.type === "assign" && (
          <AssignShiftSheetBody
            templates={activeTemplates}
            onPick={(templateId) =>
              assignMutation.mutate({
                staffId: activeSheet.staffId,
                shiftTemplateId: templateId,
                date: toDateKey(activeSheet.date),
              })
            }
          />
        )}
      </Sheet>

      <Sheet
        open={activeSheet?.type === "templates"}
        onClose={() => setActiveSheet(null)}
        title={
          activeSheet?.type === "templates" && activeSheet.formTarget
            ? activeSheet.formTarget === "create"
              ? "เพิ่มแม่แบบกะ"
              : `แก้ไขแม่แบบกะ — ${activeSheet.formTarget.name}`
            : "แม่แบบกะ"
        }
      >
        {activeSheet?.type === "templates" &&
          activeSheet.formTarget &&
          (() => {
            const formTarget = activeSheet.formTarget!;
            return (
              <ShiftTemplateForm
                key={formTarget === "create" ? "create" : formTarget.id}
                initialValues={
                  formTarget === "create"
                    ? shiftTemplateDefaults(9 * 60, 18 * 60)
                    : shiftTemplateDefaults(formTarget.startMin, formTarget.endMin, formTarget.name)
                }
                submitLabel={formTarget === "create" ? "เพิ่มแม่แบบกะ" : "บันทึกการแก้ไข"}
                onCancel={() => setActiveSheet({ type: "templates", formTarget: null })}
                onSubmit={async (input) => {
                  if (formTarget === "create") {
                    await createTemplateMutation.mutateAsync(input);
                  } else {
                    await updateTemplateMutation.mutateAsync({ id: formTarget.id, input });
                  }
                }}
              />
            );
          })()}

        {activeSheet?.type === "templates" && !activeSheet.formTarget && (
          <div className="grid gap-3">
            {canManage && (
              <Button onClick={() => setActiveSheet({ type: "templates", formTarget: "create" })}>
                + เพิ่มแม่แบบกะ
              </Button>
            )}
            {(templatesQuery.data ?? []).length === 0 && (
              <p className="text-sm text-ink-muted">ยังไม่มีแม่แบบกะในสาขานี้</p>
            )}
            {(templatesQuery.data ?? []).map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between rounded-DEFAULT border border-line p-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{template.name}</p>
                  <p className="font-data tabular-nums text-xs text-ink-muted">
                    {minToTimeString(template.startMin)}-{minToTimeString(template.endMin)}
                  </p>
                  <span
                    className={
                      template.isActive
                        ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                        : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                    }
                  >
                    {template.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveSheet({ type: "templates", formTarget: template })}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={template.isActive ? "text-rose hover:bg-rose-tint" : undefined}
                      onClick={() =>
                        updateTemplateMutation.mutate({
                          id: template.id,
                          input: { isActive: !template.isActive },
                        })
                      }
                    >
                      {template.isActive ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet
        open={activeSheet?.type === "leave"}
        onClose={() => setActiveSheet(null)}
        title="บันทึกวันลา"
      >
        {activeSheet?.type === "leave" && (
          <StaffLeaveForm
            staff={staffQuery.data ?? []}
            initialValues={activeSheet.defaults}
            onCancel={() => setActiveSheet(null)}
            onSubmit={async (input) => {
              await createLeaveMutation.mutateAsync(input);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
