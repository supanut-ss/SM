"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MEMBER_PACKAGE_LEDGER_KIND_LABEL, PACKAGE_TYPE_LABEL } from "@lotus-desk/contracts";
import { Button, Input, Label, Select } from "@lotus-desk/ui";
import {
  ApiError,
  memberApi,
  memberPackageApi,
  packageApi,
  type MemberPackage,
} from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";

function formatBalance(pkg: MemberPackage): string {
  if (pkg.type === "SESSION_COUNT") return `${pkg.balance} / ${pkg.sessionCount} ครั้ง`;
  if (pkg.type === "VALUE") return `${formatSatang(pkg.balance)} / ${formatSatang(pkg.valueSatang ?? 0)}`;
  return "ไม่จำกัดจำนวนครั้ง";
}

function formatExpiresAt(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * คอร์สที่สมาชิกถือครอง (T5.2) ในชีทแก้ไขสมาชิก — ครอบเฉพาะ ซื้อ/ตัดใช้/คืนยอด/โอน ที่ทำผ่านหน้านี้ได้
 * แช่แข็ง/ปิดหมดอายุ (manual EXPIRE) ต้องมีผู้จัดการอนุมัติเสมอ (ดู docs/DOMAIN.md ข้อ 5, 8) ซึ่งยังไม่มี
 * กลไกยืนยันตัวตนผู้จัดการในหน้าเว็บตอนนี้ (รอ PIN gate แบบเดียวกับ T5.6 ยกเลิกบิล) — ใช้ผ่าน API ได้
 * โดยตรงไปก่อน ดู docs/decisions.md ADR-026
 */
export function MemberPackageSection({ branchId, memberId }: { branchId: string; memberId: string }) {
  const queryClient = useQueryClient();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [actionTarget, setActionTarget] = useState<{ id: string; mode: "use" | "transfer" } | null>(null);
  const [useAmount, setUseAmount] = useState(1);
  const [transferToMemberId, setTransferToMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  // lazy initializer เรียกครั้งเดียวตอน mount ไม่ใช่ทุก render (React Compiler ห้ามเรียก Date.now() ตรง
  // ๆ ระหว่าง render — ดู react-hooks/purity) ความแม่นยำระดับวินาทีไม่จำเป็นสำหรับเช็ค "หมดอายุหรือยัง"
  const [now] = useState(() => Date.now());

  const memberPackagesKey = ["member-packages", branchId, memberId];

  const memberPackagesQuery = useQuery({
    queryKey: memberPackagesKey,
    queryFn: () => memberPackageApi.list(branchId, memberId),
  });

  const catalogQuery = useQuery({
    queryKey: ["packages", branchId, "", "true"],
    queryFn: () => packageApi.list(branchId, { isActive: "true" }),
    enabled: purchaseOpen,
  });

  const otherMembersQuery = useQuery({
    queryKey: ["members", branchId, "", "true"],
    queryFn: () => memberApi.list(branchId, { isActive: "true" }),
    enabled: actionTarget?.mode === "transfer",
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: memberPackagesKey });
    void queryClient.invalidateQueries({ queryKey: ["member-package-detail", branchId] });
  }

  const purchaseMutation = useMutation({
    mutationFn: () => memberPackageApi.purchase(branchId, memberId, { packageId: selectedPackageId }),
    onSuccess: () => {
      invalidate();
      setPurchaseOpen(false);
      setSelectedPackageId("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "ซื้อคอร์สไม่สำเร็จ กรุณาลองใหม่"),
  });

  const useMutationHook = useMutation({
    mutationFn: (memberPackageId: string) =>
      memberPackageApi.use(branchId, memberPackageId, { amount: useAmount }),
    onSuccess: () => {
      invalidate();
      setActionTarget(null);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "ตัดใช้คอร์สไม่สำเร็จ กรุณาลองใหม่"),
  });

  const refundLastUseMutation = useMutation({
    mutationFn: async (memberPackageId: string) => {
      const detail = await memberPackageApi.get(branchId, memberPackageId);
      const lastUse = detail.ledgerEntries.find((e) => e.kind === "USE");
      if (!lastUse) throw new ApiError("ไม่พบรายการตัดใช้ล่าสุดให้คืนยอด", 404);
      return memberPackageApi.refund(branchId, memberPackageId, {
        ledgerEntryId: lastUse.id,
        note: "ยกเลิกบิล",
      });
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "คืนยอดไม่สำเร็จ กรุณาลองใหม่"),
  });

  const transferMutation = useMutation({
    mutationFn: (memberPackageId: string) =>
      memberPackageApi.transfer(branchId, memberPackageId, { toMemberId: transferToMemberId }),
    onSuccess: () => {
      invalidate();
      setActionTarget(null);
      setTransferToMemberId("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "โอนคอร์สไม่สำเร็จ กรุณาลองใหม่"),
  });

  const activePackages = (catalogQuery.data ?? []).filter((p) => p.isActive);
  const otherMembers = (otherMembersQuery.data ?? []).filter((m) => m.id !== memberId);

  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">คอร์ส/แพ็กเกจของสมาชิก</span>
        <Button variant="secondary" size="sm" onClick={() => setPurchaseOpen((v) => !v)}>
          + ขายคอร์ส
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {purchaseOpen && (
        <div className="grid gap-2 rounded-DEFAULT border border-line p-3">
          <Label htmlFor="mp-purchase-select" className="text-xs font-normal">
            เลือกคอร์ส/แพ็กเกจ
          </Label>
          {catalogQuery.isLoading && <p className="text-xs text-ink-muted">กำลังโหลด...</p>}
          {catalogQuery.isSuccess && activePackages.length === 0 && (
            <p className="text-xs text-brass">สาขานี้ยังไม่มีคอร์ส/แพ็กเกจที่เปิดขายเลย</p>
          )}
          {activePackages.length > 0 && (
            <Select
              id="mp-purchase-select"
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
            >
              <option value="" disabled>
                -- เลือกคอร์ส/แพ็กเกจ --
              </option>
              {activePackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({PACKAGE_TYPE_LABEL[p.type]}) — {formatSatang(p.priceSatang)}
                </option>
              ))}
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPurchaseOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              disabled={!selectedPackageId || purchaseMutation.isPending}
              onClick={() => purchaseMutation.mutate()}
            >
              {purchaseMutation.isPending ? "กำลังบันทึก..." : "ยืนยันขาย"}
            </Button>
          </div>
        </div>
      )}

      {memberPackagesQuery.isLoading && <p className="text-xs text-ink-muted">กำลังโหลด...</p>}
      {memberPackagesQuery.isSuccess && memberPackagesQuery.data.length === 0 && (
        <p className="text-xs text-ink-muted">สมาชิกคนนี้ยังไม่มีคอร์ส/แพ็กเกจเลย</p>
      )}

      <div className="grid gap-2">
        {(memberPackagesQuery.data ?? []).map((pkg) => {
          const expired = new Date(pkg.expiresAt).getTime() < now;
          return (
            <div key={pkg.id} className="rounded-DEFAULT border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-sm font-medium text-ink">{pkg.name}</p>
                  <p className="font-data tabular-nums text-xs text-ink-muted">{formatBalance(pkg)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={
                        pkg.status === "ACTIVE"
                          ? "inline-flex w-fit rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                          : "inline-flex w-fit rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                      }
                    >
                      {pkg.status === "ACTIVE" ? "ใช้งานได้" : "ปิดแล้ว"}
                    </span>
                    {expired && pkg.status === "ACTIVE" && (
                      <span className="inline-flex w-fit rounded-DEFAULT bg-brass-tint px-2 py-0.5 text-xs font-medium text-brass">
                        หมดอายุ {formatExpiresAt(pkg.expiresAt)}
                      </span>
                    )}
                    {!expired && (
                      <span className="text-xs text-ink-faint">หมดอายุ {formatExpiresAt(pkg.expiresAt)}</span>
                    )}
                  </div>
                </div>
                {pkg.status === "ACTIVE" && !expired && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActionTarget({ id: pkg.id, mode: "use" });
                        setUseAmount(1);
                        setError(null);
                      }}
                    >
                      ตัดใช้
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={refundLastUseMutation.isPending}
                      onClick={() => refundLastUseMutation.mutate(pkg.id)}
                    >
                      คืนยอดล่าสุด
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActionTarget({ id: pkg.id, mode: "transfer" });
                        setTransferToMemberId("");
                        setError(null);
                      }}
                    >
                      โอนให้สมาชิกอื่น
                    </Button>
                  </div>
                )}
              </div>

              {actionTarget?.id === pkg.id && actionTarget.mode === "use" && (
                <div className="mt-3 grid gap-2 border-t border-line pt-3">
                  <Label htmlFor={`mp-use-amount-${pkg.id}`} className="text-xs font-normal">
                    {pkg.type === "VALUE" ? "จำนวนที่ตัด (สตางค์)" : "จำนวนครั้งที่ตัด"}
                  </Label>
                  <Input
                    id={`mp-use-amount-${pkg.id}`}
                    type="number"
                    min={1}
                    step={1}
                    value={useAmount}
                    onChange={(e) => setUseAmount(Number(e.target.value))}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setActionTarget(null)}>
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      disabled={useMutationHook.isPending}
                      onClick={() => useMutationHook.mutate(pkg.id)}
                    >
                      {useMutationHook.isPending ? "กำลังบันทึก..." : "ยืนยันตัดใช้"}
                    </Button>
                  </div>
                </div>
              )}

              {actionTarget?.id === pkg.id && actionTarget.mode === "transfer" && (
                <div className="mt-3 grid gap-2 border-t border-line pt-3">
                  <Label htmlFor={`mp-transfer-to-${pkg.id}`} className="text-xs font-normal">
                    โอนทั้งใบให้สมาชิก (โอนบางส่วนไม่ได้)
                  </Label>
                  {otherMembers.length === 0 ? (
                    <p className="text-xs text-ink-muted">ไม่มีสมาชิกอื่นในสาขานี้ให้โอนไป</p>
                  ) : (
                    <Select
                      id={`mp-transfer-to-${pkg.id}`}
                      value={transferToMemberId}
                      onChange={(e) => setTransferToMemberId(e.target.value)}
                    >
                      <option value="" disabled>
                        -- เลือกสมาชิก --
                      </option>
                      {otherMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </Select>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setActionTarget(null)}>
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      disabled={!transferToMemberId || transferMutation.isPending}
                      onClick={() => transferMutation.mutate(pkg.id)}
                    >
                      {transferMutation.isPending ? "กำลังโอน..." : "ยืนยันโอน"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(memberPackagesQuery.data ?? []).length > 0 && (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer">ประวัติ ledger ทั้งหมด</summary>
          <ul className="mt-2 grid gap-1">
            {(memberPackagesQuery.data ?? []).map((pkg) => (
              <MemberPackageLedgerHistory key={pkg.id} branchId={branchId} memberPackageId={pkg.id} name={pkg.name} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MemberPackageLedgerHistory({
  branchId,
  memberPackageId,
  name,
}: {
  branchId: string;
  memberPackageId: string;
  name: string;
}) {
  const detailQuery = useQuery({
    queryKey: ["member-package-detail", branchId, memberPackageId],
    queryFn: () => memberPackageApi.get(branchId, memberPackageId),
  });

  if (!detailQuery.data) return null;

  return (
    <li>
      <p className="font-medium text-ink">{name}</p>
      <ul className="ml-3 grid gap-0.5">
        {detailQuery.data.ledgerEntries.map((entry) => (
          <li key={entry.id} className="font-data tabular-nums">
            {new Date(entry.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} —{" "}
            {MEMBER_PACKAGE_LEDGER_KIND_LABEL[entry.kind]} ({entry.delta >= 0 ? "+" : ""}
            {entry.delta})
            {entry.note ? ` — ${entry.note}` : ""}
          </li>
        ))}
      </ul>
    </li>
  );
}
