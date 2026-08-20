"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi } from "./api-client";

/** ข้อมูลผู้ใช้ + สาขา/บทบาท/สิทธิ์ปัจจุบัน — ใช้ตัดสินใจว่าจะโชว์เมนูไหน (T1.6) */
export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false, // 401 แปลว่ายังไม่ login — ไม่ต้อง retry ให้เสียเวลา
    staleTime: 60_000,
  });
}
