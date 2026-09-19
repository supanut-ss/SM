"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PROMOTION_TYPE_LABEL, type CreatePromotionInput, type UpdatePromotionInput } from "@lotus-desk/contracts";
import { Button, Fab, ListCard, ResponsiveList, Select, Sheet, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, SkeletonGroup } from "@lotus-desk/ui";
import type { ReactNode } from "react";
import { ApiError, promotionApi, serviceApi, type Promotion } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { CouponSection } from "./coupon-section";
import { PromotionEditForm } from "./promotion-edit-form";
import { PromotionForm } from "./promotion-form";

type ActiveFilter = "true" | "false" | "all";

function formatEffect(promo: Promotion): string {
  switch (promo.type) {
    case "PERCENT_OFF":
      return `ลด ${promo.percentOff}%`;
    case "AMOUNT_OFF":
      return `ลด ${formatSatang(promo.amountOffSatang ?? 0)}`;
    case "FIXED_PRICE":
      return `ราคาพิเศษ ${formatSatang(promo.fixedPriceSatang ?? 0)}`;
    case "BUY_X_GET_Y":
      return `ซื้อ ${promo.buyQuantity} แถม ${promo.getQuantity}`;
    case "BONUS_MINUTES":
      return `แถม ${promo.bonusMinutes} นาที`;
  }
}

export function PromotionPageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "promotion");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPromotionId, setDetailPromotionId] = useState<string | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const servicesQuery = useQuery({
    queryKey: ["services", branch?.branchId, "", "true"],
    queryFn: () => serviceApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId && createOpen,
  });

  const listQuery = useQuery({
    queryKey: ["promotions", branch?.branchId, debouncedQuery, activeFilter],
    queryFn: () =>
      promotionApi.list(branch!.branchId, { q: debouncedQuery || undefined, isActive: activeFilter }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePromotionInput) => promotionApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["promotions", branch?.branchId] });
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ promotionId, input }: { promotionId: string; input: UpdatePromotionInput }) =>
      promotionApi.update(branch!.branchId, promotionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["promotions", branch?.branchId] });
      setConfirmingDeactivateId(null);
    },
  });

  const detailPromotion = useMemo(
    () => listQuery.data?.find((p) => p.id === detailPromotionId) ?? null,
    [listQuery.data, detailPromotionId],
  );

  function renderPromoActions(promo: Promotion): ReactNode {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDetailPromotionId(promo.id)}>
          {canManage ? "แก้ไข" : "ดูรายละเอียด"}
        </Button>
        {canManage &&
          (confirmingDeactivateId === promo.id ? (
            <>
              <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ promotionId: promo.id, input: { isActive: false } })}
              >
                ปิดใช้งาน
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateId(null)}>
                ไม่ใช่
              </Button>
            </>
          ) : promo.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose hover:bg-rose-tint"
              onClick={() => setConfirmingDeactivateId(promo.id)}
            >
              ปิดใช้งาน
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ promotionId: promo.id, input: { isActive: true } })}
            >
              เปิดใช้งานอีกครั้ง
            </Button>
          ))}
      </>
    );
  }

  function renderPromoBadge(promo: Promotion): ReactNode {
    return (
      <span
        className={
          promo.isActive
            ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
            : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
        }
      >
        {promo.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
      </span>
    );
  }

  if (!branch) {
    return (
      <div className="p-8">
        <p className="text-pretty rounded-DEFAULT bg-brass-tint px-4 py-3 text-sm text-brass">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด — ติดต่อผู้จัดการหรือเจ้าของร้านเพื่อขอเพิ่มสิทธิ์การเข้าถึงสาขา
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-balance font-display text-2xl font-semibold text-ink">โปรโมชั่น</h1>
          <p className="text-pretty mt-1 text-sm text-ink-muted">รายการโปรโมชั่นของสาขา {branch.branchName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/promotions/calculator">
            <Button variant="secondary">หน้าทดลองคำนวณ</Button>
          </Link>
          {canManage && (
            <Button className="hidden md:inline-flex" onClick={() => setCreateOpen(true)}>
              + เพิ่มโปรโมชั่น
            </Button>
          )}
        </div>
      </div>

      {canManage && <Fab aria-label="เพิ่มโปรโมชั่น" onClick={() => setCreateOpen(true)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อโปรโมชั่น..."
          aria-label="ค้นหาโปรโมชั่น"
          className="h-9 w-64 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
        />
        <Select
          aria-label="กรองตามสถานะ"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="w-44"
        >
          <option value="true">เปิดใช้งาน</option>
          <option value="false">ปิดใช้งานแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
      </div>

      {listQuery.isLoading && (
        <SkeletonGroup label="กำลังโหลดรายการโปรโมชั่น">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </SkeletonGroup>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายการโปรโมชั่นไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-pretty text-sm text-ink-muted">
            {debouncedQuery
              ? `ไม่พบโปรโมชั่นที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีโปรโมชั่นที่ปิดใช้งาน"
                : "ยังไม่มีโปรโมชั่นในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              + เพิ่มโปรโมชั่นแรก
            </Button>
          )}
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length > 0 && (
        <ResponsiveList
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ผลลัพธ์</TableHead>
                  <TableHead>ลำดับ</TableHead>
                  <TableHead>โควตา</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell>{PROMOTION_TYPE_LABEL[promo.type]}</TableCell>
                    <TableCell className="font-data tabular-nums">{formatEffect(promo)}</TableCell>
                    <TableCell className="font-data tabular-nums">{promo.priority}</TableCell>
                    <TableCell className="font-data tabular-nums">
                      {promo.quotaTotal === null ? "ไม่จำกัด" : `${promo.quotaUsed} / ${promo.quotaTotal}`}
                    </TableCell>
                    <TableCell>{renderPromoBadge(promo)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">{renderPromoActions(promo)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          cards={listQuery.data.map((promo) => (
            <ListCard
              key={promo.id}
              title={promo.name}
              badge={renderPromoBadge(promo)}
              lines={[
                `${PROMOTION_TYPE_LABEL[promo.type]} · ${formatEffect(promo)}`,
                `ลำดับ ${promo.priority} · โควตา ${promo.quotaTotal === null ? "ไม่จำกัด" : `${promo.quotaUsed}/${promo.quotaTotal}`}`,
              ]}
              actions={renderPromoActions(promo)}
            />
          ))}
        />
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มโปรโมชั่นใหม่">
        <PromotionForm
          services={servicesQuery.data ?? []}
          submitLabel="เพิ่มโปรโมชั่น"
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
      </Sheet>

      <Sheet
        open={detailPromotion !== null}
        onClose={() => setDetailPromotionId(null)}
        title={detailPromotion ? detailPromotion.name : ""}
        description={canManage ? undefined : "ดูรายละเอียดเท่านั้น — ไม่มีสิทธิ์แก้ไขโปรโมชั่น"}
      >
        {detailPromotion && (
          <div className="grid gap-6">
            {canManage && (
              <PromotionEditForm
                initialValues={{
                  name: detailPromotion.name,
                  priority: detailPromotion.priority,
                  quotaTotal: detailPromotion.quotaTotal ?? "",
                }}
                onCancel={() => setDetailPromotionId(null)}
                onSubmit={async (values) => {
                  await updateMutation.mutateAsync({ promotionId: detailPromotion.id, input: values });
                }}
              />
            )}
            <CouponSection branchId={branch.branchId} promotionId={detailPromotion.id} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
