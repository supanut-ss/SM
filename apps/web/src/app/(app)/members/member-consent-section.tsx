"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CONSENT_CHANNELS,
  CONSENT_CHANNEL_LABEL,
  CONSENT_STATUS_LABEL,
  CONSENT_TYPE_LABEL,
  CONSENT_TYPES,
  type ConsentType,
} from "@lotus-desk/contracts";
import { Button, Input, Label, Select, Skeleton } from "@lotus-desk/ui";
import { ApiError, memberConsentApi, type MemberConsent } from "../../../lib/api-client";

interface RecordFormValues {
  channel: (typeof CONSENT_CHANNELS)[number];
  textVersion: string;
}

const EMPTY_RECORD_VALUES: RecordFormValues = { channel: "IN_PERSON", textVersion: "" };

/**
 * ส่วนบันทึกความยินยอม PDPA (T3.3) ในชีทแก้ไขสมาชิก — แสดงเฉพาะตอนแก้ไข (ต้องมี memberId จริงแล้ว)
 * บันทึกทุกครั้งเป็นแถวประวัติใหม่เสมอ (append-only) ไม่มีการแก้/ลบแถวเดิม (ดู docs/decisions.md ADR-016)
 */
export function MemberConsentSection({ branchId, memberId }: { branchId: string; memberId: string }) {
  const queryClient = useQueryClient();
  const [recordingType, setRecordingType] = useState<ConsentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<RecordFormValues>({
    defaultValues: EMPTY_RECORD_VALUES,
  });

  const consentsQuery = useQuery({
    queryKey: ["member-consents", branchId, memberId],
    queryFn: () => memberConsentApi.list(branchId, memberId),
  });

  const recordMutation = useMutation({
    mutationFn: (input: Parameters<typeof memberConsentApi.create>[2]) =>
      memberConsentApi.create(branchId, memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["member-consents", branchId, memberId] });
      // การให้/ถอนความยินยอมรับข่าวสารกระทบรายชื่อสมาชิกที่กรองด้วย marketingConsent ด้วย (T3.3 เกณฑ์ผ่าน)
      void queryClient.invalidateQueries({ queryKey: ["members", branchId] });
      setRecordingType(null);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่"),
  });

  // API คืนเรียงจากใหม่ไปเก่าอยู่แล้ว (orderBy createdAt desc) — แถวแรกที่เจอต่อประเภทคือสถานะปัจจุบัน
  const latestByType = new Map<ConsentType, MemberConsent>();
  for (const c of consentsQuery.data ?? []) {
    if (!latestByType.has(c.type)) latestByType.set(c.type, c);
  }

  function submitRecord(type: ConsentType, values: RecordFormValues) {
    const current = latestByType.get(type);
    const nextStatus = current?.status === "GRANTED" ? "WITHDRAWN" : "GRANTED";
    recordMutation.mutate({
      type,
      status: nextStatus,
      channel: values.channel,
      textVersion: values.textVersion,
    });
  }

  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <span className="text-sm font-medium text-ink">ความยินยอม (PDPA)</span>
      {consentsQuery.isLoading && (
        <Skeleton className="h-4 w-24" role="status" aria-label="กำลังโหลด" />
      )}

      {CONSENT_TYPES.map((type) => {
        const current = latestByType.get(type);
        const granted = current?.status === "GRANTED";
        return (
          <div key={type} className="rounded-DEFAULT border border-line p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-pretty text-sm text-ink">{CONSENT_TYPE_LABEL[type]}</p>
                <span
                  className={
                    granted
                      ? "inline-flex w-fit rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                      : "inline-flex w-fit rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                  }
                >
                  {current ? CONSENT_STATUS_LABEL[current.status] : "ยังไม่เคยบันทึก"}
                </span>
              </div>
              <Button
                variant={granted ? "ghost" : "secondary"}
                size="sm"
                className={granted ? "text-rose hover:bg-rose-tint" : undefined}
                onClick={() => {
                  reset(EMPTY_RECORD_VALUES);
                  setError(null);
                  setRecordingType(recordingType === type ? null : type);
                }}
              >
                {granted ? "ถอนความยินยอม" : "บันทึกความยินยอม"}
              </Button>
            </div>

            {recordingType === type && (
              <form
                onSubmit={handleSubmit((values) => submitRecord(type, values))}
                className="mt-3 grid gap-2 border-t border-line pt-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor={`consent-${type}-channel`} className="text-xs font-normal">
                      ช่องทาง
                    </Label>
                    <Select id={`consent-${type}-channel`} {...register("channel")}>
                      {CONSENT_CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {CONSENT_CHANNEL_LABEL[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`consent-${type}-version`} className="text-xs font-normal">
                      เวอร์ชันข้อความ
                    </Label>
                    <Input
                      id={`consent-${type}-version`}
                      {...register("textVersion", { required: "กรุณากรอกเวอร์ชันข้อความ" })}
                      placeholder="v1"
                    />
                    {formErrors.textVersion && (
                      <p className="text-pretty text-xs text-rose">{formErrors.textVersion.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRecordingType(null)}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" size="sm" disabled={recordMutation.isPending}>
                    {recordMutation.isPending
                      ? "กำลังบันทึก..."
                      : granted
                        ? "ยืนยันถอนความยินยอม"
                        : "ยืนยันการให้ความยินยอม"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {(consentsQuery.data ?? []).length > 0 && (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer">ดูประวัติทั้งหมด ({consentsQuery.data!.length})</summary>
          <ul className="mt-2 grid gap-1">
            {consentsQuery.data!.map((c) => (
              <li key={c.id} className="font-data tabular-nums">
                {new Date(c.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} —{" "}
                {CONSENT_TYPE_LABEL[c.type]}: {CONSENT_STATUS_LABEL[c.status]} (
                {CONSENT_CHANNEL_LABEL[c.channel as keyof typeof CONSENT_CHANNEL_LABEL] ?? c.channel},{" "}
                {c.textVersion})
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
