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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include", // ส่ง/รับ httpOnly cookie เสมอ — same-origin ผ่าน rewrite ใน next.config.ts
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
 * ServiceVariant สด (แก้ราคาบริการทีหลังต้องไม่กระทบใบงานเก่า) */
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
  createdAt: string;
  updatedAt: string;
}

export const appointmentItemApi = {
  list: (branchId: string, date: string) =>
    apiFetch<AppointmentItem[]>(`/branches/${branchId}/appointment-items?date=${date}`),
  createWalkIn: (branchId: string, input: CreateWalkInAppointmentInput) =>
    apiFetch<AppointmentItem>(`/branches/${branchId}/appointment-items/walk-in`, {
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

export type { LinePaymentMethod, PaymentMethod };
