"use client";

import { useCurrentBranch } from "../current-branch-context";
import { KpiSection } from "./kpi-section";
import { QueueSection } from "./queue-section";
import { ExpiringCoursesSection } from "./expiring-courses-section";
import { DormantCustomersSection } from "./dormant-customers-section";

/**
 * แดชบอร์ดหน้าแรก (T7.3) — 4 การ์ด แต่ละการ์ดดึงข้อมูลของตัวเองแยกกัน (useQuery คนละตัว) เพื่อไม่ให้การ์ด
 * ที่โหลดช้าที่สุดบล็อกทั้งหน้า ทุกการ์ดต้องกดต่อไปยังรายการจริงได้เสมอ (docs/PLAN.md T7.3 เกณฑ์ผ่าน
 * "ไม่มีการ์ดไหนที่กดไม่ได้")
 */
export function DashboardPageClient() {
  const branch = useCurrentBranch();

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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">แดชบอร์ด</h1>
        <p className="mt-1 text-sm text-ink-muted">ภาพรวมวันนี้ของสาขา {branch.branchName}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <KpiSection branchId={branch.branchId} />
        <QueueSection branchId={branch.branchId} />
        <ExpiringCoursesSection branchId={branch.branchId} />
        <DormantCustomersSection branchId={branch.branchId} />
      </div>
    </div>
  );
}
