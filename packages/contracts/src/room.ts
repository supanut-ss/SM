import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อห้อง"),
  roomTypeId: z.string().min(1, "กรุณาเลือกประเภทห้อง"),
  capacity: z.coerce.number().int("ความจุต้องเป็นจำนวนเต็ม").min(1, "ความจุต้องมากกว่า 0"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateRoomFormInput = z.input<typeof createRoomSchema>;

export const updateRoomSchema = createRoomSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
