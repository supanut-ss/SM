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
