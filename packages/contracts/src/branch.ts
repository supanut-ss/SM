import { z } from "zod";

export const updateBranchSchema = z.object({
  name: z.string().min(1, "ชื่อสาขาห้ามว่าง").optional(),
  timezone: z.string().min(1, "เขตเวลาห้ามว่าง").optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
