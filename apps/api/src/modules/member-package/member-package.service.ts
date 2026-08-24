import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@lotus-desk/db";
import { PrismaService } from "../../prisma/prisma.service";

/** บทบาทที่อนุมัติได้ (ใช้คอร์สหมดอายุ/แช่แข็ง/ปิดหมดอายุ) — เจ้าของ/ผู้จัดการเท่านั้น ไม่รวมแคชเชียร์ */
const APPROVER_ROLE_KEYS = new Set(["owner", "manager"]);

/**
 * ตรรกะร่วมของ ledger คอร์สที่สมาชิกถือครอง (T5.2) ใช้ร่วมกันระหว่าง MemberPackageController
 * (ซื้อ/ดูรายการ) และ MemberPackageActionController (ตัด/คืน/แช่แข็ง/โอน/ปิดหมดอายุ) — ตรรกะ "ถูกต้องไหม"
 * (business rule) อยู่ใน packages/core/member-package-ledger (pure function) ทั้งหมด ที่นี่มีแค่ส่วนที่
 * ต้องแตะ DB จริง (lock แถว, อ่านผลรวม, เช็คบทบาทผู้อนุมัติ) ดู docs/decisions.md ADR-026
 */
@Injectable()
export class MemberPackageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ล็อกแถว MemberPackage ระดับ transaction ก่อนอ่าน/เขียน ledger เสมอ — ป้องกัน race condition ตอนตัด
   * ยอดพร้อมกัน (เกณฑ์ผ่าน T5.2: "ตัดพร้อมกัน 2 request เหลือ 1 ครั้ง ต้องสำเร็จแค่รายการเดียว") request
   * ที่สองจะรอจน request แรก commit เสร็จก่อน แล้วค่อยอ่านยอดที่อัปเดตแล้วจริง (READ COMMITTED ของ
   * Postgres ก็เพียงพอ ไม่ต้องใช้ SERIALIZABLE) — ยอดคงเหลือยังคงอ่านจากผลรวม ledger เสมอ ไม่มีคอลัมน์
   * balance ที่ถูก UPDATE ตรงที่ไหนเลย (ดู CLAUDE.md ข้อ 7)
   */
  async lock(tx: Prisma.TransactionClient, memberPackageId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM member_packages WHERE id = ${memberPackageId} FOR UPDATE`;
  }

  async getBalance(
    tx: Prisma.TransactionClient | PrismaService["client"],
    memberPackageId: string,
  ): Promise<number> {
    const result = await tx.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId },
      _sum: { delta: true },
    });
    return result._sum.delta ?? 0;
  }

  async getFrozenDaysUsed(
    tx: Prisma.TransactionClient | PrismaService["client"],
    memberPackageId: string,
  ): Promise<number> {
    const result = await tx.memberPackageLedgerEntry.aggregate({
      where: { memberPackageId, kind: "FREEZE" },
      _sum: { freezeDays: true },
    });
    return result._sum.freezeDays ?? 0;
  }

  /** ต้องเป็น owner/manager ของสาขานี้เท่านั้นถึงจะอนุมัติได้ (ดู docs/DOMAIN.md ข้อ 5, 8) */
  async assertManagerApprover(branchId: string, approvedByUserId: string): Promise<void> {
    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId: approvedByUserId, branchId } },
      include: { role: true },
    });
    if (!userBranch || !APPROVER_ROLE_KEYS.has(userBranch.role.key)) {
      throw new ForbiddenException("ผู้อนุมัติต้องเป็นผู้จัดการหรือเจ้าของร้านของสาขานี้เท่านั้น");
    }
  }
}
