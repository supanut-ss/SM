# กติกาการทำงานใน repo นี้

## บริบท
ระบบหลังบ้านร้านสปา/นวด ผู้ใช้คือพนักงานต้อนรับ ผู้จัดการสาขา และเจ้าของร้าน
เอกสารที่ต้องอ่านก่อนเริ่มงาน: docs/PLAN.md, docs/DESIGN.md, docs/DOMAIN.md

## ขอบเขตงาน
- ทำเฉพาะ Task ที่ได้รับมอบหมาย ห้ามทำ Task ถัดไปล่วงหน้า
- ห้ามแก้ไฟล์นอกขอบเขตที่ Task ระบุ ถ้าจำเป็นต้องแก้ ให้หยุดแล้วอธิบายเหตุผลก่อน
- ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม
- ห้ามเปลี่ยนการตัดสินใจในหัวข้อ 1 ของ PLAN.md

## กฎเหล็กด้านโค้ด
1. `packages/core` เป็น pure function เท่านั้น — ห้าม import Prisma, Nest, React, fetch, Date.now()
   (เวลาปัจจุบันให้รับเป็น parameter เสมอ เพื่อให้ test ได้)
2. เงินเก็บเป็น integer หน่วยสตางค์ ตั้งชื่อฟิลด์ลงท้าย `Satang` เช่น `priceSatang`
   ห้ามใช้ Float หรือ parseFloat กับเงินทุกกรณี
3. เวลาเก็บเป็น timestamptz UTC แปลงเป็น Asia/Bangkok เฉพาะตอนแสดงผล
4. ห้ามใช้ `any` และห้าม `@ts-ignore` — ถ้าติดจริงให้หยุดแล้วถาม
5. ทุก query ที่แตะข้อมูลร้าน ต้องกรองด้วย branchId เสมอ ใช้ Prisma extension ที่มีอยู่แล้ว
   ห้ามเขียน raw query ที่ข้าม branch scope
6. ทุก mutation ต้องผ่าน AuditInterceptor — ห้ามเขียน service ที่เลี่ยง
7. ยอดคงเหลือของคอร์ส ห้าม UPDATE ตรง ต้อง INSERT ลง ledger แล้วอ่านผลรวม
8. Schema ที่ใช้ทั้งสองฝั่งต้องอยู่ใน packages/contracts เท่านั้น ห้าม copy type ข้ามแอป
9. UI ใช้ token จาก packages/ui เท่านั้น ห้ามเขียนค่า hex หรือ px ดิบใน component

## กฎเหล็กด้าน UI
- ใช้เฉพาะ CSS variable ที่ประกาศใน docs/DESIGN.md ห้ามสร้างสีใหม่
- ทุกหน้าต้องมี 4 สถานะ: loading (skeleton), empty (พร้อมคำแนะนำว่าทำอะไรต่อ), error (บอกวิธีแก้), success
- ข้อความ UI เป็นภาษาไทยทั้งหมด ใช้คำที่พนักงานร้านพูดจริง
- ทุก interactive element ต้องเข้าถึงด้วยคีย์บอร์ดได้

## ทุก Task ต้องจบด้วย
1. `pnpm verify` ผ่าน (lint + typecheck + test + build)
2. Unit test ครอบ business logic ใหม่ทุกเส้นทาง รวมเคสพัง
3. ถ้าแก้ Prisma schema → สร้าง migration + อัปเดต seed ให้ยังรันได้
4. ถ้าตัดสินใจอะไรที่ไม่มีใน PLAN.md → เขียนเพิ่มใน docs/decisions.md
5. commit เดียว รูปแบบ: `feat(booking): ...` / `fix(core): ...` พร้อมรหัส Task ในบรรทัดแรก

## เมื่อไม่แน่ใจ
หยุด แล้วถามพร้อมเสนอทางเลือก 2–3 ทางและข้อดีข้อเสีย
อย่าเดาแล้วเขียนต่อ — การเดาผิดในโดเมนนี้ทำให้เงินคลาดเคลื่อนจริง
