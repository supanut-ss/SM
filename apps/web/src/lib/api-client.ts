import type {
  CreateStaffInput,
  LoginInput,
  MeResponse,
  StaffLevel,
  StaffSkill,
  UpdateStaffInput,
} from "@lotus-desk/contracts";

/** โยนเมื่อ fetch สำเร็จ (มี HTTP response) แต่ status ไม่ใช่ 2xx — เก็บ status ไว้ให้ผู้เรียกตัดสินใจต่อ */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
    throw new ApiError(message, res.status);
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
