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

// RoomType ไม่มี isActive ในสคีมา (ดู docs/decisions.md ADR-010/ADR-062) — Room.roomTypeId และ
// ServiceVariant.requiredRoomTypeId อ้างอิงตรง ไม่มี soft delete จึงลบได้เฉพาะตอนไม่มีอะไรอ้างอิงอยู่
// (backend เช็คแล้วคืน 409 ถ้ามี — ดู room-type.controller.ts)
export const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อประเภทห้อง"),
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;

export const updateRoomTypeSchema = createRoomTypeSchema;

export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
