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

---

## ADR-003: ปรับค่าสี 3 ตัวใน Design System ให้ผ่าน WCAG AA
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T0.5

บริบท: docs/DESIGN.md §3.7 กำหนดเป็นเกณฑ์ผ่านตายตัวว่า "คอนทราสต์ผ่าน WCAG AA (ตัวอักษรปกติ ≥ 4.5:1)" และ T0.5 เองก็มีเกณฑ์ผ่านชัดเจนว่า "คอนทราสต์ผ่าน AA ทุกคู่สี" ตอนสร้างหน้า `/dev/styleguide` จริงแล้วเปิดดูในเบราว์เซอร์พร้อมคำนวณ contrast ratio ของทุกคู่สีที่ใช้จริง (ไม่ใช่แค่เดา) พบว่าค่าสีที่ระบุไว้ในดราฟต์แรกของ §3.2 ไม่ผ่านเกณฑ์นี้ 3 จุด:

1. `--ink-faint` บนพื้น `--surface-sunk` (badge "เสร็จแล้ว"): light 2.63:1, dark 4.39:1 — ทั้งคู่ไม่ผ่าน 4.5:1
2. `--brass` บนพื้น `--brass-tint` (badge "เช็คอินแล้ว"): light 3.38:1 — ไม่ผ่าน (dark 6.44:1 ผ่านอยู่แล้ว ไม่แตะ)
3. ตัวอักษรขาวบนพื้น `--celadon` ทึบ (badge "กำลังบริการ" และปุ่ม primary): light 4.62:1 ผ่านฉิวเฉียด, dark 2.70:1 — ไม่ผ่านหนักมาก
4. ตัวอักษรขาวบนพื้น `--rose` ทึบ (ปุ่ม destructive): light 6.17:1 ผ่าน, dark 3.12:1 — ไม่ผ่าน

ทั้งข้อ 3 และ 4 มีสาเหตุเดียวกัน: `--celadon`/`--rose` โหมดมืดถูกออกแบบให้สว่างขึ้นสำหรับใช้เป็นสีตัวอักษร/เส้นขอบบนพื้นเข้ม ไม่ใช่พื้นทึบที่มีตัวอักษรขาวทับ

ตัดสินใจ:
- เข้ม `--ink-faint` โหมดสว่างจาก `#8B979C` เป็น `#626E73` (ผ่าน 4.5:1 ทุกพื้นผิวที่ใช้จริง)
- สว่าง `--ink-faint` โหมดมืดจาก `#6B7E7D` เป็น `#798D8C`
- เข้ม `--brass` โหมดสว่างจาก `#A8762F` เป็น `#8B6227`
- เพิ่ม token ใหม่ `--celadon-solid: #376D5F` และ `--rose-solid: #A63D4F` เป็นค่าคงที่ไม่สลับตามธีม ใช้เฉพาะพื้นทึบที่มีตัวอักษรขาวทับ (badge `in_service`, ปุ่ม `primary`/`destructive`) แทน `--celadon`/`--rose` ตรง ๆ — hover ของปุ่มเปลี่ยนจาก `hover:bg-celadon-hover` (token ที่สลับตามธีม) เป็น `hover:brightness-110` เพื่อให้ทำงานถูกต้องทั้งสองธีมโดยไม่ต้องมี token สีที่สามเพิ่ม

เหตุผล: การปรับทั้งหมดเป็นการเข้ม/สว่างขึ้นเล็กน้อยภายใน family สีเดิม (hue/saturation เดิม) ไม่เปลี่ยนโทนสีที่ตั้งใจไว้ ยังคงความรู้สึก "ศิลาดล" เหมือนเดิม แต่ทำให้อ่านออกได้จริงตามเกณฑ์ที่เอกสารเดียวกันกำหนดไว้ ถือเป็น bug fix ไม่ใช่การเปลี่ยนทิศทางดีไซน์

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือยกเว้นกฎ AA สำหรับ badge ที่ตั้งใจให้ "จาง" (completed/cancelled) — ปฏิเสธเพราะ T0.5 ระบุเกณฑ์ผ่านแบบไม่มีข้อยกเว้น และ "จาง" ทำได้ด้วยวิธีอื่น (ขนาด/น้ำหนักตัวอักษร) โดยไม่ต้องเสียการเข้าถึงได้

