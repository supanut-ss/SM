import type {
  CreateRoomInput,
  CreateServiceInput,
  CreateServiceVariantInput,
  CreateShiftTemplateInput,
  CreateStaffInput,
  CreateStaffLeaveInput,
  CreateStaffShiftInput,
  CreateMemberInput,
  CreateMemberConsentInput,
  ConsentType,
  ConsentStatus,
  LeaveType,
  LoginInput,
  MeResponse,
  MergeMemberInput,
  StaffLevel,
  StaffSkill,
  UpdateRoomInput,
  UpdateServiceInput,
  UpdateServiceVariantInput,
  UpdateShiftTemplateInput,
  UpdateStaffInput,
  UpdateMemberInput,
  AppointmentStatus,
  AssignType,
  CreateAdvanceAppointmentInput,
  CreateWalkInAppointmentInput,
  JoinStaffQueueInput,
  RescheduleAppointmentItemInput,
  UpdateAppointmentItemStatusInput,
  CreatePackageInput,
  PackageType,
  UpdatePackageInput,
  ExpireMemberPackageInput,
  FreezeMemberPackageInput,
  MemberPackageLedgerKind,
  MemberPackageStatus,
  PurchaseMemberPackageInput,
  RefundMemberPackageInput,
  TransferMemberPackageInput,
  UseMemberPackageInput,
  CalculatePromotionsInput,
  CreateCouponInput,
  CreatePromotionInput,
  LinePaymentMethod,
  PaymentMethod,
  PromotionType,
  UpdateCouponInput,
  UpdatePromotionInput,
  BillLineKind,
  BillStatus,
  CancelBillInput,
  CheckoutBillInput,
  CloseCashierShiftInput,
  ReopenCashierShiftInput,
  VerifyManagerPinInput,
  ReopenPayrollPeriodInput,
} from "@lotus-desk/contracts";

/**
 * โยนเมื่อ fetch สำเร็จ (มี HTTP response) แต่ status ไม่ใช่ 2xx — เก็บ status ไว้ให้ผู้เรียกตัดสินใจต่อ
 * `body` คือ response JSON ดิบ (ถ้ามี) ใช้เมื่อ endpoint ส่งข้อมูลเพิ่มเติมมากับ error เช่น
 * รายชื่อสมาชิกที่เบอร์ซ้ำจาก MemberController.create (ดู docs/decisions.md ADR-014)
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ปกติเรียกผ่าน /api (same-origin, proxy ด้วย rewrite ใน next.config.ts) แต่ rewrite ไปโดเมน onrender.com
// ล้มเหลวเป็น DNS_HOSTNAME_RESOLVED_PRIVATE บน Vercel production เสมอ (ไม่ทราบสาเหตุแน่ชัดฝั่ง Vercel
// แก้ไม่ได้จากโค้ดฝั่งเรา — ดู docs/decisions.md ADR-054) จึงเรียกข้าม origin ตรงแทนเมื่อตั้ง
// NEXT_PUBLIC_API_URL ไว้ — ปลอดภัยเพราะ cookie เป็น sameSite=lax และ apps/web กับ apps/api เป็น
// subdomain ใน site เดียวกัน (drivetodev.online) ตามสเปก SameSite ถือเป็น same-site อยู่ดี
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // ส่ง/รับ httpOnly cookie เสมอ
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `เรียก API ไม่สำเร็จ (${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const authApi = {
  login: (input: LoginInput) =>
    apiFetch<{ id: string; email: string; name: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => apiFetch<MeResponse>("/auth/me"),
  logout: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
  // ยืนยัน PIN ผู้จัดการแบบ one-off (T5.6) — คืน approvalToken อายุสั้นมากไปแนบกับ endpoint ที่ต้องมี
  // PIN ผู้จัดการก่อน (ตอนนี้มีแค่ billApi.cancel) ดู docs/decisions.md ADR-030
  verifyManagerPin: (input: VerifyManagerPinInput) =>
    apiFetch<{ approvalToken: string }>("/auth/verify-manager-pin", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู BranchController.listUsers (T5.6) — ใช้เลือก "ผู้จัดการที่จะอนุมัติ" ตอนกรอก PIN ยกเลิกบิล */
export interface BranchUser {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
}

export const userApi = {
  list: (branchId: string) => apiFetch<BranchUser[]>(`/branches/${branchId}/users`),
};

/** shape ที่ apps/api ตอบกลับจริง (JSON — Date กลายเป็น string ISO แล้ว) ดู StaffController */
export interface StaffProfile {
  id: string;
  branchId: string;
  name: string;
  phone: string | null;
  level: StaffLevel;
  skills: StaffSkill[];
  startDate: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
}

