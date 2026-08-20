// ไม่ใช้ Zod เพราะนี่คือ response shape จาก backend ที่เราคุมเอง (ไม่ใช่ input จากผู้ใช้ที่ต้อง validate)
export interface MeBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  branches: MeBranch[];
}