---

## ADR-004: packages/core, contracts, db ต้อง build เป็น dist/ ก่อน apps/api รันได้จริง
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T1.2

บริบท: ตั้งแต่ T0.1 `package.json#main`/`#types` ของ packages/core, packages/contracts, packages/db ชี้ไปที่ `./src/index.ts` (ซอร์ส TypeScript ตรง ๆ) ซึ่งใช้ได้กับ typecheck/Vitest/Next.js เพราะเครื่องมือพวกนี้แปลง TS ให้เองระหว่างรัน แต่ T1.2 เป็น Task แรกที่ apps/api `import` จริงจาก `@lotus-desk/contracts` และ `@lotus-desk/db` ตอน runtime — พอสั่ง `node dist/main.js` (คอมไพล์แล้วรันแบบ production) Node โหลด `.ts` ตรง ๆ ไม่ได้ ทำให้แอปพังทันทีตอน boot ด้วย `ERR_MODULE_NOT_FOUND`

ตัดสินใจ: เปลี่ยน `main`/`types` ของทั้ง 3 package ให้ชี้ไปที่ `./dist/index.js` / `./dist/index.d.ts` แทน แล้วเพิ่มให้แต่ละ package build จริง (`tsc`) ก่อนใช้งาน — packages/db แยก `tsconfig.build.json` ออกจาก `tsconfig.json` เพราะ typecheck ต้องครอบ `prisma/seed.ts` ด้วย (รันผ่าน `tsx` ตรง ๆ ไม่ต้อง compile) แต่ build (dist) ต้องมีแค่ `src/` เพิ่ม script `dev` (`tsc --watch`) ให้ทั้ง 3 package เพื่อให้ `pnpm dev` คอย build ให้สดอยู่เสมอระหว่างพัฒนา — turbo.json มี `typecheck`/`build` dependsOn `^build` อยู่แล้วตั้งแต่ T0.1 จึงไม่ต้องแก้ pipeline เพิ่ม

เหตุผล: เป็น bug เชิงโครงสร้างที่ไม่โผล่มาจนกว่าจะมี import ข้าม package จริงตอน runtime — พบเพราะ smoke-test บูตแอปจริงด้วย `node dist/main.js` ก่อนปิด Task ไม่ใช่แค่ปล่อยผ่านเพราะ `pnpm build`/`typecheck` เขียวหมด (สองอย่างนี้ตรวจไม่เจอปัญหานี้เลยเพราะไม่ได้รันไฟล์ที่ compile แล้วจริง ๆ)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือ bundle apps/api ด้วย webpack ให้ inline workspace dependency เข้าไปเลย — ปฏิเสธเพราะซับซ้อนเกินความจำเป็นตอนนี้ และรูปแบบ "build เป็น dist ก่อนใช้" เป็นมาตรฐานของ monorepo ทั่วไปอยู่แล้ว

---

## ADR-005: @casl/ability type resolution — แก้เฉพาะจุดด้วย tsconfig paths ไม่แตะ moduleResolution ทั้ง repo
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T1.4

บริบท: apps/api ใช้ `moduleResolution: "Node"` (แบบเก่า) ซึ่งไม่รู้จัก `package.json#exports` เลย `@casl/ability@7` มีแค่ `main` (CJS runtime ใช้ได้ปกติ) แต่ `.d.ts` อยู่หลัง `exports` map เท่านั้น ทำให้ typecheck หา type ไม่เจอ ลองเปลี่ยน `moduleResolution` เป็น `Node16`/`Bundler` ทั้ง config แล้วพัง — เพราะ apps/api (CommonJS) ต้อง import จาก packages/core, contracts, db, ui (ESM, `"type": "module"`) และ `Node16`/`NodeNext` module mode บังคับกฎ CJS/ESM interop ที่เข้มกว่าที่ Node runtime จริงรองรับ (Node 22+ รองรับ `require()` โมดูล ESM แบบ sync ได้อยู่แล้วซึ่งพิสูจน์แล้วจากการบูตจริงหลายรอบใน T1.2/T1.3) ส่วน `Bundler` resolution ใช้กับ `module: CommonJS` ไม่ได้เลย (TS5095)

