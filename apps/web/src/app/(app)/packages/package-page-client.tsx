"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PACKAGE_TYPE_LABEL, type CreatePackageInput, type UpdatePackageInput } from "@lotus-desk/contracts";
import {
  Button,
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
import { ApiError, packageApi, serviceApi, type Package } from "../../../lib/api-client";
import { formatSatang } from "../../../lib/format-money";
import { useCurrentBranch } from "../current-branch-context";
import { hasPermission } from "../permissions";
import { PackageEditForm } from "./package-edit-form";
import { PackageForm } from "./package-form";

type ActiveFilter = "true" | "false" | "all";

export function PackagePageClient() {
  const branch = useCurrentBranch();
  const queryClient = useQueryClient();
  const canManage = hasPermission(branch?.permissions ?? [], "manage", "package");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPackageId, setDetailPackageId] = useState<string | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const servicesQuery = useQuery({
    queryKey: ["services", branch?.branchId, "", "true"],
    queryFn: () => serviceApi.list(branch!.branchId, { isActive: "true" }),
    enabled: !!branch?.branchId,
  });

  const listQuery = useQuery({
    queryKey: ["packages", branch?.branchId, debouncedQuery, activeFilter],
    queryFn: () =>
      packageApi.list(branch!.branchId, { q: debouncedQuery || undefined, isActive: activeFilter }),
    enabled: !!branch?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreatePackageInput) => packageApi.create(branch!.branchId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["packages", branch?.branchId] });
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ packageId, input }: { packageId: string; input: UpdatePackageInput }) =>
      packageApi.update(branch!.branchId, packageId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["packages", branch?.branchId] });
      setConfirmingDeactivateId(null);
      setDetailPackageId(null);
    },
  });

  const serviceVariants = useMemo(
    () =>
      (servicesQuery.data ?? []).flatMap((service) =>
        service.variants
          .filter((v) => v.isActive)
          .map((v) => ({ ...v, service: { id: service.id, name: service.name } })),
      ),
    [servicesQuery.data],
  );

  const detailPackage = useMemo(
    () => listQuery.data?.find((p) => p.id === detailPackageId) ?? null,
    [listQuery.data, detailPackageId],
  );

  function renderPackageActions(pkg: Package): ReactNode {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDetailPackageId(pkg.id)}>
          {canManage ? "แก้ไข" : "ดูรายละเอียด"}
        </Button>
        {canManage &&
          (confirmingDeactivateId === pkg.id ? (
            <>
              <span className="self-center text-xs text-ink-muted">ยืนยัน?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ packageId: pkg.id, input: { isActive: false } })}
              >
                ปิดขาย
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateId(null)}>
                ไม่ใช่
              </Button>
            </>
          ) : pkg.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose hover:bg-rose-tint"
              onClick={() => setConfirmingDeactivateId(pkg.id)}
            >
              ปิดขาย
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ packageId: pkg.id, input: { isActive: true } })}
            >
              เปิดขายอีกครั้ง
            </Button>
          ))}
      </>
    );
  }

  function renderPackageBadge(pkg: Package): ReactNode {
    return (
      <span
        className={
          pkg.isActive
            ? "inline-flex rounded-DEFAULT bg-celadon-tint px-2 py-0.5 text-xs font-medium text-celadon"
            : "inline-flex rounded-DEFAULT bg-surface-sunk px-2 py-0.5 text-xs font-medium text-ink-faint"
        }
      >
        {pkg.isActive ? "เปิดขาย" : "ปิดขาย"}
      </span>
    );
  }

  function packageMeta(pkg: Package): string {
    if (pkg.type === "SESSION_COUNT") return `${pkg.sessionCount} ครั้ง · ${pkg.serviceVariant?.service.name}`;
    if (pkg.type === "VALUE") return `มูลค่า ${formatSatang(pkg.valueSatang ?? 0)}`;
    return `ไม่จำกัดครั้ง · ${pkg.serviceVariant?.service.name}`;
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
          <h1 className="font-display text-2xl font-semibold text-ink">คอร์ส/แพ็กเกจ</h1>
          <p className="mt-1 text-sm text-ink-muted">รายชื่อคอร์ส/แพ็กเกจของสาขา {branch.branchName}</p>
        </div>
        {canManage && <Button onClick={() => setCreateOpen(true)}>+ เพิ่มคอร์ส/แพ็กเกจ</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ค้นหาชื่อคอร์ส/แพ็กเกจ..."
          aria-label="ค้นหาคอร์ส/แพ็กเกจ"
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
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดรายชื่อคอร์ส/แพ็กเกจ">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-DEFAULT bg-surface-sunk" />
          ))}
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-DEFAULT bg-rose-tint px-4 py-3 text-sm text-rose">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : "โหลดรายชื่อคอร์ส/แพ็กเกจไม่สำเร็จ กรุณาลองใหม่"}
          <Button variant="secondary" size="sm" className="ml-3" onClick={() => void listQuery.refetch()}>
            ลองใหม่
          </Button>
        </div>
      )}

      {listQuery.isSuccess && listQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="text-sm text-ink-muted">
            {debouncedQuery
              ? `ไม่พบคอร์ส/แพ็กเกจที่ตรงกับ "${debouncedQuery}"`
              : activeFilter === "false"
                ? "ยังไม่มีคอร์ส/แพ็กเกจที่ปิดขาย"
                : "ยังไม่มีคอร์ส/แพ็กเกจในสาขานี้"}
          </p>
          {canManage && !debouncedQuery && activeFilter !== "false" && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              + เพิ่มคอร์ส/แพ็กเกจแรก
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
                  <TableHead>ราคา</TableHead>
                  <TableHead>เงื่อนไข</TableHead>
                  <TableHead>อายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>{PACKAGE_TYPE_LABEL[pkg.type]}</TableCell>
                    <TableCell className="font-data tabular-nums">{formatSatang(pkg.priceSatang)}</TableCell>
                    <TableCell className="font-data tabular-nums text-sm text-ink-muted">
                      {packageMeta(pkg)}
                    </TableCell>
                    <TableCell className="font-data tabular-nums">{pkg.validDays} วัน</TableCell>
                    <TableCell>{renderPackageBadge(pkg)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">{renderPackageActions(pkg)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          cards={listQuery.data.map((pkg) => (
            <ListCard
              key={pkg.id}
              title={pkg.name}
              badge={renderPackageBadge(pkg)}
              lines={[
                `${PACKAGE_TYPE_LABEL[pkg.type]} · ${formatSatang(pkg.priceSatang)}`,
                packageMeta(pkg),
                `อายุ ${pkg.validDays} วัน`,
              ]}
              actions={renderPackageActions(pkg)}
            />
          ))}
        />
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มคอร์ส/แพ็กเกจใหม่">
        <PackageForm
          serviceVariants={serviceVariants}
          submitLabel="เพิ่มคอร์ส/แพ็กเกจ"
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
        />
      </Sheet>

      <Sheet
        open={detailPackage !== null}
        onClose={() => setDetailPackageId(null)}
        title={detailPackage ? detailPackage.name : ""}
        description={
          canManage
            ? "แก้ไขได้เฉพาะชื่อ ราคา และอายุการใช้งาน — ประเภท/จำนวนครั้ง/มูลค่า/บริการที่ผูกไว้เปลี่ยนไม่ได้หลังสร้างแล้ว"
            : "ดูรายละเอียดเท่านั้น — ไม่มีสิทธิ์แก้ไขคอร์ส/แพ็กเกจ"
        }
      >
        {detailPackage && canManage && (
          <PackageEditForm
            initialValues={{
              name: detailPackage.name,
              priceBaht: detailPackage.priceSatang / 100,
              validDays: detailPackage.validDays,
            }}
            onCancel={() => setDetailPackageId(null)}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync({ packageId: detailPackage.id, input: values });
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
