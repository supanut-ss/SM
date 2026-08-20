# Architecture Decision Records

บันทึกการตัดสินใจที่ **ไม่ได้ระบุไว้แล้ว** ใน `docs/PLAN.md` (หัวข้อ 1)
ทุก Task ที่ต้องตัดสินใจอะไรใหม่นอกเหนือจากที่ PLAN.md ล็อกไว้ ต้องเพิ่มรายการที่นี่ก่อน commit

รูปแบบ:

```
## ADR-001: <หัวข้อสั้นๆ>
วันที่: YYYY-MM-DD
Task ที่เกี่ยวข้อง: T#.#

บริบท: ...
ตัดสินใจ: ...
เหตุผล: ...
ผลกระทบ/ทางเลือกที่ไม่เลือก: ...
```

---

## ADR-001: เลื่อนเปิด Next.js `output: "standalone"` ไปที่ T9.1
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T0.1

บริบท: `docs/PLAN.md` ล็อกให้ apps/web ใช้ standalone output สำหรับ Docker multi-stage build (T9.1) เครื่องพัฒนาปัจจุบันเป็น Windows ที่ไม่ได้เปิด Developer Mode ทำให้ `next build` ล้มเหลวด้วย `EPERM: symlink` ตอน trace node_modules สำหรับ standalone output

ตัดสินใจ: ไม่ตั้งค่า `output: "standalone"` ใน `next.config.ts` ระหว่างพัฒนา (T0.1–T8.x) จะเปิดใช้ตอนทำ T9.1 (Dockerfile multi-stage) ซึ่งรันบน Linux container ที่ไม่มีข้อจำกัดเรื่อง symlink

เหตุผล: standalone output ไม่จำเป็นต่อการรัน `next dev`/`next build` ปกติระหว่างพัฒนา เป็น optimization สำหรับ production image เท่านั้น

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือเปิด Windows Developer Mode บนเครื่องพัฒนาทุกเครื่อง — ปฏิเสธเพราะเป็นการเปลี่ยนค่าระบบปฏิบัติการที่ต้องขอสิทธิ์ผู้ใช้ก่อน และไม่จำเป็นถ้าจะ build image จริงบน Linux/CI อยู่แล้ว

---

## ADR-002: ใช้ Prisma 6.19.3 แทน 7.x ล่าสุด
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T0.3

บริบท: `docs/PLAN.md` ล็อกแค่ "Prisma" เป็น ORM ไม่ได้ล็อก major version ตอนตั้งค่า Prisma 7.9.1 (เวอร์ชันล่าสุดบน npm ตอนนั้น) เพิ่งออกและมีการเปลี่ยนโครงสร้างค่อนข้างใหญ่ (บังคับใช้ `prisma.config.ts`, เปลี่ยน generator เริ่มต้นเป็น `prisma-client` ที่ไม่มี Rust engine, ย้าย `datasource.url` ออกจาก schema.prisma) เอกสารทางการยังไม่ครบถ้วนตอนตรวจสอบ (หลายหน้าไม่มีตัวอย่างที่สอดคล้องกัน)

ตัดสินใจ: ใช้ Prisma 6.19.3 (เวอร์ชันเสถียรล่าสุดของสาย 6.x) กับ generator `prisma-client-js` แบบดั้งเดิม และตั้งค่า seed ผ่าน `package.json#prisma.seed` แทน `prisma.config.ts`

เหตุผล: `packages/db` เป็นฐานรากที่ทุก Task ตั้งแต่ M1 เป็นต้นไปต้องพึ่งพา การใช้ major version ที่เพิ่งออกและเอกสารยังไม่นิ่งมีความเสี่ยงสูงเกินไปสำหรับ AI agent ที่ทำงานทีละ Task โดยไม่มีคนตรวจทุกบรรทัด Prisma 6.x เป็นเวอร์ชันที่ผ่านการใช้งานจริงมาอย่างกว้างขวางและมีเอกสาร/ตัวอย่างครบถ้วนกว่ามาก

ผลกระทบ/ทางเลือกที่ไม่เลือก: จะพลาดฟีเจอร์ query engine ใหม่ที่ไม่ใช้ Rust ของ Prisma 7 (เร็วกว่า/bundle เล็กกว่า) — ยอมรับได้เพราะยังไม่กระทบ correctness ถ้าต้องการอัปเกรดภายหลังให้เปิด Task แยกต่างหาก อย่าทำแทรกระหว่าง Task อื่น