ตัดสินใจ: คง `moduleResolution: "Node"` ทั้ง repo ไว้เหมือนเดิม แล้วเพิ่ม `compilerOptions.paths` ใน `apps/api/tsconfig.json` เท่านั้น ชี้ `"@casl/ability"` ไปที่ `./node_modules/@casl/ability/dist/types/index.d.ts` ตรง ๆ

เหตุผล: ปัญหาอยู่แค่ "TS หา .d.ts ไม่เจอ" ไม่ใช่ปัญหา runtime (runtime require ได้ปกติอยู่แล้วเพราะมี main field) แก้เฉพาะจุดที่พังจริงปลอดภัยกว่าเปลี่ยน module system ทั้ง repo ที่พิสูจน์แล้วว่าพังเป็นลูกโซ่

ผลกระทบ/ทางเลือกที่ไม่เลือก: ถ้ามี package อื่นในอนาคตที่มีปัญหาแบบเดียวกัน (exports-only types) ให้แก้ด้วย pattern เดียวกัน (เพิ่ม path ใน apps/api/tsconfig.json) แทนการไล่แก้ moduleResolution ทั้ง repo อีก

---

## ADR-006: guard ข้าม module ต้อง re-export ทั้ง provider และ dependency module ของมัน
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T1.4

บริบท: `BranchController` ใช้ `@UseGuards(JwtAuthGuard, PermissionGuard)` โดย `BranchModule` ไม่ได้ import `AuthModule` เอง (ตั้งใจให้พึ่ง `@Global()` แทน) ตอน boot จริงพบ `UnknownDependenciesException` บอกว่า `JwtService` (dependency ของ `JwtAuthGuard`) หาไม่เจอใน `BranchModule` — ทั้งที่ `AuthModule` มี `@Global()` และ `exports: [AuthService, JwtAuthGuard]` แล้ว เพราะ Nest resolve constructor ของ guard ที่เรียกผ่าน `@UseGuards(ClassRef)` ใหม่ในบริบทของ module ที่เรียกใช้ทุกครั้ง ไม่ได้ reuse instance จาก module เจ้าของ — ถ้า dependency ของ guard (ในที่นี้คือ `JwtModule`/`JwtService`) ไม่ได้ถูก re-export ออกมาด้วย ก็จะหาไม่เจอ แม้ตัว guard เองจะ export แล้วก็ตาม `typecheck`/`lint`/unit test ผ่านหมดตอนนั้น เจอบั๊กนี้จาก smoke-test บูตจริงเท่านั้น (รูปแบบเดียวกับ ADR-004)

ตัดสินใจ: มาร์ก `AuthModule` และ `RbacModule` เป็น `@Global()` (guard เป็น infrastructure ข้าม module ที่ทุก feature module ในอนาคตต้องใช้) และแก้ `AuthModule.exports` ให้มี `JwtModule` เพิ่มจากเดิมที่มีแค่ `[AuthService, JwtAuthGuard]`

เหตุผล: กันไม่ให้ต้องแก้ `imports` ของทุก feature module ในอนาคต (T1.5 เป็นต้นไป) ที่จะใช้ `@RequirePermission` — และเป็นการบันทึกไว้ว่า "export guard แล้วต้อง export dependency ของ guard นั้นด้วยเสมอ" เป็นกฎที่ต้องทำซ้ำทุกครั้งที่เพิ่ม guard ใหม่ที่มี constructor dependency

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือให้ทุก feature module import `AuthModule` + `RbacModule` เองแบบ explicit (ไม่พึ่ง @Global) — ปฏิเสธเพราะต้องแก้ทุกที่ที่ใช้ guard พวกนี้ซ้ำ ๆ ไปเรื่อย ๆ และง่ายต่อการลืม