export const staffApi = {
  list: (branchId: string, params?: StaffListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    const qs = query.toString();
    return apiFetch<StaffProfile[]>(`/branches/${branchId}/staff${qs ? `?${qs}` : ""}`);
  },
  create: (branchId: string, input: CreateStaffInput) =>
    apiFetch<StaffProfile>(`/branches/${branchId}/staff`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, staffId: string, input: UpdateStaffInput) =>
    apiFetch<StaffProfile>(`/branches/${branchId}/staff/${staffId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู RoomController — shape จริงที่ API ตอบกลับ (join roomType มาด้วยเสมอ) */
export interface RoomType {
  id: string;
  branchId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  branchId: string;
  roomTypeId: string;
  roomType: RoomType;
  name: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
}

export const roomTypeApi = {
  list: (branchId: string) => apiFetch<RoomType[]>(`/branches/${branchId}/room-types`),
};

export const roomApi = {
  list: (branchId: string, params?: RoomListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    const qs = query.toString();
    return apiFetch<Room[]>(`/branches/${branchId}/rooms${qs ? `?${qs}` : ""}`);
  },
  create: (branchId: string, input: CreateRoomInput) =>
    apiFetch<Room>(`/branches/${branchId}/rooms`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, roomId: string, input: UpdateRoomInput) =>
    apiFetch<Room>(`/branches/${branchId}/rooms/${roomId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู ServiceCategoryController — หมวดบริการ (catalog แยกต่อสาขา ไม่มี CRUD ของตัวเอง เหมือน RoomType) */
export interface ServiceCategory {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** ดู ServiceController — ตัวเลือกเวลาของบริการ (durationMin ต่างกัน คนละราคา คนละค่ามือ) */
export interface ServiceVariant {
  id: string;
  serviceId: string;
  durationMin: number;
  priceSatang: number;
  commissionJuniorSatang: number;
  commissionSeniorSatang: number;
  commissionMasterSatang: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  requiredSkill: StaffSkill;
  requiredRoomTypeId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** shape จริงที่ API ตอบกลับ (join category + variants มาด้วยเสมอ) */
export interface Service {
  id: string;
  branchId: string;
  categoryId: string;
  category: ServiceCategory;
  name: string;
  description: string | null;
  isActive: boolean;
  variants: ServiceVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
}

export const serviceCategoryApi = {
  list: (branchId: string) =>
    apiFetch<ServiceCategory[]>(`/branches/${branchId}/service-categories`),
};

export const serviceApi = {
  list: (branchId: string, params?: ServiceListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    const qs = query.toString();
    return apiFetch<Service[]>(`/branches/${branchId}/services${qs ? `?${qs}` : ""}`);
  },
  create: (branchId: string, input: CreateServiceInput) =>
    apiFetch<Service>(`/branches/${branchId}/services`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, serviceId: string, input: UpdateServiceInput) =>
    apiFetch<Service>(`/branches/${branchId}/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  addVariant: (branchId: string, serviceId: string, input: CreateServiceVariantInput) =>
    apiFetch<ServiceVariant>(`/branches/${branchId}/services/${serviceId}/variants`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateVariant: (
    branchId: string,
    serviceId: string,
    variantId: string,
    input: UpdateServiceVariantInput,
  ) =>
    apiFetch<ServiceVariant>(`/branches/${branchId}/services/${serviceId}/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู PackageController — คอร์ส/แพ็กเกจ (catalog เท่านั้น ยังไม่ใช่ยอดคงเหลือของลูกค้าคนใด — T5.2) */
export interface Package {
  id: string;
  branchId: string;
  name: string;
  type: PackageType;
  priceSatang: number;
  sessionCount: number | null;
  valueSatang: number | null;
  serviceVariantId: string | null;
  serviceVariant: (ServiceVariant & { service: { id: string; name: string } }) | null;
  validDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackageListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
}

export const packageApi = {
  list: (branchId: string, params?: PackageListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    const qs = query.toString();
    return apiFetch<Package[]>(`/branches/${branchId}/packages${qs ? `?${qs}` : ""}`);
  },
  create: (branchId: string, input: CreatePackageInput) =>
    apiFetch<Package>(`/branches/${branchId}/packages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, packageId: string, input: UpdatePackageInput) =>
    apiFetch<Package>(`/branches/${branchId}/packages/${packageId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู ShiftTemplateController — แม่แบบกะ (T2.4) เวลาเป็นนาทีจากเที่ยงคืน */
export interface ShiftTemplate {
  id: string;
  branchId: string;
  name: string;
  startMin: number;
  endMin: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** ดู StaffShiftController — การจ่ายกะจริงต่อวัน (join staff + shiftTemplate มาด้วยเสมอ) */
export interface StaffShift {
  id: string;
  branchId: string;
  staffId: string;
  staff: StaffProfile;
  shiftTemplateId: string;
  shiftTemplate: ShiftTemplate;
  date: string;
  startMin: number;
  endMin: number;
  createdAt: string;
  updatedAt: string;
}

/** ดู StaffLeaveController — วันลาของพนักงาน (join staff มาด้วยเสมอ) */
export interface StaffLeave {
  id: string;
  branchId: string;
  staffId: string;
  staff: StaffProfile;
  date: string;
  type: LeaveType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DateRangeParams {
  from: string;
  to: string;
}

export const shiftTemplateApi = {
  list: (branchId: string, isActive?: "true" | "false" | "all") => {
    const qs = isActive ? `?isActive=${isActive}` : "";
    return apiFetch<ShiftTemplate[]>(`/branches/${branchId}/shift-templates${qs}`);
  },
  create: (branchId: string, input: CreateShiftTemplateInput) =>
    apiFetch<ShiftTemplate>(`/branches/${branchId}/shift-templates`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, shiftTemplateId: string, input: UpdateShiftTemplateInput) =>
    apiFetch<ShiftTemplate>(`/branches/${branchId}/shift-templates/${shiftTemplateId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

export const staffShiftApi = {
  list: (branchId: string, params: DateRangeParams) =>
    apiFetch<StaffShift[]>(
      `/branches/${branchId}/staff-shifts?from=${params.from}&to=${params.to}`,
    ),
  create: (branchId: string, input: CreateStaffShiftInput) =>
    apiFetch<StaffShift>(`/branches/${branchId}/staff-shifts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (branchId: string, staffShiftId: string) =>
    apiFetch<StaffShift>(`/branches/${branchId}/staff-shifts/${staffShiftId}`, {
      method: "DELETE",
    }),
};

export const staffLeaveApi = {
  list: (branchId: string, params: DateRangeParams) =>
    apiFetch<StaffLeave[]>(
      `/branches/${branchId}/staff-leaves?from=${params.from}&to=${params.to}`,
    ),
  create: (branchId: string, input: CreateStaffLeaveInput) =>
    apiFetch<StaffLeave[]>(`/branches/${branchId}/staff-leaves`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (branchId: string, staffLeaveId: string) =>
    apiFetch<StaffLeave>(`/branches/${branchId}/staff-leaves/${staffLeaveId}`, {
      method: "DELETE",
    }),
};

/** ดู MemberController — shape จริงที่ API ตอบกลับ */
export interface Member {
  id: string;
  branchId: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  isActive: boolean;
  // ไม่ null แปลว่ารายการนี้เป็น "รายการรอง" ที่ถูกรวมเข้ากับสมาชิกอีกคนแล้ว (T3.4)
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
  marketingConsent?: "true" | "false";
}

/** payload ของ 409 จาก MemberController.create ตอนพบเบอร์ซ้ำ (ดู docs/decisions.md ADR-014) */
export interface MemberDuplicatePhoneConflict {
  message: string;
  duplicates: Array<{ id: string; code: string; name: string }>;
}

export const memberApi = {
  list: (branchId: string, params?: MemberListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    if (params?.marketingConsent) query.set("marketingConsent", params.marketingConsent);
    const qs = query.toString();
    return apiFetch<Member[]>(`/branches/${branchId}/members${qs ? `?${qs}` : ""}`);
  },
  get: (branchId: string, memberId: string) =>
    apiFetch<Member>(`/branches/${branchId}/members/${memberId}`),
  create: (branchId: string, input: CreateMemberInput) =>
    apiFetch<Member>(`/branches/${branchId}/members`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, memberId: string, input: UpdateMemberInput) =>
    apiFetch<Member>(`/branches/${branchId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  // memberId คือ "รายการรอง" ที่จะถูกปิดใช้งานและรวมประวัติเข้ากับ input.primaryMemberId (ดู T3.4)
  merge: (branchId: string, memberId: string, input: MergeMemberInput) =>
    apiFetch<Member>(`/branches/${branchId}/members/${memberId}/merge`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู MemberConsentController — shape จริงที่ API ตอบกลับ */
export interface MemberConsent {
  id: string;
  branchId: string;
  memberId: string;
  type: ConsentType;
  status: ConsentStatus;
  channel: string;
  textVersion: string;
  createdAt: string;
}

export const memberConsentApi = {
  list: (branchId: string, memberId: string) =>
    apiFetch<MemberConsent[]>(`/branches/${branchId}/members/${memberId}/consents`),
  create: (branchId: string, memberId: string, input: CreateMemberConsentInput) =>
    apiFetch<MemberConsent>(`/branches/${branchId}/members/${memberId}/consents`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู MemberPackageActionController — 1 แถว ledger (append-only เสมอ ดู CLAUDE.md ข้อ 7) */
export interface MemberPackageLedgerEntry {
  id: string;
  branchId: string;
  memberPackageId: string;
  kind: MemberPackageLedgerKind;
  delta: number;
  freezeDays: number | null;
  note: string | null;
  relatedEntryId: string | null;
  approvedByUserId: string | null;
  createdAt: string;
}

/** ดู MemberPackageController/MemberPackageActionController — คอร์สที่สมาชิกถือครองจริง (T5.2) */
export interface MemberPackage {
  id: string;
  branchId: string;
  memberId: string;
  packageId: string;
  name: string;
  type: PackageType;
  priceSatang: number;
  sessionCount: number | null;
  valueSatang: number | null;
  serviceVariantId: string | null;
  serviceVariant: (ServiceVariant & { service: { id: string; name: string } }) | null;
  purchasedAt: string;
  validDays: number;
  expiresAt: string;
  status: MemberPackageStatus;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberPackageDetail extends MemberPackage {
  ledgerEntries: MemberPackageLedgerEntry[];
}

export const memberPackageApi = {
  list: (branchId: string, memberId: string) =>
    apiFetch<MemberPackage[]>(`/branches/${branchId}/members/${memberId}/packages`),
  purchase: (branchId: string, memberId: string, input: PurchaseMemberPackageInput) =>
    apiFetch<MemberPackage>(`/branches/${branchId}/members/${memberId}/packages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  get: (branchId: string, memberPackageId: string) =>
    apiFetch<MemberPackageDetail>(`/branches/${branchId}/member-packages/${memberPackageId}`),
  use: (branchId: string, memberPackageId: string, input: UseMemberPackageInput) =>
    apiFetch<MemberPackage & { ledgerEntry: MemberPackageLedgerEntry }>(
      `/branches/${branchId}/member-packages/${memberPackageId}/use`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  refund: (branchId: string, memberPackageId: string, input: RefundMemberPackageInput) =>
    apiFetch<MemberPackage & { ledgerEntry: MemberPackageLedgerEntry }>(
      `/branches/${branchId}/member-packages/${memberPackageId}/refund`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  freeze: (branchId: string, memberPackageId: string, input: FreezeMemberPackageInput) =>
    apiFetch<MemberPackage & { ledgerEntry: MemberPackageLedgerEntry }>(
      `/branches/${branchId}/member-packages/${memberPackageId}/freeze`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  transfer: (branchId: string, memberPackageId: string, input: TransferMemberPackageInput) =>
    apiFetch<{ closed: MemberPackage; transferred: MemberPackage }>(
      `/branches/${branchId}/member-packages/${memberPackageId}/transfer`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  expire: (branchId: string, memberPackageId: string, input: ExpireMemberPackageInput) =>
    apiFetch<MemberPackage & { ledgerEntry: MemberPackageLedgerEntry }>(
      `/branches/${branchId}/member-packages/${memberPackageId}/expire`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};

/** ดู AppointmentItemController.list — shape จริงที่ API ตอบกลับ (join staff/room/serviceVariant/appointment) */
export interface AppointmentItem {
  id: string;
  branchId: string;
  appointmentId: string;
  appointment: { id: string; memberId: string | null; member: { id: string; name: string } | null; note: string | null };
  staffId: string;
  staff: StaffProfile;
  roomId: string;
  room: Room;
  serviceVariantId: string;
  serviceVariant: {
    id: string;
    durationMin: number;
    requiredSkill: StaffSkill;
    requiredRoomTypeId: string;
    service: { id: string; name: string };
  };
  status: AppointmentStatus;
  assignType: AssignType;
  startAt: string;
  endAt: string;
  roomCapacityAtBooking: number;
  createdAt: string;
  updatedAt: string;
  /** ดู ServiceJob model (T5.5) — มีค่าเฉพาะ endpoint ที่ include มาให้ (list()) เข้า IN_SERVICE แล้ว
   * เท่านั้นถึงจะไม่ null — endpoint อื่น (เช่น walk-in) ไม่มี key นี้เลย (ไม่ใช่ null) */
  serviceJob?: ServiceJob | null;
}

/** ดู ServiceJob model (T5.5) — snapshot ราคา/ค่ามือ/ระดับพนักงาน ณ เวลาเริ่มงาน ห้ามอ่านค่าปัจจุบันจาก
 * ServiceVariant สด (แก้ราคาบริการทีหลังต้องไม่กระทบใบงานเก่า) paymentMethod/memberPackageId ตัดสินใจตอน
 * เริ่มงาน (IN_SERVICE) แล้ว ไม่ใช่ตอนจบงาน (ดู docs/decisions.md ADR-046) */
export interface ServiceJob {
  id: string;
  branchId: string;
  appointmentItemId: string;
  staffId: string;
  roomId: string;
  serviceVariantId: string;
  assignType: AssignType;
  priceSatang: number;
  staffLevelAtJob: StaffLevel;
  commissionSatang: number;
  startedAt: string;
  completedAt: string | null;
  paymentMethod: PaymentMethod | null;
  /** ล็อกไว้ตอนเริ่มงานเมื่อ paymentMethod === "PACKAGE" เท่านั้น (ตัดยอดจริงยังเกิดตอน checkout เหมือนเดิม) */
  memberPackageId: string | null;
  /** มีค่าเฉพาะตอนที่ AppointmentItemController.list() include มาให้ — ใช้แสดงชื่อคอร์สแบบอ่านอย่างเดียว */
  memberPackage?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  /** มีค่าเฉพาะตอนที่ AppointmentItemController.list() include ให้ (ดู T5.6) — ไม่ null แปลว่าออกบิลไปแล้ว */
  billLine?: { id: string; billId: string } | null;
}

export const appointmentItemApi = {
  list: (branchId: string, date: string) =>
    apiFetch<AppointmentItem[]>(`/branches/${branchId}/appointment-items?date=${date}`),
  createWalkIn: (branchId: string, input: CreateWalkInAppointmentInput) =>
    apiFetch<AppointmentItem>(`/branches/${branchId}/appointment-items/walk-in`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createAdvance: (branchId: string, input: CreateAdvanceAppointmentInput) =>
    apiFetch<AppointmentItem>(`/branches/${branchId}/appointment-items/advance`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStatus: (branchId: string, appointmentItemId: string, input: UpdateAppointmentItemStatusInput) =>
    apiFetch<AppointmentItem>(`/branches/${branchId}/appointment-items/${appointmentItemId}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  reschedule: (branchId: string, appointmentItemId: string, input: RescheduleAppointmentItemInput) =>
    apiFetch<AppointmentItem>(`/branches/${branchId}/appointment-items/${appointmentItemId}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู StaffQueueController — shape จริงที่ API ตอบกลับ (join staff มาด้วย) */
export interface StaffQueueEntry {
  id: string;
  branchId: string;
  staffId: string;
  staff: StaffProfile;
  date: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const staffQueueApi = {
  list: (branchId: string, date: string) =>
    apiFetch<StaffQueueEntry[]>(`/branches/${branchId}/staff-queue?date=${date}`),
  join: (branchId: string, input: JoinStaffQueueInput) =>
    apiFetch<StaffQueueEntry>(`/branches/${branchId}/staff-queue/join`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู PromotionController — โปรโมชั่น (T5.4) ไม่มีฟิลด์ stackable เลย (ดู docs/DOMAIN.md ข้อ 15) */
export interface Promotion {
  id: string;
  branchId: string;
  name: string;
  type: PromotionType;
  priority: number;
  percentOff: number | null;
  amountOffSatang: number | null;
  fixedPriceSatang: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  bonusMinutes: number | null;
  minSpendSatang: number | null;
  serviceVariantIds: string[];
  daysOfWeek: number[];
  startMinuteOfDay: number | null;
  endMinuteOfDay: number | null;
  firstTimeCustomerOnly: boolean;
  birthdayMonthOnly: boolean;
  memberTiers: string[];
  quotaTotal: number | null;
  quotaUsed: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListParams {
  q?: string;
  isActive?: "true" | "false" | "all";
}

export const promotionApi = {
  list: (branchId: string, params?: PromotionListParams) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.isActive) query.set("isActive", params.isActive);
    const qs = query.toString();
    return apiFetch<Promotion[]>(`/branches/${branchId}/promotions${qs ? `?${qs}` : ""}`);
  },
  create: (branchId: string, input: CreatePromotionInput) =>
    apiFetch<Promotion>(`/branches/${branchId}/promotions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, promotionId: string, input: UpdatePromotionInput) =>
    apiFetch<Promotion>(`/branches/${branchId}/promotions/${promotionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู CouponController — ผูกกับโปรโมชั่นหนึ่งใบเสมอ ยังไม่มี logic การแลกใช้จริง */
export interface Coupon {
  id: string;
  branchId: string;
  promotionId: string;
  code: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const couponApi = {
  list: (branchId: string, promotionId: string) =>
    apiFetch<Coupon[]>(`/branches/${branchId}/promotions/${promotionId}/coupons`),
  create: (branchId: string, promotionId: string, input: CreateCouponInput) =>
    apiFetch<Coupon>(`/branches/${branchId}/promotions/${promotionId}/coupons`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (branchId: string, promotionId: string, couponId: string, input: UpdateCouponInput) =>
    apiFetch<Coupon>(`/branches/${branchId}/promotions/${promotionId}/coupons/${couponId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** ดู PromotionCalculatorController — หน้าทดลองคำนวณ (T5.4) ไม่บันทึกอะไรลง DB */
export interface PromotionApplication {
  promotionId: string;
  promotionName: string;
  discountSatang: number;
  bonusMinutes: number;
  reason: string;
}

export interface RejectedPromotion {
  promotionId: string;
  promotionName: string;
  reason: string;
}

export interface CalculatePromotionsResult {
  applied: PromotionApplication | null;
  rejected: RejectedPromotion[];
  couponError: string | null;
}

export const promotionCalculatorApi = {
  calculate: (branchId: string, input: CalculatePromotionsInput) =>
    apiFetch<CalculatePromotionsResult>(`/branches/${branchId}/promotions/calculate`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู BillController — บิล (T5.6) รวมใบงาน (ServiceJob) + รายการสินค้าอิสระ จ่ายได้หลายช่องทาง */
export interface BillLine {
  id: string;
  branchId: string;
  billId: string;
  kind: BillLineKind;
  serviceJobId: string | null;
  serviceJob:
    | (ServiceJob & { serviceVariant: { id: string; durationMin: number; service: { id: string; name: string } } })
    | null;
  description: string;
  priceSatang: number;
  quantity: number;
  paymentMethod: PaymentMethod;
  memberPackageId: string | null;
  memberPackageLedgerEntryId: string | null;
  createdAt: string;
}

export interface BillPayment {
  id: string;
  branchId: string;
  billId: string;
  method: PaymentMethod;
  amountSatang: number;
  tenderedSatang: number | null;
  createdAt: string;
}

export interface Bill {
  id: string;
  branchId: string;
  memberId: string | null;
  billNumber: string;
  subtotalSatang: number;
  promotionId: string | null;
  discountSatang: number;
  totalSatang: number;
  status: BillStatus;
  cancelledAt: string | null;
  cancelledReason: string | null;
  cancelledByUserId: string | null;
  lines: BillLine[];
  payments: BillPayment[];
  createdAt: string;
  updatedAt: string;
}

export const billApi = {
  list: (branchId: string, memberId?: string) =>
    apiFetch<Bill[]>(`/branches/${branchId}/bills${memberId ? `?memberId=${memberId}` : ""}`),
  get: (branchId: string, billId: string) => apiFetch<Bill>(`/branches/${branchId}/bills/${billId}`),
  checkout: (branchId: string, input: CheckoutBillInput) =>
    apiFetch<Bill>(`/branches/${branchId}/bills`, { method: "POST", body: JSON.stringify(input) }),
  cancel: (branchId: string, billId: string, input: CancelBillInput) =>
    apiFetch<Bill>(`/branches/${branchId}/bills/${billId}/cancel`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู CashierShiftController — รอบกะแคชเชียร์ (T5.7) closedAt null แปลว่ายังเปิดอยู่ */
export interface CashierShift {
  id: string;
  branchId: string;
  openedAt: string;
  openedByUserId: string;
  closedAt: string | null;
  closedByUserId: string | null;
  countedCashSatang: number | null;
  systemCashSatang: number | null;
  varianceSatang: number | null;
  varianceReason: string | null;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const cashierShiftApi = {
  list: (branchId: string) => apiFetch<CashierShift[]>(`/branches/${branchId}/cashier-shifts`),
  // ห่อด้วย { shift } เสมอฝั่ง server (ดู CashierShiftController.current) กัน res.json() พังตอน body ว่าง
  current: (branchId: string) =>
    apiFetch<{ shift: CashierShift | null }>(`/branches/${branchId}/cashier-shifts/current`),
  open: (branchId: string) =>
    apiFetch<CashierShift>(`/branches/${branchId}/cashier-shifts`, { method: "POST" }),
  close: (branchId: string, shiftId: string, input: CloseCashierShiftInput) =>
    apiFetch<CashierShift>(`/branches/${branchId}/cashier-shifts/${shiftId}/close`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reopen: (branchId: string, shiftId: string, input: ReopenCashierShiftInput) =>
    apiFetch<CashierShift>(`/branches/${branchId}/cashier-shifts/${shiftId}/reopen`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** ดู ReportsController.today (T7.2/T7.3) — คำนวณสดเสมอ ไม่มี cache ฝั่ง client ที่ตั้งใจให้ stale นาน */
export interface DailyStaffSummaryToday {
  staffId: string;
  scheduledMinutes: number;
  workedMinutes: number;
  jobCount: number;
  commissionSatang: number;
}

export interface TodayReport {
  date: string;
  recognizedRevenueSatang: number;
  cashInSatang: number;
  cashInPackageSatang: number;
  paymentCashSatang: number;
  paymentPackageSatang: number;
  paymentVoucherSatang: number;
  paymentComplimentarySatang: number;
  paymentTransferSatang: number;
  courseSoldCount: number;
  courseSoldValueSatang: number;
  courseUsedCount: number;
  newCustomerCount: number;
  returningCustomerCount: number;
  noShowCount: number;
  staffSummaries: DailyStaffSummaryToday[];
}

/** ดู ReportsController.coursesExpiring — MemberPackage (join member ด้วย) + balance ต่อยอด (T7.3 แดชบอร์ด) */
export interface ExpiringCoursePackage extends MemberPackage {
  member: { name: string; code: string };
}

/** ดู ReportsController.dormantCustomers — สมาชิกที่บิลล่าสุดเก่ากว่า N วัน (T7.3 แดชบอร์ด) */
export interface DormantCustomer {
  member: { id: string; name: string; phone: string; code: string };
  lastVisitAt: string;
  daysSinceLastVisit: number;
}

/** ดู ReportsController.dailySummary (T7.2) — 1 แถวต่อวัน อ่านจาก DailySummary ที่ cron ตี 2 pre-aggregate ไว้
 * (T7.1) ทุกฟิลด์เงินเป็นสตางค์ (CLAUDE.md ข้อ 2) date เป็น ISO string ("YYYY-MM-DDT00:00:00.000Z") */
export interface DailySummaryRow {
  id: string;
  branchId: string;
  date: string;
  recognizedRevenueSatang: number;
  cashInSatang: number;
  cashInPackageSatang: number;
  paymentCashSatang: number;
  paymentPackageSatang: number;
  paymentVoucherSatang: number;
  paymentComplimentarySatang: number;
  paymentTransferSatang: number;
  courseSoldCount: number;
  courseSoldValueSatang: number;
  courseUsedCount: number;
  newCustomerCount: number;
  returningCustomerCount: number;
  noShowCount: number;
  createdAt: string;
  updatedAt: string;
}

/** ผลรวมของ DailySummaryRow ทุกฟิลด์เงิน/จำนวนในช่วงที่เลือก (คำนวณฝั่ง ReportsController.sumDailySummaries) */
export type DailySummaryTotals = Omit<DailySummaryRow, "id" | "branchId" | "date" | "createdAt" | "updatedAt">;

export interface DailySummaryReport {
  days: DailySummaryRow[];
  totals: DailySummaryTotals;
}

/** ดู ReportsController.staffUtilization (T7.2) — 1 แถวต่อวันต่อพนักงาน join staff.name/level มาด้วยเสมอ */
export interface DailyStaffSummaryRow {
  id: string;
  branchId: string;
  date: string;
  staffId: string;
  staff: { name: string; level: StaffLevel };
  scheduledMinutes: number;
  workedMinutes: number;
  jobCount: number;
  commissionSatang: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffUtilizationReport {
  days: DailyStaffSummaryRow[];
}

export const reportsApi = {
  today: (branchId: string) => apiFetch<TodayReport>(`/branches/${branchId}/reports/today`),
  coursesExpiring: (branchId: string, withinDays?: number) =>
    apiFetch<ExpiringCoursePackage[]>(
      `/branches/${branchId}/reports/courses/expiring${withinDays ? `?withinDays=${withinDays}` : ""}`,
    ),
  dormantCustomers: (branchId: string, daysSinceLastVisit?: number) =>
    apiFetch<DormantCustomer[]>(
      `/branches/${branchId}/reports/customers/dormant${daysSinceLastVisit ? `?daysSinceLastVisit=${daysSinceLastVisit}` : ""}`,
    ),
  // ดู T7.4 — หน้ารายงาน: กราฟยอดขาย/ช่องทางชำระ + ตารางค่ามือ อ่านช่วงวันที่จาก URL query เสมอ
  dailySummary: (branchId: string, from: string, to: string) =>
    apiFetch<DailySummaryReport>(`/branches/${branchId}/reports/daily-summary?from=${from}&to=${to}`),
  staffUtilization: (branchId: string, from: string, to: string, staffId?: string) =>
    apiFetch<StaffUtilizationReport>(
      `/branches/${branchId}/reports/staff-utilization?from=${from}&to=${to}${staffId ? `&staffId=${staffId}` : ""}`,
    ),
};

/** ดู PayrollController — งวดจ่ายค่ามือ (T6.4) closedAt null แปลว่ายังเปิดอยู่ ตรง field ตาม schema.prisma */
export interface PayrollPeriod {
  id: string;
  branchId: string;
  periodStart: string;
  openedByUserId: string;
  periodEnd: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  reopenedAt: string | null;
  reopenedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** ดู PayrollController (close/summary) — join staff.name/level มาด้วยเสมอ */
export interface PayrollPeriodStaffSummary {
  id: string;
  branchId: string;
  payrollPeriodId: string;
  staffId: string;
  staff: { name: string; level: StaffLevel };
  jobCount: number;
  commissionSatang: number;
  tipSatang: number;
  deductionSatang: number;
  totalSatang: number;
  createdAt: string;
}

export interface PayrollPeriodWithSummaries extends PayrollPeriod {
  summaries: PayrollPeriodStaffSummary[];
}

export const payrollApi = {
  list: (branchId: string) => apiFetch<PayrollPeriod[]>(`/branches/${branchId}/payroll/periods`),
  // ห่อด้วย { period } เสมอฝั่ง server (ดู PayrollController.current) กัน res.json() พังตอน body ว่าง
  current: (branchId: string) =>
    apiFetch<{ period: PayrollPeriod | null }>(`/branches/${branchId}/payroll/periods/current`),
  open: (branchId: string) =>
    apiFetch<PayrollPeriod>(`/branches/${branchId}/payroll/periods`, { method: "POST" }),
  close: (branchId: string, periodId: string) =>
    apiFetch<PayrollPeriodWithSummaries>(`/branches/${branchId}/payroll/periods/${periodId}/close`, {
      method: "POST",
    }),
  reopen: (branchId: string, periodId: string, approvalToken: string) =>
    apiFetch<PayrollPeriod>(`/branches/${branchId}/payroll/periods/${periodId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ approvalToken } satisfies ReopenPayrollPeriodInput),
    }),
  summary: (branchId: string, periodId: string) =>
    apiFetch<PayrollPeriodWithSummaries>(`/branches/${branchId}/payroll/periods/${periodId}/summary`),
};

/** ดู AttendanceController.list — attendance.status/lateMinutes/earlyLeaveMinutes/otMinutes มาจาก
 * evaluateAttendance (packages/core) เสมอ ไม่คำนวณซ้ำฝั่ง client */
export type AttendanceStatus = "ON_TIME" | "LATE" | "LEFT_EARLY" | "LATE_AND_LEFT_EARLY" | "ABSENT" | "NO_SHIFT";

export interface AttendanceEvaluation {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
}

/** shape จริงที่ AttendanceController.list()/clockIn/clockOut ตอบกลับต่อแถว (T6.1) — 1 แถวต่อพนักงาน
 * ต่อวัน union ทั้งพนักงานที่มีกะและ/หรือมีรายการลงเวลาแล้ว (ไม่ list พนักงานที่ไม่มีทั้งคู่ในวันนั้น —
 * หน้าเว็บต้อง union เข้ากับ staffApi.list() เองถ้าอยากเห็นพนักงานที่ยังไม่มีรายการเลย) */
export interface AttendanceRow {
  staffId: string;
  staff: { name: string; level: StaffLevel } | null;
  shift: { startMin: number; endMin: number } | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  attendance: AttendanceEvaluation;
}

export const attendanceApi = {
  list: (branchId: string, date?: string, staffId?: string) => {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (staffId) query.set("staffId", staffId);
    const qs = query.toString();
    return apiFetch<AttendanceRow[]>(`/branches/${branchId}/attendance${qs ? `?${qs}` : ""}`);
  },
  // ไม่มีฟิลด์ pin เลย — หน้านี้เป็นโรสเตอร์ที่แคชเชียร์/เจ้าของลงเวลาแทนพนักงาน ไม่เก็บ PIN จากใครทั้งนั้น
  clockIn: (branchId: string, staffId: string) =>
    apiFetch<{ id: string; entry: unknown; attendance: AttendanceEvaluation }>(
      `/branches/${branchId}/attendance/clock-in`,
      { method: "POST", body: JSON.stringify({ staffId }) },
    ),
  clockOut: (branchId: string, staffId: string) =>
    apiFetch<{ id: string; entry: unknown; attendance: AttendanceEvaluation }>(
      `/branches/${branchId}/attendance/clock-out`,
      { method: "POST", body: JSON.stringify({ staffId }) },
    ),
};

export type { LinePaymentMethod, PaymentMethod };
