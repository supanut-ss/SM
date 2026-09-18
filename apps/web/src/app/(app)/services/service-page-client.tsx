"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STAFF_SKILL_LABEL, type CreateServiceInput, type UpdateServiceInput } from "@lotus-desk/contracts";
import {
  Button,
  Fab,
  ListCard,
  ResponsiveList,
  Select,
  Sheet,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lotus-desk/ui";
import type { ReactNode } from "react";
import {
  ApiError,
  roomTypeApi,
  serviceApi,
  serviceCategoryApi,
  type Service,
  type ServiceVariant,
} from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { ServiceEditForm } from "./service-edit-form";
import { ServiceForm } from "./service-form";
import { ServiceVariantForm } from "./service-variant-form";
import { apiVariantToFormDefaults, EMPTY_VARIANT_FORM_VALUES } from "./variant-form-schema";

type ActiveFilter = "true" | "false" | "all";

export function ServicePageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "service");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailServiceId, setDetailServiceId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<"new" | string | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories", branch?.branchId],
    queryFn: () => serviceCategoryApi.list(branch!.branchId),
    enabled: !!branch?.branchId,
  });

  const roomTypesQuery = useQuery({
    queryKey: ["room-types", branch?.branchId],
    queryFn: () => roomTypeApi.list(branch!.branchId),
    enabled: !!branch?.branchId,
  });

  const listQuery = useQuery({
    queryKey: ["services", branch?.branchId, debouncedQuery, activeFilter],
    queryFn: () =>
      serviceApi.list(branch!.branchId, { q: debouncedQuery || undefined, isActive: activeFilter }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateServiceInput) => serviceApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services", branch?.branchId] });
      setCreateOpen(false);
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ serviceId, input }: { serviceId: string; input: UpdateServiceInput }) =>
      serviceApi.update(branch!.branchId, serviceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services", branch?.branchId] });
      setConfirmingDeactivateId(null);
    },
  });

  const addVariantMutation = useMutation({
    mutationFn: ({ serviceId, input }: { serviceId: string; input: Parameters<typeof serviceApi.addVariant>[2] }) =>
      serviceApi.addVariant(branch!.branchId, serviceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services", branch?.branchId] });
      setEditingVariant(null);
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({
      serviceId,
      variantId,
      input,
    }: {
      serviceId: string;
      variantId: string;
      input: Parameters<typeof serviceApi.updateVariant>[3];
    }) => serviceApi.updateVariant(branch!.branchId, serviceId, variantId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services", branch?.branchId] });
      setEditingVariant(null);
    },
  });

  const detailService = useMemo(
    () => listQuery.data?.find((s) => s.id === detailServiceId) ?? null,
    [listQuery.data, detailServiceId],
  );
  const roomTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const rt of roomTypesQuery.data ?? []) map.set(rt.id, rt.name);
    return map;
  }, [roomTypesQuery.data]);

  function closeDetail() {
    setDetailServiceId(null);
    setEditingVariant(null);
  }

  function renderServiceActions(service: Service): ReactNode {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDetailServiceId(service.id)}>
          {canManage ? "แก้ไข" : "ดูรายละเอียด"}
        </Button>
        {canManage &&
          (confirmingDeactivateId === service.id ? (
            <>
              <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={updateServiceMutation.isPending}
                onClick={() =>
                  updateServiceMutation.mutate({ serviceId: service.id, input: { isActive: false } })
                }
              >
                ปิดขาย
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateId(null)}>
                ไม่ใช่
              </Button>
            </>
          ) : service.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose hover:bg-rose-tint"
              onClick={() => setConfirmingDeactivateId(service.id)}
            >
              ปิดขาย
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={updateServiceMutation.isPending}
              onClick={() =>
                updateServiceMutation.mutate({ serviceId: service.id, input: { isActive: true } })
              }
            >
              เปิดขายอีกครั้ง
            </Button>
          ))}
      </>
    );
  }

  function renderServiceBadge(service: Service): ReactNode {
    return (
      <span
        className={
          service.isActive
            ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
            : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
        }
      >
        {service.isActive ? "เปิดขาย" : "ปิดขาย"}
      </span>
    );
  }

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
          <h1 className="font-display text-2xl font-semibold text-ink">บริการ</h1>
          <p className="mt-1 text-sm text-ink-muted">รายชื่อบริการและตัวเลือกเวลาของสาขา {branch.branchName}</p>
        </div>
        {canManage && (
          <Button className="hidden md:inline-flex" onClick={() => setCreateOpen(true)}>
            + เพิ่มบริการ
          </Button>
        )}
      </div>

      {canManage && <Fab aria-label="เพิ่มบริการ" onClick={() => setCreateOpen(true)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อบริการ..."
          aria-label="ค้นหาบริการ"
          className="h-9 w-64 rounded-DEFAULT border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-1"
        />
        <Select
          aria-label="กรองตามสถานะ"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="w-44"
        >
          <option value="true">เปิดขาย</option>
          <option value="false">ปิดขายแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </Select>
      </div>

      {listQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อบริการ">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายชื่อบริการไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">
            {debouncedQuery
              ? `ไม่พบบริการที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีบริการที่ปิดขาย"
                : "ยังไม่มีบริการในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              + เพิ่มบริการแรก
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
                  <TableHead>ชื่อบริการ</TableHead>
                  <TableHead>หมวด</TableHead>
                  <TableHead>ตัวเลือกเวลา</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.category.name}</TableCell>
                    <TableCell className="font-data tabular-nums">
                      {service.variants
                        .map((v) => `${v.durationMin}′ ${formatSatang(v.priceSatang)}`)
                        .join(" · ")}
                    </TableCell>
                    <TableCell>{renderServiceBadge(service)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">{renderServiceActions(service)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          cards={listQuery.data.map((service) => (
            <ListCard
              key={service.id}
              title={service.name}
              badge={renderServiceBadge(service)}
              lines={[
                service.category.name,
                service.variants.map((v) => `${v.durationMin}′ ${formatSatang(v.priceSatang)}`).join(" · "),
              ]}
              actions={renderServiceActions(service)}
            />
          ))}
        />
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มบริการใหม่">
        <ServiceForm
          categories={categoriesQuery.data ?? []}
          roomTypes={roomTypesQuery.data ?? []}
          submitLabel="เพิ่มบริการ"
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
      </Sheet>

      <Sheet
        open={detailService !== null}
        onClose={closeDetail}
        title={detailService ? detailService.name : ""}
        description={canManage ? undefined : "ดูรายละเอียดเท่านั้น — ไม่มีสิทธิ์แก้ไขบริการ"}
      >
        {detailService && (
          <div className="grid gap-6">
            {canManage && (
              <ServiceEditForm
                categories={categoriesQuery.data ?? []}
                initialValues={{
                  categoryId: detailService.categoryId,
                  name: detailService.name,
                  description: detailService.description ?? "",
                }}
                onCancel={closeDetail}
                onSubmit={async (values) => {
                  await updateServiceMutation.mutateAsync({ serviceId: detailService.id, input: values });
                }}
              />
            )}

            <div className="grid gap-3 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">ตัวเลือกเวลา</span>
                {canManage && editingVariant === null && (
                  <Button variant="secondary" size="sm" onClick={() => setEditingVariant("new")}>
                    + เพิ่มตัวเลือกเวลา
                  </Button>
                )}
              </div>

              {detailService.variants.map((variant: ServiceVariant) =>
                editingVariant === variant.id ? (
                  <div key={variant.id} className="rounded-DEFAULT border border-line p-3">
                    <ServiceVariantForm
                      roomTypes={roomTypesQuery.data ?? []}
                      initialValues={apiVariantToFormDefaults(variant)}
                      submitLabel="บันทึกการแก้ไข"
                      onCancel={() => setEditingVariant(null)}
                      onSubmit={async (input) => {
                        await updateVariantMutation.mutateAsync({
                          serviceId: detailService.id,
                          variantId: variant.id,
                          input,
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div key={variant.id} className="rounded-DEFAULT border border-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-1 text-sm">
                        <p className="font-data tabular-nums text-ink">
                          {variant.durationMin} นาที — {formatSatang(variant.priceSatang)}
                        </p>
                        <p className="text-xs text-ink-muted">
                          ค่ามือ: จูเนียร์ {formatSatang(variant.commissionJuniorSatang)} · ซีเนียร์{" "}
                          {formatSatang(variant.commissionSeniorSatang)} · มาสเตอร์{" "}
                          {formatSatang(variant.commissionMasterSatang)}
                        </p>
                        <p className="text-xs text-ink-muted">
                          ทักษะ: {STAFF_SKILL_LABEL[variant.requiredSkill]} · ห้อง:{" "}
                          {roomTypeNameById.get(variant.requiredRoomTypeId) ?? "-"}
                          {(variant.bufferBeforeMin > 0 || variant.bufferAfterMin > 0) &&
                            ` · buffer ${variant.bufferBeforeMin}/${variant.bufferAfterMin} นาที`}
                        </p>
                        <span
                          className={
                            variant.isActive
                              ? "inline-flex w-fit rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
                              : "inline-flex w-fit rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
                          }
                        >
                          {variant.isActive ? "เปิดขาย" : "ปิดขาย"}
                        </span>
                      </div>
                      {canManage && editingVariant === null && (
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingVariant(variant.id)}>
                            แก้ไข
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={variant.isActive ? "text-rose hover:bg-rose-tint" : undefined}
                            disabled={updateVariantMutation.isPending}
                            onClick={() =>
                              updateVariantMutation.mutate({
                                serviceId: detailService.id,
                                variantId: variant.id,
                                input: { isActive: !variant.isActive },
                              })
                            }
                          >
                            {variant.isActive ? "ปิดขาย" : "เปิดขายอีกครั้ง"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {editingVariant === "new" && (
                <div className="rounded-DEFAULT border border-line p-3">
                  <ServiceVariantForm
                    roomTypes={roomTypesQuery.data ?? []}
                    initialValues={EMPTY_VARIANT_FORM_VALUES}
                    submitLabel="เพิ่มตัวเลือกเวลา"
                    onCancel={() => setEditingVariant(null)}
                    onSubmit={async (input) => {
                      await addVariantMutation.mutateAsync({ serviceId: detailService.id, input });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
