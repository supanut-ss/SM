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

---

## ADR-007: packages/db ต้องโหลด .env ของตัวเอง ห้ามพึ่ง @nestjs/config ฝั่ง apps/api
วันที่: 2026-08-20
Task ที่เกี่ยวข้อง: T1.5

บริบท: ระหว่างต่อ `APP_DATABASE_URL` (role ใหม่ที่ REVOKE UPDATE/DELETE บน audit_logs — ดู migration `20260820213921_audit_log_protection`) เข้ากับ `packages/db/src/index.ts` ใส่ diagnostic log ชั่วคราวแล้วพบว่า `process.env.DATABASE_URL` และ `APP_DATABASE_URL` เป็น `undefined` ทั้งคู่ตอนที่ `new PrismaClient(...)` ทำงานจริง แม้จะมีไฟล์ `.env` อยู่ที่ root แล้วก็ตาม

สาเหตุ: `apps/api` import `@lotus-desk/db` ผ่าน static import chain (app.module.ts -> prisma.module.ts -> prisma.service.ts -> @lotus-desk/db) ซึ่งตาม spec ของ ES module ทุก `import` ถูก hoist และ evaluate ให้เสร็จก่อนโค้ดระดับบนสุดของไฟล์ที่ import มันเองจะรัน — หมายความว่า `packages/db`'s module-level `new PrismaClient()` รันไปแล้ว **ก่อน** ที่ `app.module.ts`'s `@Module({imports:[ConfigModule.forRoot({...})]})` (ซึ่งเป็นจุดที่ `@nestjs/config` โหลด `.env` จริง) จะได้ทำงานด้วยซ้ำ บั๊กนี้แฝงอยู่ตั้งแต่ T0.3 แต่ไม่เคยโผล่มาก่อนเพราะไม่เคยมี DB จริงให้เชื่อมต่อ (ทุก smoke test ที่ผ่านมาแค่เช็คว่าแอปบูตได้ ไม่เคยเช็คว่า query จริงไปถูกปลายทาง)

ตัดสินใจ: เพิ่ม `dotenv` เป็น dependency ตรงของ `packages/db` แล้วเรียก `loadDotenv({ path: ... })` เองที่ต้นไฟล์ `packages/db/src/index.ts` ชี้ไปที่ `.env` ที่ root repo ตรง ๆ (คำนวณ path จาก `import.meta.url`) ก่อนสร้าง `PrismaClient` — ไม่พึ่งพาว่าใครจะ import แล้วโหลด env ให้ก่อนอีกต่อไป

เหตุผล: `packages/db` ต้องรับผิดชอบ config ของตัวเองให้ครบ ไม่ควรพึ่งพาลำดับการ import ของ consumer (apps/api ตอนนี้, แอปอื่นในอนาคตอาจ import ต่างลำดับ) `dotenv` ไม่ทับค่าที่ `process.env` มีอยู่แล้ว จึงไม่ชนกับ Testcontainers e2e test ที่ set `process.env.DATABASE_URL` เองก่อน `await import("@lotus-desk/db")` แบบ dynamic

ผลกระทบ/ทางเลือกที่ไม่เลือก: นี่หมายความว่า T0.3–T1.4 ทุก task ที่ผ่านมามี PrismaClient singleton ที่ไม่เคยได้ DATABASE_URL จริงตอน boot เลย (รอด เพราะไม่เคยมี live DB ให้ต้องต่อจริง) — ไม่ต้องแก้ย้อนหลังเพราะ fix นี้อยู่ที่ packages/db จุดเดียวและมีผลย้อนไปถึงพฤติกรรมของทุก task ก่อนหน้าโดยอัตโนมัติ ไม่ต้องแตะโค้ด T0.3–T1.4

---

## ADR-008: ค่ามือ (commission) ตั้งเป็นฟิลด์บน ServiceVariant โดยตรง ไม่ใช้ตารางเรตกลางแยกต่างหาก
วันที่: 2026-08-21
Task ที่เกี่ยวข้อง: T2.3 (ยังไม่เริ่ม — บันทึกไว้ล่วงหน้าเพื่อกำหนดทิศทาง schema)

บริบท: `docs/DOMAIN.md` ข้อ 9/10 เดิมตอบไว้กว้างๆ ว่าค่ามือเป็น "เหมาต่อชั่วโมง แยกเรตตามระดับพนักงาน" โดยไม่ได้ระบุว่าเก็บที่ไหนใน schema — เจ้าของร้านชี้แจงเพิ่มเติมว่าต้องการตั้งค่ามือ "ต่อคอร์ส/บริการ" โดยตรง ไม่ใช่คำนวณจากตารางเรตกลาง (rate table) ที่แยกมิติ เช่น ประเภทบริการ × ระดับพนักงาน × ชั่วโมงสะสม

ตัดสินใจ:
- ค่ามือเป็น **บาทคงที่ต่อครั้ง** (ไม่ใช่ % ของราคา, ไม่ใช่เหมาต่อชั่วโมง) เก็บเป็น integer สตางค์ตามกฎเงินใน CLAUDE.md
- เก็บบน `ServiceVariant` โดยตรง เป็น 3 ฟิลด์: `commissionJuniorSatang`, `commissionSeniorSatang`, `commissionMasterSatang` (หนึ่งค่าต่อระดับพนักงาน)
- ค่าเดียวกันไม่ว่างานจะมาจากคิวหมุนหรือลูกค้าขอ (ไม่มีฟิลด์แยกตาม assignType)
- ตัดคอร์ส (ข้อ 10) ใช้เรตเดียวกันนี้ ไม่มีตารางเรตแยกต่างหากสำหรับกรณีตัดคอร์ส

เหตุผล: การผูกค่ามือไว้กับบริการโดยตรงตรงกับกฎเหล็กข้อ T5.5 ("snapshot ราคาและอัตราค่ามือ ณ เวลานั้น") อยู่แล้ว — ใบงานจะ snapshot ค่าจาก ServiceVariant ตรงๆ ได้โดยไม่ต้อง join ตารางเรตกลางเพิ่ม ลดความซับซ้อนของ `packages/core/commission` เพราะรับค่ามือมาเป็น input ตรงๆ แทนที่จะต้องมี lookup logic เอง

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือตารางเรตกลางแยกต่างหาก (เช่น `CommissionRate` model ผูก serviceId+staffLevel+assignType) — ปฏิเสธเพราะเจ้าของร้านยืนยันชัดเจนว่าไม่ต้องการแยกเรตตาม assignType และการตั้งค่าต่อบริการตรงๆ ตรงกับวิธีที่ร้านคิดค่ามือจริง (ต่อบริการ ไม่ใช่ต่อกฎ) — Task T2.3 ต้องเพิ่ม 3 ฟิลด์นี้ลง schema ตอนเริ่มงานจริง ยังไม่ได้แก้ Prisma schema ณ วันที่บันทึก ADR นี้ ตัวเลขค่ามือจริงยังไม่มี (บล็อก T6.2 ตามเดิม)

---

## ADR-009: e2e spec ทุกไฟล์ต้องตั้ง `APP_DATABASE_URL` เอง ไม่ใช่แค่ `DATABASE_URL`
วันที่: 2026-08-21
Task ที่เกี่ยวข้อง: T2.1

บริบท: ระหว่างรัน `apps/api/src/modules/staff/test/staff.e2e-spec.ts` (Testcontainers) ครั้งแรกจริงบนเครื่องนี้ (ก่อนหน้านี้ทุก e2e spec ไม่เคยรันจริงเพราะไม่มี Docker backend — ดูคอมเมนต์เดิมในไฟล์พวกนี้) เจอ `Unique constraint failed on the fields: (key)` ตอนสร้าง permission "staff:view" ทั้งที่ container Postgres เพิ่งสร้างใหม่ว่างเปล่า

สาเหตุ: `packages/db/src/index.ts` สร้าง `PrismaClient` ด้วย `datasourceUrl: process.env.APP_DATABASE_URL || process.env.DATABASE_URL` (T1.5 — ดู ADR ที่เกี่ยวข้อง) — `auth.e2e-spec.ts` และ `rbac.e2e-spec.ts` (ต้นแบบที่ `staff.e2e-spec.ts` ก็อปมา) ตั้งแค่ `process.env.DATABASE_URL = databaseUrl` ก่อน import `@lotus-desk/db` เท่านั้น ไม่เคยตั้ง `APP_DATABASE_URL` เพราะแต่ก่อนไม่มีไฟล์ `.env` จริงที่ root repo เลย (`APP_DATABASE_URL` เป็น `undefined` เสมอ จึง fallback ไป `DATABASE_URL` ของ container โดยบังเอิญ) พอเริ่มมี `.env` จริงสำหรับพัฒนาเครื่องนี้ (ตั้งค่า `APP_DATABASE_URL` ชี้ไป DB dev จริงที่ port 5532 — ดู T0.2) `packages/db`'s `loadDotenv()` (ไม่ทับค่าที่มีอยู่แล้วก็จริง แต่ `APP_DATABASE_URL` ยังไม่เคยถูกตั้งเลยในกระบวนการนี้) จึงเซ็ตมันจาก `.env` แทน — ทำให้ `datasourceUrl` เลือก `APP_DATABASE_URL` (DB dev จริง ที่มี "staff:view" seed ไว้แล้ว) แทน `DATABASE_URL` ของ container ทดสอบเงียบ ๆ โดยไม่มี error เตือนเลย

ตัดสินใจ: เพิ่ม `process.env.APP_DATABASE_URL = databaseUrl;` (ค่าเดียวกับ `DATABASE_URL` ของ container) ในทุก e2e spec ที่ยังไม่ได้ตั้งไว้เอง (`auth.e2e-spec.ts`, `rbac.e2e-spec.ts`, `staff.e2e-spec.ts`) ก่อน import `@lotus-desk/db` เสมอ — `audit.e2e-spec.ts` ไม่ต้องแก้เพราะตั้ง `APP_DATABASE_URL` ของตัวเองอยู่แล้ว (ชี้ไป role `lotus_app` โดยตั้งใจเพื่อทดสอบ REVOKE)

เหตุผล: เป็นบั๊กแฝงที่ไม่มีทางเจอด้วย `pnpm verify` เพราะ e2e ไม่อยู่ใน pipeline นั้น (ดู `apps/api/vitest.config.mts`) และไม่เคยโผล่มาก่อนเพราะไม่มีเครื่องไหนเคยมี `.env` จริงตอนรัน e2e เลย — อันตรายเพราะถ้าไม่แก้ นักพัฒนาที่มี `.env` dev จริง (กรณีปกติของทุกคนที่ตั้งเครื่องตาม T0.2) จะรัน e2e test แล้วเขียนทับ/พัง DB dev ของตัวเองแบบเงียบ ๆ โดยไม่รู้ตัว

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือแก้ที่ `packages/db/src/index.ts` ให้ APP_DATABASE_URL ไม่ fallback แบบนี้ — ปฏิเสธเพราะ fallback นี้จำเป็นสำหรับ production/dev ปกติ (ไม่อยากบังคับให้ต้องตั้ง 2 ตัวแปรเสมอ) ปัญหาจริงอยู่ที่ e2e spec ตั้งค่าไม่ครบ ไม่ใช่ตัว fallback logic เอง — spec ใหม่ในอนาคตที่ใช้ Testcontainers ต้องตั้งทั้งสองตัวแปรตาม pattern นี้เสมอ

---

## ADR-010: RoomType เป็น catalog แยกต่อสาขา ไม่ใช้ร่วมกันทุกสาขา และไม่มี CRUD UI ของตัวเองใน T2.2
วันที่: 2026-08-21
Task ที่เกี่ยวข้อง: T2.2

บริบท: `docs/PLAN.md` T2.2 ระบุแค่ "ห้อง/เตียง: ประเภทห้อง, ความจุ, สาขา, สถานะพร้อมใช้ + CRUD UI" ไม่ได้ระบุว่า "ประเภทห้อง" เป็น catalog ระดับไหน (ใช้ร่วมกันทุกสาขาของร้าน หรือแยกต่อสาขา) และไม่ได้ระบุว่าต้องมีหน้าจัดการประเภทห้องแยกต่างหากหรือไม่ — ถามเจ้าของร้านแล้วได้คำตอบชัดเจน

ตัดสินใจ:
- `RoomType` เป็น model แยกต่างหาก (ไม่ใช่ enum คงที่ เพราะ T4.1 ระบุว่า `Room` มี `roomTypeId` เป็น foreign key) มี `branchId` ผูกกับสาขา — แต่ละสาขาตั้งประเภทห้องของตัวเองได้ ไม่ใช้ร่วมกันข้ามสาขา
- T2.2 นี้ **ไม่มี** CRUD UI สำหรับ RoomType — seed ค่าเริ่มต้น 4 ประเภทต่อสาขา (ห้องนวดเดี่ยว/ห้องนวดคู่/ห้องสปา/ห้องทำหน้า) ให้พอใช้งาน ฟอร์มสร้าง/แก้ไขห้องเลือกจาก dropdown ที่ดึงจาก `GET /branches/:branchId/room-types` (read-only endpoint)
- `RoomController.create/update` เช็คว่า `roomTypeId` ที่ส่งมาอยู่ในสาขาเดียวกับ `branchId` ของ route จริง (กัน merge ข้ามสาขาที่ไม่ผ่าน UI ปกติ) — คืน 404 ถ้าไม่ตรง

เหตุผล: การแยกต่อสาขาให้ความยืดหยุ่นมากกว่าถ้าร้านมีหลายสาขาที่ห้องไม่เหมือนกัน (ตรงกับที่เจ้าของร้านต้องการ) และไม่มี CRUD UI แยกเพราะขอบเขต T2.2 เน้นที่ Room ไม่ใช่ RoomType — การเพิ่ม/แก้ไขประเภทห้องยังทำได้ผ่าน DB โดยตรงหรือรอ Task ในอนาคตถ้าจำเป็นจริง

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ catalog ระดับร้าน (ใช้ร่วมกันทุกสาขา ไม่มี branchId) — ปฏิเสธเพราะเจ้าของร้านเลือกแบบแยกต่อสาขาชัดเจน T2.3/T4.1 (บริการต้องระบุ `requiredRoomTypeId`) ต้องคำนึงว่า RoomType ผูกกับสาขาเสมอเช่นกัน — ถ้าในอนาคตร้านต้องการ "ประเภทห้องกลาง" ใช้ร่วมทุกสาขาจริง ๆ ต้อง migrate schema ใหม่ (ย้าย branchId ออกจาก RoomType) ซึ่งเป็นงานเพิ่มเติมที่ยังไม่ต้องทำตอนนี้

---

## ADR-011: ตัดขอบเขตแผนให้เน้นร้านเล็กสาขาเดียวก่อน — ย้ายงานที่มีค่าเฉพาะร้านโตไปหัวข้อ 12
วันที่: 2026-08-21
Task ที่เกี่ยวข้อง: ไม่ผูกกับ Task เดียว — เป็นการปรับ `docs/PLAN.md` เอง (หัวข้อ 5/6/9/10 + เพิ่มหัวข้อ 1.1, 12)

บริบท: หลัง T2.2 เสร็จ ผู้ใช้ถามให้วิเคราะห์ว่าระบบใหญ่เกินไปสำหรับร้านเล็กหรือไม่ ประเมินแล้วพบว่าความซับซ้อน
ส่วนใหญ่ (เงินเป็น integer สตางค์, ledger append-only, RBAC ต่อสาขา) มาจากคำตอบจริงของเจ้าของร้านใน
`docs/DOMAIN.md` ไม่ใช่การเดาเติมของ AI แต่แผนเดิม (50 Task) มีงานหลายส่วนที่มีประโยชน์เฉพาะร้านที่โต
กว่าสาขาเดียวจริงๆ หรือเป็น integration/analytics ที่ยังไม่จำเป็นตอนเริ่มต้น ผู้ใช้ยืนยันว่าต้องการเน้นร้านเล็ก
สาขาเดียวก่อน แล้วให้แยกส่วนที่ไม่เหมาะออกไปเก็บไว้เป็นส่วนขยายในอนาคต

ตัดสินใจ:
- เพิ่มหัวข้อ 1.1 ในตัวเอกสารระบุเป้าหมายช่วงแรกชัดเจน พร้อมหลักการคัดแยกว่าอะไรอยู่ core อะไรอยู่ส่วนขยาย
- ย้าย M8 ทั้งชุดเดิม (T8.1–T8.5: คลัง+BOM, LINE, Staff Portal, PDPA anonymize เต็มรูป, ตั้งค่าระบบละเอียด)
  ไปเป็นหัวข้อ 12 (T12.3–T12.7) รหัส Task เดิมคงไว้ในวงเล็บกันสับสน ไม่ได้ลบทิ้ง แค่ย้ายตำแหน่งในเอกสาร
- ตัด RFM + heatmap ออกจาก T7.2 (รายงาน) ไปเป็น T12.1 — เกณฑ์ผ่านที่เหลือของ T7.2 ไม่เปลี่ยน
- ตัดส่วน "อัปโหลด S3/R2 เข้ารหัส + ซ้อมกู้คืนทุกรอบมีบันทึก" ออกจาก T9.2 (backup) ไปเป็น T12.8 — T9.2
  ที่เหลือย่อเป็น backup ในเครื่อง + ซ้อมกู้คืนอย่างน้อย 1 ครั้ง (ยังคงมี backup จริง ไม่ใช่ตัดทิ้งทั้งหมด)
- เพิ่ม T12.2 (ฟีเจอร์ข้ามสาขา) เป็นรายการใหม่ในหัวข้อ 12 ครอบคลุมงานในอนาคตที่ไม่มี Task เดิมรองรับ
- **ไม่รื้อ** multi-branch schema ที่ T0.1–T2.2 สร้างไปแล้ว (Branch/UserBranch/branchId ทุกตาราง) — สร้าง
  ไปแล้วเป็นต้นทุนจม รื้อทีหลังแพงกว่าคงไว้ แค่หยุดพัฒนา "ฟีเจอร์เฉพาะหลายสาขา" เพิ่มจนกว่าจะมีสาขาที่ 2 จริง
- ปรับตาราง §10 (ประมาณการ) ให้แยก "ขอบเขตร้านเล็กสาขาเดียว" (45 Task, ~8–10 สัปดาห์) ออกจาก "ส่วนขยาย
  ในอนาคต" (8 Task ในหัวข้อ 12) อย่างชัดเจน

เหตุผล: ลดภาระ cognitive และเวลาที่ใช้จริงให้ตรงกับสิ่งที่ร้านเล็กสาขาเดียวต้องใช้งานจริงตั้งแต่วันแรก โดยไม่
ทิ้งงานที่ทำวิเคราะห์ไว้แล้ว (แค่ย้ายตำแหน่งในเอกสาร ไม่ได้ลบ) — เมื่อร้านโตพอจะมีสาขาที่ 2 หรือข้อมูลสะสมพอ
วิเคราะห์ ก็กลับมาเปิดหัวข้อ 12 ได้ทันทีโดยไม่ต้องคิดขอบเขตใหม่จากศูนย์

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือลบ M8 และงานที่เกี่ยวข้องออกจากเอกสารไปเลย — ปฏิเสธเพราะ
งานพวกนี้ผ่านการคิดมาแล้วและอาจจำเป็นจริงเมื่อร้านโต การเก็บไว้ในหัวข้อแยกทำให้ไม่ต้องคิดใหม่ ในขณะที่ไม่ทำให้
แผนงานหลัก (M0–M9 ที่เหลือ) ดูใหญ่เกินจำเป็นสำหรับเป้าหมายปัจจุบัน — ผลกระทบต่อโค้ดที่มีอยู่: ไม่มี (เป็นการ
แก้เอกสารวางแผนล้วนๆ ไม่แตะ schema/โค้ดที่ T0.1–T2.2 สร้างไว้แล้ว)

---

## ADR-012: โครงสร้างบริการ 3 ชั้น (หมวด → บริการ → ตัวเลือกเวลา), isActive สองระดับ, ฟอร์มกรอกเงินเป็นบาท
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T2.3

บริบท: `docs/PLAN.md` T2.3 ระบุกว้าง ๆ ว่า "หมวด → บริการ → ตัวเลือกเวลา (60/90/120 นาที คนละราคา
คนละค่ามือ), buffer ก่อน/หลัง, ทักษะที่ต้องใช้, ประเภทห้องที่ต้องใช้, สถานะเปิดขาย" โดยไม่ได้ระบุว่า
buffer/ทักษะ/ประเภทห้อง อยู่ระดับบริการหรือระดับตัวเลือกเวลา, หมวดบริการต้องมี CRUD UI ของตัวเองหรือไม่,
และ "สถานะเปิดขาย" ปิดได้ที่ระดับไหน — ถามผู้ใช้ก่อนเริ่มเขียนโค้ดตามกติกา "เมื่อไม่แน่ใจ" ใน CLAUDE.md

ตัดสินใจ:
- `ServiceCategory` (หมวด) → `Service` (บริการ) → `ServiceVariant` (ตัวเลือกเวลา) เป็น 3 model แยกกัน
- `bufferBeforeMin`/`bufferAfterMin`/`requiredSkill`/`requiredRoomTypeId` อยู่ที่ `ServiceVariant` ตรงกับ
  signature ของ `findAvailableSlots` ที่ PLAN.md §7.2 กำหนดไว้แล้วสำหรับ T4.1 (ไม่ต้องถาม เพราะ PLAN.md
  ตอบไว้แล้วโดยอ้อมผ่าน signature — เอาไว้ตรงนี้กัน schema ต้องรื้อตอนทำ T4.1)
- ค่ามือ 3 เรต (`commissionJuniorSatang`/`SeniorSatang`/`MasterSatang`) อยู่ที่ `ServiceVariant` ตาม ADR-008
- "สถานะเปิดขาย" (`isActive`) มีทั้งสองระดับ — `Service.isActive` ปิดทั้งบริการทุกตัวเลือกเวลาพร้อมกัน,
  `ServiceVariant.isActive` ปิดเฉพาะตัวเลือกเวลาเดียว (เช่น หยุดขาย 120 นาทีแต่ยังขาย 60/90 อยู่)
- `ServiceCategory` **ไม่มี** CRUD UI ของตัวเองใน Task นี้ — seed ค่าเริ่มต้น (2 หมวด: "นวด",
  "เสริมความงาม") + endpoint อ่านอย่างเดียว (`GET /branches/:branchId/service-categories`) เติม dropdown
  เท่านั้น ตามแพทเทิร์นเดียวกับ `RoomType` ใน T2.2 (ADR-010)
- ฟอร์มฝั่งเว็บ (สร้าง/แก้ไขบริการและตัวเลือกเวลา) กรอกราคา/ค่ามือเป็น **บาท** ไม่ใช่สตางค์ตรง ๆ แล้วปัดเศษ
  แปลงเป็นสตางค์ (`Math.round(baht * 100)`) ก่อนยิง API เสมอ — schema/type สำหรับฟอร์มบาทนี้ (`variantFormSchema`,
  `serviceFormSchema`) อยู่ใน `packages/contracts/src/service.ts` คู่กับ wire schema จริง (หน่วยสตางค์) ตาม
  ธรรมเนียมเดิมที่ schema/zod authoring ทั้งหมดอยู่ที่ `packages/contracts` (CLAUDE.md ข้อ 8) — apps/web
  ไม่ import "zod" ตรง ๆ เพื่อไม่ต้องเพิ่ม zod เป็น dependency ตรงของ apps/web (ไม่ใช่ dependency ใหม่ของ repo
  แต่ยังคงเลี่ยงไว้เพราะ apps/web ไม่เคยมี pattern import zod ตรง ๆ มาก่อน)

เหตุผล: ยึด T4.1's signature ที่ล็อกไว้แล้วเพื่อไม่ต้อง migrate schema ซ้ำ, isActive สองระดับให้ความยืดหยุ่น
จริงที่ร้านต้องการ (หยุดขายเฉพาะบางตัวเลือกเวลาโดยไม่ต้องปิดทั้งบริการ) โดยต้นทุนต่ำ (แค่ boolean เพิ่ม 1
ฟิลด์), การกรอกเงินเป็นบาทตรงกับ docs/DESIGN.md §3.8 ("ตัวเลขเงินแสดง ฿1,250") และป้องกันความผิดพลาดร้ายแรง
ที่พนักงานพิมพ์ "300" โดยตั้งใจจะหมายถึง 300 บาท แต่ระบบอ่านเป็น 3 บาทถ้าฟอร์มรับสตางค์ตรง ๆ — ตรงกับ
CLAUDE.md "การเดาผิดในโดเมนนี้ทำให้เงินคลาดเคลื่อนจริง"

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ isActive ระดับเดียว (เฉพาะ Service) — ปฏิเสธเพราะ
ผู้ใช้เลือก "ทั้งสองระดับ" ชัดเจนตอนถาม; ทางเลือกที่ไม่เลือกอีกทางคือให้ฟอร์มเว็บกรอกสตางค์ตรง ๆ (ไม่มี
ชั้นแปลงหน่วย) — ปฏิเสธเพราะเสี่ยง UX ผิดพลาดเรื่องเงินตามเหตุผลข้างต้น — หมายเหตุด้าน infra: migration
`20260823074606_services` สร้างด้วย `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
(ไม่ผ่าน `prisma migrate dev`) เพราะ Docker ใช้งานไม่ได้ในเซสชันนี้ (`docker info` คืน 500 จาก Docker Desktop
API) ทำให้รัน Testcontainers/`migrate dev` จริงไม่ได้ — SQL ที่ได้ deterministic เหมือนกับที่ `migrate dev`
จะสร้าง (ไม่ต้องต่อ DB จริงเพราะ diff จาก datamodel ล้วน ๆ) แต่ **ยังไม่เคย apply/รัน e2e จริงกับ Postgres
เซสชันนี้** — ต้องรัน `pnpm db:migrate` และ `pnpm --filter @lotus-desk/api test:e2e` ยืนยันอีกครั้งเมื่อ Docker
พร้อมใช้งาน ก่อนถือว่า T2.3 ผ่านเกณฑ์เต็มรูป

---

## ADR-013: กะทำงาน — snapshot เวลาจาก template, ไม่รองรับกะข้ามเที่ยงคืน, วันลาแยกประเภท, ใช้ permission "staff" ร่วม
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T2.4

บริบท: `docs/PLAN.md` T2.4 ระบุกว้าง ๆ ว่า "กะทำงาน: แม่แบบกะ, สร้างตารางกะรายสัปดาห์, บันทึกวันลา/วันหยุด +
UI ปฏิทินรายสัปดาห์ลากวางได้" เกณฑ์ผ่าน "กะซ้อนกันต้องถูกปฏิเสธ" — ไม่ได้ระบุว่าการจ่ายกะจริงต้องอ้างอิงเวลา
จากแม่แบบแบบ join หรือ snapshot, รองรับกะข้ามเที่ยงคืนหรือไม่, วันลาต้องแยกประเภทหรือไม่ และไม่มี permission
resource หรือหน้าเว็บ "shift"/"schedule" กำหนดไว้ที่ไหนเลยในเอกสาร (ทั้ง `PERMISSION_RESOURCES` ใน
`packages/contracts/src/permissions.ts` และรายชื่อหน้าใน §2 ของ PLAN.md) — ถามผู้ใช้ 3 ข้อแรกก่อนเริ่มเขียนโค้ด
ตามกติกา "เมื่อไม่แน่ใจ" ส่วนข้อ permission/nav ตอบได้เองจากหลักฐานในเอกสาร (ดูด้านล่าง)

ตัดสินใจ:
- `ShiftTemplate` (แม่แบบกะ) → `StaffShift` (จ่ายกะจริงต่อวัน) — `StaffShift.startMin`/`endMin` **snapshot**
  ค่าจาก template ตอนสร้างเท่านั้น (ไม่ join คำนวณสด) แก้ template ทีหลังไม่กระทบตารางที่จ่ายไปแล้ว
  ตามแนวเดียวกับ ADR-008/ServiceVariant ที่ snapshot ราคา ณ เวลาสร้าง
- เวลาเก็บเป็น "นาทีจากเที่ยงคืน" (Int 0-1439/1440) ไม่ใช่ timestamptz — เป็นเวลาตามผนังที่วนซ้ำ ไม่ใช่ instant
- **ยังไม่รองรับกะข้ามเที่ยงคืน** — `endMin` ต้องมากกว่า `startMin` เสมอ ทั้งระดับ template และตรวจซ้ำตอน
  แก้ไข (merge กับค่าเดิมก่อนเช็คที่ `ShiftTemplateController.update`)
- `StaffLeave` แยกประเภทลาเป็น enum `LeaveType` (`SICK`/`PERSONAL`/`VACATION`) ไม่ใช่ประเภทเดียวกับหมายเหตุอิสระ
  — 1 คนลาได้แค่ประเภทเดียวต่อวัน (`@@unique([staffId, date])`) สร้างเป็นช่วงวันที่ได้ในคำขอเดียว (API ขยายเป็น
  1 แถวต่อวันเอง ผ่าน `createManyAndReturn`)
- "กะซ้อนกัน" เช็คที่ระดับ controller (ไม่ใช่ DB constraint แบบ `EXCLUDE USING gist` ที่ T4.2 จะใช้กับ
  `Appointment`) — เพียงพอสำหรับ T2.4 เพราะการชนกันของตารางกะไม่กระทบเงินโดยตรงเท่าการจองซ้อนที่ต้องกันเงินหาย
  ยอมรับ TOCTOU race เล็กน้อยจากคำขอพร้อมกัน เหมือนที่ `RoomController`/`ServiceController` ทำกับการเช็ค
  cross-branch reference อยู่แล้ว
- **ไม่มี permission resource ใหม่และไม่มีหน้า nav ใหม่** — ใช้สิทธิ์ `staff:view`/`staff:manage` ร่วมกับ
  `StaffController` ทั้งหมด (ไม่มี `"shift"` ใน `PERMISSION_RESOURCES` และไม่มีหน้า `/shifts` ใน §2 ของ
  PLAN.md — ตีความว่ากะทำงานเป็นส่วนหนึ่งของการจัดการพนักงาน ไม่ใช่โมดูลแยก) หน้าเว็บอยู่ที่ `/staff/shifts`
  เข้าถึงผ่านปุ่ม "จัดตารางกะ" บนหน้า `/staff` ไม่ใช่เมนูหลักใน `nav-items.ts`
- `StaffShift`/`StaffLeave` ใช้ **hard delete** (ไม่ใช่ `isActive` toggle แบบ Room/Staff/Service) เพราะเป็น
  รายการปฏิทินเฉพาะวัน ("ยกเลิกกะวันนี้") ไม่ใช่ catalog ที่ต้องเก็บประวัติเปิด/ปิดใช้งานถาวร — ยังบันทึก
  audit log ผ่าน `AuditInterceptor` ตามปกติ (`METHOD_TO_ACTION` รองรับ DELETE อยู่แล้วตั้งแต่ T1.5)
- UI ลากวาง: รองรับลากชิปแม่แบบกะจาก palette ไปวางบนตาราง (มอบหมายกะ) เท่านั้น — การลบกะทำผ่านคลิก+ยืนยัน
  ไม่ใช่ลากออก และการ "ย้าย" กะทำโดยลบของเดิมแล้วมอบหมายใหม่ ไม่ใช่ลากชิปที่มีอยู่ข้ามช่อง (ยังไม่ทำ เพื่อจำกัด
  ขอบเขตให้อยู่ในเวลาที่เหมาะสม — ไม่กระทบเกณฑ์ผ่านที่ระบุไว้ ("กะซ้อนกันต้องถูกปฏิเสธ" ยังทำงานถูกต้องทั้งสองทาง)

เหตุผล: การ snapshot เวลาป้องกันตารางกะย้อนหลังเปลี่ยนโดยไม่ตั้งใจ (สอดคล้องกับหลักการเดียวกันทั่วทั้งระบบ);
ไม่รองรับข้ามเที่ยงคืนตอนนี้ลดความซับซ้อนของการคำนวณทับซ้อนได้มาก โดยร้านสปาส่วนใหญ่ปิดก่อนเที่ยงคืนอยู่แล้ว;
แยกประเภทลาให้รายงานในอนาคต (เช่น สรุปวันลาต่อประเภทต่อปี) ทำได้โดยไม่ต้อง migrate schema เพิ่ม; การใช้สิทธิ์
staff ร่วมกันลดความซับซ้อนของ RBAC โดยไม่มีความจำเป็นทางธุรกิจให้แยก (ไม่มีบทบาทไหนต้องการเห็นตารางกะแต่ไม่เห็น
ข้อมูลพนักงาน หรือกลับกัน)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือก join-from-template ถูกปฏิเสธเพราะผู้ใช้ยืนยัน snapshot ชัดเจน; ทางเลือก
รองรับกะข้ามเที่ยงคืนถูกปฏิเสธในตอนนี้ — ถ้าร้านต้องการกะดึกจริงในอนาคต ต้อง migrate เพิ่ม field หรือ logic
แยกต่างหาก (ไม่ใช่แค่เปลี่ยน validation); ทางเลือกลาประเภทเดียวถูกปฏิเสธเพราะผู้ใช้เลือกแยก enum ชัดเจน —
หมายเหตุด้าน infra เหมือน ADR-012: migration `20260823091518_shifts` สร้างด้วย `prisma migrate diff`
แบบ schema-to-schema (Docker ใช้งานไม่ได้ในเซสชันนี้เช่นกัน) ยังไม่เคย apply/รัน e2e จริง ต้องยืนยันซ้ำเมื่อ
Docker พร้อมใช้งาน

---

## ADR-014: สมาชิก — เตือนซ้ำแต่ยังสร้างต่อได้, รหัส M+เลข 6 หลัก, ค้นหาด้วย pg_trgm สร้างผ่าน migration จริง
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T3.1

บริบท: `docs/PLAN.md` T3.1 ระบุ "สมาชิก: CRUD, รหัสสมาชิกรันอัตโนมัติ, ค้นหาแบบพิมพ์ไม่ครบก็เจอ (pg_trgm บนชื่อ
+ เบอร์), เตือนซ้ำตอนสร้างถ้าเบอร์ตรงกัน" ไม่ได้ระบุว่า "เตือนซ้ำ" หมายถึงห้ามสร้างซ้ำเด็ดขาดหรือแค่เตือนแล้ว
ยืนยันสร้างต่อได้ และไม่ได้ระบุรูปแบบรหัสสมาชิก — ถามผู้ใช้ทั้งสองข้อก่อนเริ่มเขียนโค้ด นอกจากนี้ยังพบว่า
`pg_trgm` extension เปิดไว้แล้วใน `docker/postgres/init-extensions.sql` (T0.2) แต่ไม่เคยถูกสร้างผ่าน Prisma
migration จริงมาก่อน — ใช้ได้เฉพาะ dev docker-compose เท่านั้น Testcontainers (e2e) และ production migration
deploy จะไม่มี extension นี้เลยถ้าไม่แก้

ตัดสินใจ:
- เบอร์ซ้ำตอนสร้าง: **เตือนแล้วให้ยืนยันสร้างต่อได้** ไม่ใช่ห้ามเด็ดขาด — `POST /members` เช็คเบอร์ก่อนเสมอ
  ถ้าพบซ้ำและ payload ไม่มี `confirmDuplicate:true` ตอบ 409 พร้อมรายชื่อ/รหัสสมาชิกที่ซ้ำ ฝั่งเว็บแสดงข้อความ
  พร้อมปุ่ม "ยืนยันสร้างสมาชิกนี้ต่อไป" ที่ส่งคำขอซ้ำพร้อม `confirmDuplicate:true`
- รหัสสมาชิก: รูปแบบ `M` + เลข 6 หลัก เรียงตามลำดับต่อสาขา เช่น `M000001` — สร้างฝั่ง server จาก
  `count(branchId) + 1` แล้วลองสร้างจริง ถ้าชนกับรหัสที่มีอยู่แล้ว (แข่งกันสร้างพร้อมกัน) ลองเลขถัดไปซ้ำได้
  สูงสุด 5 ครั้งก่อนล้มเลิก (`MemberController.createWithGeneratedCode`) — client ไม่ส่ง code เอง
- `pg_trgm` **ต้องสร้างผ่าน raw SQL ใน migration** (`CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN index
  `gin_trgm_ops` บน `name`/`phone`) ไม่ใช่พึ่ง `docker/postgres/init-extensions.sql` อย่างเดียว — เขียน SQL
  เองเหมือน migration `audit_log_protection` ของ T1.5 เพราะ Prisma schema DSL เวอร์ชันนี้ทำ GIN operator
  class ตรง ๆ ไม่ได้ชัวร์พอที่จะเชื่อโดยไม่ทดสอบกับ DB จริง
- ค้นหาใช้ `ILIKE '%...%'` ปกติ (Prisma `contains` + `insensitive`) เหมือน Room/Staff/Service — ไม่ใช้
  `similarity()`/ranking พิเศษของ pg_trgm เพราะ PLAN.md ต้องการแค่ "พิมพ์ไม่ครบก็เจอ" (substring match) trgm
  index ทำหน้าที่แค่เร่งความเร็ว pattern นี้ ไม่ได้เปลี่ยน query semantics
- Member fields จำกัดเท่าที่ T3.1 ต้องใช้จริง: `code`, `name`, `phone` (บังคับ ต่างจาก `StaffProfile.phone`
  ที่ไม่บังคับ เพราะเบอร์เป็นทั้งช่องทางติดต่อหลักและคีย์เช็คซ้ำ), `note`, `isActive` — ข้อมูลสุขภาพ/ความชอบ
  (เข้ารหัส) เป็น T3.2 แยกต่างหาก ไม่เพิ่ม field ล่วงหน้าเผื่ออนาคต (เช่น tier/birthDate ที่ T5.3 อ้างถึง)

เหตุผล: การเตือนแทนบล็อกเด็ดขาดตรงกับการใช้งานจริงของร้าน (สมาชิกครอบครัวอาจใช้เบอร์เดียวกัน) และผู้ใช้ยืนยัน
ชัดเจนตอนถาม; รหัสรันเลขที่ server (ไม่รับจาก client) ป้องกันรหัสชนกัน/ปลอมได้แน่นอนกว่า; การสร้าง extension
ผ่าน migration แทนที่จะพึ่ง init script ทำให้ทุกสภาพแวดล้อม (dev/CI/Testcontainers/production) ได้ pg_trgm
เหมือนกันเสมอ ไม่ใช่แค่เครื่อง dev ที่บังเอิญรัน docker-compose

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกห้ามซ้ำเด็ดขาดถูกปฏิเสธเพราะผู้ใช้เลือกแบบเตือนชัดเจน — ถ้าในอนาคตร้าน
ต้องการบล็อกจริง ต้องเปลี่ยน endpoint behavior (breaking change กับฝั่งเว็บที่ handle 409 อยู่แล้ว); ทางเลือก
รหัสตามปี (M69-000001) ถูกปฏิเสธเพราะผู้ใช้เลือกแบบเรียงตามลำดับล้วน ๆ ชัดเจน — หมายเหตุด้าน infra เหมือน
ADR-012/013: migration `20260823100431_members` สร้างด้วย `prisma migrate diff` แบบ schema-to-schema ผสม
raw SQL ส่วน trgm เอง (Docker ใช้งานไม่ได้ในเซสชันนี้) **ยังไม่เคย apply/รัน e2e จริง และยังไม่ได้วัดผล
performance ค้นหา 10,000 แถวจริงตามเกณฑ์ผ่าน** ต้องยืนยันทั้งสองเรื่องเมื่อ Docker พร้อมใช้งาน

---

## ADR-015: แก้บั๊กจริง — `export * from "@prisma/client"` ทำให้ `prisma` singleton หายตอนรันจริง (production-blocking)
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: ไม่ผูกกับ Task เดียว — พบระหว่างยืนยัน T2.3–T3.1 หลัง Docker ใช้งานได้ในเซสชันนี้

บริบท: หลัง Docker กลับมาใช้งานได้ รัน `pnpm db:migrate` + `pnpm db:seed` สำเร็จ (10 migrations รวม T2.3–T3.1
apply ผ่านหมด, trgm index ทำงานจริง — วัด perf ค้นหา 10,000 แถวได้ ~17ms เฉลี่ย ผ่านเกณฑ์ T3.1 ขาดแค่นี้จาก
ADR-014) รัน e2e suite เต็ม (`pnpm test:e2e`, 8 spec ไฟล์) ผ่านทั้งหมด 67/67 หลังแก้ 2 จุดเล็ก (ดูท้าย ADR นี้)
แต่พอลองบูตแอปจริงด้วย `node dist/main.js` แล้วเปิด browser จริงเพื่อ login กลับพัง 500 ทุกครั้งด้วย
`TypeError: Cannot read properties of undefined (reading 'user')` ที่ `AuthService.validateCredentials`
บรรทัด `this.prisma.client.user.findUnique(...)` — ไล่จนถึงต้นตอพบว่า `PrismaService.client` (ซึ่ง copy
มาจาก `prisma` ที่ export จาก `packages/db/src/index.ts`) เป็น `undefined` ทั้งกระบวนการ ทำทุก endpoint ที่
แตะ DB พังเหมือนกันหมด ไม่ใช่แค่ login

สาเหตุ: `packages/db/src/index.ts` มี `export * from "@prisma/client";` ควบคู่กับ `export const prisma = ...`
ที่ประกาศเอง — เมื่อ `apps/api` (CommonJS, ดู ADR-005) ทำ `require("@lotus-desk/db")` ผ่าน Node's
require(esm) interop (จำเป็นเพราะ packages/db เป็น ESM แท้) พบว่า `export *` ของ CJS module ขนาดใหญ่แบบ
`@prisma/client` ทำให้ named export ที่ประกาศเองในไฟล์เดียวกัน (`prisma`) หายไปเงียบ ๆ จากผลลัพธ์ของ
`require()` — ยืนยันด้วย minimal repro แยกต่างหาก (`export * from "@prisma/client"; export const prisma = "x";`
แล้ว `require()` คืน `prisma: undefined` แต่พอเปลี่ยนเป็น named re-export `export { PrismaClient } from ...`
แทน `export *` กลับได้ค่าปกติ) เป็นข้อจำกัด/บั๊กจริงของ Node's require(esm) ไม่ใช่โค้ดเราเขียนผิด syntax —
บั๊กนี้ไม่มีทางถูกจับได้ผ่าน e2e spec เลยเพราะทุก spec ใช้ dynamic `await import("@lotus-desk/db")` ซึ่งเป็น
native ESM import ไม่ผ่านเส้นทาง require(esm) ที่มีปัญหา และ ADR-004 เดิมก็ระบุวิธี smoke-test ไว้แค่ "บูต
แอปแล้วดูว่า start ได้ไหม" ไม่เคยยิง request จริงที่แตะ DB ผ่าน `node dist/main.js` มาก่อนในเซสชันไหนเลย —
บั๊กนี้จึงแฝงอยู่ตั้งแต่ T1.2 (จุดที่ apps/api เริ่ม import `@lotus-desk/db` ผ่าน static import จริง) แต่ไม่
เคยถูกจับได้จนกว่าจะมีคนลอง login ผ่าน browser จริงกับแอปที่บูตแบบ production

ตัดสินใจ:
- ห้ามใช้ `export * from "@prisma/client"` ใน `packages/db/src/index.ts` อีก — เปลี่ยนเป็น re-export ค่า
  (value) ที่ apps/api ใช้จริงแบบ explicit เท่านั้น: `export { PrismaClient, Prisma, AuditAction } from
  "@prisma/client";`
- เพิ่ม `export type * from "@prisma/client";` แยกบรรทัดสำหรับ type (ไม่มี JS ถูก emit เลยจากบรรทัดนี้ —
  ตรวจแล้วจาก `dist/index.js` — จึงไม่มีทางโดนบั๊กเดียวกัน) จำเป็นเพราะไม่งั้น TS ขึ้น TS2742 ("inferred type
  ... cannot be named") ทุก controller method ที่คืนค่าตรงจาก Prisma Client (เช่น `member.findMany()`)
  เพราะ TS ต้องการ public path ไปยัง type ของ Prisma model ที่ inferred ไว้เสมอ
- แก้ `service.e2e-spec.ts` เพิ่มเติม: `.sort()` ธรรมดา (ไม่มี comparator) sort ตัวเลขแบบ string ทำให้
  `[60,90,120]` เพี้ยนเป็น `[120,60,90]` — เปลี่ยนเป็น `.sort((a,b) => a-b)` (บั๊กใน test เอง ไม่ใช่ API)
- แก้ `apps/api/src/main.ts`: เพิ่ม `if (require.main === module) { void bootstrap(); }` ครอบ `bootstrap()`
  — ก่อนหน้านี้ทุกไฟล์ e2e spec ที่ `import { createApp } from "../../../main"` จะสั่ง `bootstrap()` (ซึ่ง
  เรียก `app.listen()`) ไปด้วยเสมอเป็นผลข้างเคียง พอรันหลาย spec พร้อมกัน (ปกติของ vitest) ทุกไฟล์แย่งฟัง
  PORT เดียวกันจน `EADDRINUSE` (ไม่กระทบผลการทดสอบเพราะ e2e ใช้ `app.init()` ไม่ใช่ `app.listen()` แต่ทำให้
  เห็น unhandled rejection เต็มหน้าจอ)

เหตุผล: นี่คือบั๊กที่ทำให้ระบบทั้งระบบใช้งานจริงไม่ได้เลยสักครั้ง (ทุก request ที่แตะ DB คืน 500) แต่ไม่มีทาง
ตรวจพบผ่าน `pnpm verify` (typecheck/lint/unit test ผ่านหมดตลอดมา) หรือ e2e (dynamic import หลบบั๊กได้พอดี)
— พบได้เพราะทำตามธรรมเนียมเดิมของ repo (ดู ADR-004/006/007: ทุกบั๊กใหญ่ก่อนหน้านี้ก็ถูกจับได้จากการบูตแอปจริง
ด้วย `node dist/main.js` ไม่ใช่จาก automated test) — ยืนยันความสำคัญของขั้นตอนนี้ว่ายังจำเป็นอยู่ แม้จะมี e2e
suite ครบแล้วก็ตาม เพราะ e2e เองก็มี blind spot ของตัวเอง (dynamic import)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือเปลี่ยน `PrismaService.client` จาก static import เป็น async
factory provider (`useFactory: async () => (await import("@lotus-desk/db")).prisma`) เพื่อเลี่ยง require(esm)
ไปเลย — ปฏิเสธเพราะเปลี่ยนโครงสร้าง DI ทั้งระบบ (ทุกที่ที่ inject `PrismaService` จะกลายเป็น async ไปด้วย)
ซับซ้อนและเสี่ยงกว่าการแก้ที่ต้นตอ (barrel export) มาก — ผลกระทบต่อโค้ดเดิม: ไม่มี breaking change เพราะ
`@lotus-desk/db`'s public API (สิ่งที่ import ได้จริง) เหมือนเดิมทุกจุดที่มีการใช้งานอยู่แล้วในโค้ด — แค่ไม่
export symbol ที่ไม่เคยมีใครใช้ผ่านทางนี้อีกต่อไป (ถ้าต้องใช้ symbol ใหม่จาก `@prisma/client` ในอนาคต ต้องมา
เพิ่มชื่อในรายการ explicit re-export นี้ด้วยเสมอ — ห้ามกลับไปใช้ `export *` เด็ดขาด)

---

## ADR-016: เลื่อน T3.2 (ข้อมูลสุขภาพ + ความชอบสมาชิก) ไปหัวข้อ 12 เป็น T12.9
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: ไม่ผูกกับ Task เดียว — เป็นการปรับ `docs/PLAN.md` เอง (หัวข้อ 5/10/11/12)

บริบท: หลัง T3.1 (สมาชิก) เสร็จและยืนยันผ่าน e2e จริงแล้ว ผู้ใช้สั่งให้ข้าม T3.2 (ข้อมูลสุขภาพ+ความชอบ
เข้ารหัสระดับคอลัมน์) ไปก่อน ให้ย้ายไปไว้ในส่วนขยายอนาคต (หัวข้อ 12) แล้วทำ Task ถัดไปแทน — ตรงกับหลักการ
คัดแยกที่ ADR-011 วางไว้แล้วตั้งแต่ต้น (หัวข้อ 1.1: งานที่ยังไม่จำเป็นสำหรับร้านช่วงแรกให้เลื่อนไปหัวข้อ 12)

ตัดสินใจ:
- ย้าย T3.2 ทั้งหมดไปหัวข้อ 12 เป็น **T12.9** (ข้อความ/เกณฑ์ผ่านเดิมทุกตัวอักษร ไม่ได้ตัดขอบเขตอะไรออก)
  รหัส T3.2 **ไม่นำมาใช้ซ้ำ** และไม่เลื่อนเลข T3.3/T3.4 ลงมาแทนที่ ตามแนวเดียวกับ ADR-011 (กัน reference
  เดิมใน T12.4 "เคารพความยินยอมจาก T3.3" และ T12.6 "การถอนความยินยอมพื้นฐาน (T3.3)" คลาดเคลื่อน)
- M3 เหลือ 3 Task (T3.1, T3.3, T3.4) จากเดิม 4 — ปรับตัวเลขรวมในหัวข้อ 10 จาก 45 เหลือ 44 Task และย้าย 1
  Task จากฝั่ง "ขอบเขตร้านเล็กสาขาเดียว" ไปฝั่งหัวข้อ 12 (8 → 9)
- T3.3 (PDPA consent) **ไม่เลื่อนตาม** — ทำต่อได้ตามปกติ เพราะกลไกบันทึก/ถอนความยินยอมเป็น core requirement
  ที่ไม่ได้ขึ้นกับว่ามีข้อมูลสุขภาพเก็บอยู่จริงหรือยัง (T12.4/T12.6 ที่จะมาทีหลังก็อ้างอิง T3.3 อยู่แล้วในฐานะ
  งานที่ทำเสร็จตั้งแต่ต้น ไม่ใช่งานที่รอ T3.2) — ประเภทความยินยอม "เก็บข้อมูลสุขภาพ" ยังคงอยู่ใน schema ได้
  ตามปกติ (เป็นแค่ enum ค่าหนึ่ง) แม้ยังไม่มีข้อมูลสุขภาพจริงให้ยินยอมเก็บก็ตาม
- T3.4 (merge สมาชิกซ้ำ) ก็ไม่เลื่อนตามเช่นกัน เพราะไม่ได้แตะข้อมูลสุขภาพเลย (ย้ายแค่ประวัติ/คอร์ส/แต้ม)

เหตุผล: ตรงตามที่ผู้ใช้สั่งโดยตรง — ไม่ต้องประเมินเหตุผลเพิ่มเพราะเป็นคำสั่งชัดเจนเรื่องลำดับความสำคัญ ไม่ใช่
ปัญหาทางเทคนิคที่ต้องชั่งน้ำหนัก การเก็บ T3.2 ไว้ในหัวข้อ 12 (ไม่ลบทิ้ง) ตรงกับหลักการเดิมของทั้งเอกสาร
(ADR-011) ที่ต้องการให้งานที่คิดมาแล้วไม่หายไป แค่ยังไม่ทำตอนนี้

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือเลื่อนเลข T3.3→T3.2, T3.4→T3.3 ให้ M3 ดูต่อเนื่อง — ปฏิเสธ
เพราะจะทำให้ reference เดิมที่อ้างถึง "T3.3" ในหัวข้อ 12 (T12.4, T12.6) ผิดที่ผิดทางทันที ต้องไล่แก้หลายจุด
โดยไม่ได้ประโยชน์อะไรเพิ่ม — การเว้นเลข T3.2 ว่างไว้ (ย้ายไปเป็น T12.9 แทน) ปลอดภัยกว่าและตรงกับแบบแผนที่
ADR-011 วางไว้แล้ว ไม่มีผลกระทบต่อโค้ดที่มีอยู่เลยเพราะ T3.2 ยังไม่เคยเริ่มเขียนโค้ดจริง (แค่เป็นรายการในแผน)

---

## ADR-017: pg_trgm ต้องประกาศผ่าน Prisma schema DSL (`extensions`/`@@index(type: Gin)`) ไม่ใช่ raw SQL — และต้องรีเซ็ต dev DB เพื่อแก้
วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T3.3 (พบระหว่างเพิ่ม MemberConsent — ไม่เกี่ยวกับ T3.3 โดยตรง แต่แก้ไปพร้อมกันเพราะ
`prisma migrate dev` ตัวแรกของ Task นี้เป็นตัวที่ดันไปเจอบั๊กจาก T3.1/ADR-014 เข้า)

บริบท: ADR-014 (T3.1) ตัดสินใจสร้าง `pg_trgm` extension + GIN trigram index บน `Member.name`/`Member.phone`
ด้วย raw SQL เขียนเองในไฟล์ migration โดยตรง เพราะตอนนั้นไม่มี DB จริงให้ทดสอบว่า Prisma schema DSL รองรับ
operator class แบบนี้ได้จริงหรือเปล่า (`postgresqlExtensions` preview feature) — พอมี DB จริงและรัน
`prisma migrate dev --name member_consents` (สำหรับ T3.3) ครั้งแรก Prisma diff schema.prisma กับ DB จริง
แล้วเห็นว่ามี index 2 ตัวใน DB (`members_name_trgm_idx`, `members_phone_trgm_idx`) ที่ schema.prisma ไม่ได้
ประกาศไว้เลย (เพราะสร้างด้วย raw SQL) จึงตีความว่าเป็น index แปลกปลอมที่ต้อง**ลบทิ้ง** แล้วออก migration ที่มี
`DROP INDEX` ทั้งสองตัวโดยอัตโนมัติ — ถ้าไม่ทันสังเกตจะทำให้เกณฑ์ผ่าน T3.1 (ค้นหา 10,000 แถว < 100ms) พังใน
production จริงแบบเงียบ ๆ ตอน deploy ครั้งถัดไป

ตัดสินใจ:
- ประกาศ `pg_trgm` ผ่าน schema DSL จริง: `generator client { previewFeatures = ["postgresqlExtensions"] }`
  และ `datasource db { extensions = [pgTrgm(map: "pg_trgm")] }` — **ต้องมี `map: "pg_trgm"` เสมอ** เพราะไม่งั้น
  Prisma แปลชื่อ `pgTrgm` (camelCase) เป็น `CREATE EXTENSION "pgTrgm"` ตรง ๆ ซึ่งไม่ตรงกับชื่อ extension จริง
  ใน Postgres (`pg_trgm`) — ยืนยันจาก error จริงตอน migrate (`extension "pgTrgm" is not available`)
- ประกาศ index ด้วย `@@index([name(ops: raw("gin_trgm_ops"))], type: Gin)` (เช่นเดียวกับ phone) แทน raw SQL —
  Prisma รองรับ syntax นี้จริงตาม `postgresqlExtensions` preview feature (ยืนยันแล้วว่าใช้งานได้จริงกับ DB จริง)
- ลบ `CREATE EXTENSION IF NOT EXISTS pg_trgm;` ออกจาก `docker/postgres/init-extensions.sql` — เหลือแค่
  `btree_gist` (ที่ยังไม่ถูกประกาศผ่าน schema DSL เพราะยังไม่มี index ไหนใช้จริง รอ T4.2) กันไม่ให้เกิด
  ปัญหาแบบเดียวกันซ้ำ (extension ที่มีอยู่จริงใน DB แต่ Prisma ไม่รู้จักผ่าน schema จะทำให้ diff สับสนเสมอ)
- **รีเซ็ต local dev database 2 ครั้ง** เพื่อแก้ปัญหานี้ให้สะอาด (ครั้งแรก: ล้าง drift จาก index ที่ลบไปแล้ว
  ด้วยมือ + `btree_gist` ที่ไม่เคยอยู่ใน migration history เลย; ครั้งที่สอง: หลัง migration แรกพังเพราะ
  `extensions = [pgTrgm]` ไม่มี `map:` ทำให้ apply migration ไม่สำเร็จกลางคัน) — Prisma มีระบบตรวจจับเองว่าถูก
  agent เรียกและปฏิเสธรัน `prisma migrate reset` โดยไม่มี `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` ตรงกับ
  ข้อความยืนยันของผู้ใช้เป๊ะ ๆ — หยุดถามผู้ใช้ตรง ๆ ก่อนทุกครั้งตามที่ Prisma กำหนด ได้รับคำตอบ "ตกลง" แล้วจึง
  ดำเนินการ (ทั้งสองรอบเป็นการแก้ปัญหาเดียวกันต่อเนื่องกัน ไม่ใช่คำขอทำลายข้อมูลใหม่)

เหตุผล: ข้อมูลใน local dev DB ตอนนั้นมีแค่ seed data ปกติ (ข้อมูลทดสอบ 10,000 แถวสำหรับวัด performance ของ
ADR-014 ถูกลบไปแล้วในสคริปต์ทดสอบเอง) จึงไม่มีอะไรสูญเสียจริงที่กู้คืนไม่ได้ — การแก้ที่ schema DSL แทน raw SQL
ทำให้ `prisma migrate dev`/`deploy` ในอนาคต (รวมถึงตอน deploy ขึ้น production ครั้งแรกที่ T9.1) ไม่มีทางลบ
index เหล่านี้ทิ้งโดยไม่ตั้งใจอีก เพราะกลายเป็นส่วนหนึ่งของ "expected schema" ที่ Prisma รู้จักแล้วอย่างเป็น
ทางการ ไม่ใช่ effect ข้างเคียงที่ migration ประวัติศาสตร์ทิ้งไว้เฉย ๆ

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกอื่นคือแก้ migration `20260823100431_members` เดิม (ของ T3.1) ให้ตรงกับ
สถานการณ์ใหม่ — ปฏิเสธเพราะเป็น migration ที่ apply ไปแล้วจริงและมี checksum ที่ Prisma ตรวจสอบ แก้ไฟล์เดิม
ย้อนหลังจะทำให้ fresh deploy กับ deploy ที่เคย apply แล้วไม่ตรงกัน (checksum mismatch) — ปล่อยไฟล์เดิมไว้ตาม
เดิม (ยังคงมีคอมเมนต์อธิบายว่าทำไมเป็น raw SQL ตามบริบทตอนนั้น) แล้วให้ migration ใหม่ (`member_consents`)
เป็นตัวประสาน (RENAME INDEX ให้ตรงชื่อที่ Prisma คาดหวัง) แทน — Prisma ทำ RENAME ให้อัตโนมัติเองเมื่อ schema
ประกาศ index ที่มีอยู่แล้วในชื่ออื่น ไม่ต้องเขียน SQL เพิ่มเอง

---

## ADR-018: รวมสมาชิกซ้ำ (T3.4) — soft-merge ผ่าน self-relation, ย้ายเฉพาะ MemberConsent เท่าที่มีจริง, และ POST /merge ได้ audit action เป็น CREATE ไม่ใช่ UPDATE

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T3.4

บริบท: สมาชิกที่พนักงานสร้างซ้ำโดยไม่ตั้งใจ (เบอร์ตรงกับสมาชิกเดิม แต่ยืนยัน `confirmDuplicate` สร้างต่อ
ตอน T3.1/ADR-014) ต้องรวมกลับเป็นคนเดียวได้ในภายหลัง โดยไม่ทำให้ประวัติที่ผูกกับ "รายการรอง" หายไป และต้อง
ย้อนกลับ (reconstruct) ได้ว่าเกิดอะไรขึ้นบ้าง

ตัดสินใจ:
- **Soft-merge ผ่าน self-relation** (`Member.mergedIntoId` ชี้กลับไปที่ `Member` อีกแถวหนึ่ง) แทนการลบ
  หรือย้ายข้อมูลจริงแล้วลบ "รายการรอง" ทิ้ง — รายการรองยังอยู่ในตาราง (แค่ `isActive: false` +
  `mergedIntoId` ไม่ null) กันไม่ให้ FK ที่อ้างถึง memberId เดิม (เช่น booking/transaction ในอนาคต) พัง และ
  ทำให้ตรวจสอบสถานะ "ถูกรวมไปแล้ว" ได้ตรง ๆ ผ่านฟิลด์เดียว ไม่ต้องไล่ audit log ทุกครั้งที่จะเช็ค
- **ย้ายเฉพาะ `MemberConsent`** จากรายการรองไปหารายการหลัก (UPDATE `memberId` ทีละแถวใน transaction เดียว
  กับการปิดใช้งานรายการรอง) — ยังไม่มี MemberPackage/แต้มสะสมในระบบตอนนี้ (รอโมดูลในอนาคต) เมื่อโมดูลเหล่านั้น
  มาถึงต้องมาต่อ logic ย้ายที่นี่ด้วย (ไม่ใช่แค่ MemberConsent อีกต่อไป)
- **เขียน audit log ของ `MemberConsent` เอง**ในทรานแซกชันเดียวกัน (นอกเหนือจากที่ `AuditInterceptor` จับ
  `Member` ให้อัตโนมัติผ่าน `@AuditEntity("Member")`) เพราะ interceptor ตัวเดียวจับได้แค่ entity เดียวต่อ
  request (ตาม route param `:memberId`) — ไม่ใช่การเลี่ยง `AuditInterceptor` ตาม CLAUDE.md ข้อ 6 (route ยัง
  ผ่าน interceptor ปกติสำหรับ `Member`) แค่เสริมให้ entity อื่นที่ mutation นี้แตะด้วยถูกบันทึกครบเช่นกัน
- **Route เป็น `POST /branches/:branchId/members/:memberId/merge`** (action-style endpoint แบบเดียวกับ
  `/consents`, `/auth/login`, `/auth/logout-all` ที่มีอยู่แล้วในโค้ดเบสนี้) ไม่ใช่ `PATCH` — ผลข้างเคียงที่
  พบตอนรัน e2e จริง: `AuditInterceptor` map action จาก HTTP method ตรง ๆ (`POST` → `CREATE` เสมอ ดู
  `apps/api/src/audit/audit.interceptor.ts`) จึงได้ audit log ของ `Member` เป็น action `"CREATE"` ทั้งที่
  เนื้อหาจริงเป็นการแก้ไข (`isActive`, `mergedIntoId` เปลี่ยน) — พิจารณาแล้วว่า **ไม่แก้** ทั้งสองทาง
  (ไม่เปลี่ยน route เป็น PATCH และไม่เปลี่ยน interceptor ให้ฉลาดกว่า HTTP method) เพราะ before/after ที่เก็บ
  ไว้ยังครบถ้วนถูกต้อง — เกณฑ์ผ่าน T3.4 ("ย้อนกลับได้ผ่าน audit log") วัดที่ข้อมูล before/after สร้างสถานะ
  เดิมกลับมาได้ ไม่ใช่ที่ label `action` ตรงเป๊ะ — ยืนยันด้วย unit test ที่ค้นด้วย `action: "CREATE"` ตรง ๆ

เหตุผล: การลบข้อมูลจริงระดับแถวขัดกับหลักการ append-only/ห้ามข้อมูลหายที่ใช้ทั้งเอกสาร (เทียบ ADR-016 เรื่อง
`AuditLog`/`MemberConsent`) — soft-merge ทำให้ทุกอย่างที่เคยผูกกับรายการรองยังสืบย้อนกลับไปหาได้เสมอ ส่วน
เรื่อง audit action label: การเปลี่ยน `METHOD_TO_ACTION` ให้รับ override ต่อ route เป็นการเปลี่ยนกลไก
cross-cutting ที่กระทบทุก endpoint ที่มี `@AuditEntity` อยู่แล้ว (ความเสี่ยงสูงกว่าประโยชน์ที่ได้ ซึ่งเป็นแค่
label สวยขึ้น) ส่วนการเปลี่ยนเป็น PATCH จะขัดกับความหมายของ REST ที่ endpoint นี้ทำมากกว่าการ "แก้ไขฟิลด์"
ตรง ๆ — มันเป็น action ที่ปิดใช้งานสมาชิกหนึ่งและย้ายข้อมูลของมันไปอีกที่หนึ่งพร้อมกัน ใกล้เคียง `/consents`
(POST สร้างประวัติใหม่) มากกว่า `PATCH /members/:id` (แก้ไขฟิลด์ของ resource เดิมตรง ๆ)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) ลบรายการรองทิ้งจริงหลัง merge — ปฏิเสธเพราะขัด
หลักการห้ามข้อมูลหาย และจะทำให้ FK ในอนาคตพังถ้ามีอะไรอ้างถึง memberId เดิม (2) เปลี่ยน route เป็น PATCH
เพื่อให้ได้ audit action `UPDATE` ฟรี — ปฏิเสธตามเหตุผลข้างต้น (3) แก้ `AuditInterceptor` ให้รับ action
override ต่อ handler ผ่าน decorator — เก็บไว้เป็นตัวเลือกสำหรับอนาคตถ้าพบว่า action label ผิดแบบนี้เกิดขึ้น
บ่อยจนกระทบการใช้งานจริง (เช่น เจ้าของร้านกรอง audit log ด้วย action แล้วพลาดรายการ) แต่ตอนนี้ยังไม่มีหน้า UI
ไหนกรอง audit log ด้วย action เลย จึงยังไม่ใช่ปัญหาจริง — ยังไม่มี MemberPackage/แต้มให้ย้ายจึงยังทดสอบเกณฑ์
"ยอดคงเหลือของคอร์สไม่หาย" ไม่ได้เต็มรูปแบบ รอ T5.x/loyalty ในอนาคตมาเติม logic ย้ายเพิ่ม

---

## ADR-019: `packages/core` ประกาศ type ของตัวเองทั้งหมด ไม่ import จาก `@lotus-desk/contracts`

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.1 (availability engine)

บริบท: T4.1 ต้องการ type อย่าง `StaffLevel`, `StaffSkill`, และ shape ของ `StaffShift`/`Room`/`ServiceVariant`
ที่คล้ายกับที่ประกาศไว้แล้วใน `@lotus-desk/contracts` (เช่น `STAFF_LEVELS`/`STAFF_SKILLS` ใน `staff.ts`)
เกิดคำถามว่าควร import type เหล่านี้จาก contracts มาใช้ซ้ำ (DRY) หรือประกาศแยกเองใน `packages/core`

ตัดสินใจ: ประกาศ type ทั้งหมดที่ `packages/core/availability` ต้องใช้ไว้เองในไฟล์ `types.ts` ของมัน
(`StaffLevel`, `StaffSkill`, `StaffShift`, `StaffLeave`, `BookedBlock`, `StaffProfile`, `Room`,
`ServiceVariant`, `AvailableSlot`, `FindAvailableSlotsInput`) — **ไม่เพิ่ม `@lotus-desk/contracts` เป็น
dependency ของ `packages/core`** ค่า literal ของ enum (เช่น `"JUNIOR" | "SENIOR" | "MASTER"`) ตรงกับฝั่ง
contracts โดยตั้งใจ เพื่อให้ structural typing ทำให้ค่าจริงจากฝั่งนั้น assign เข้ามาได้โดยไม่ต้องแปลง
แต่เป็นคนละ type declaration กัน

เหตุผล: `packages/core/package.json` ปัจจุบันไม่มี `dependencies` เลยแม้แต่ workspace package เดียว
(มีแค่ `devDependencies` สำหรับ tooling) — นี่คือการตั้งใจของโครงสร้าง repo ตั้งแต่ต้น (ดู
`docs/PLAN.md` §2: "packages/core คือหัวใจ... ห้าม import Prisma ใน packages/core เป็นกฎเหล็ก") การเพิ่ม
`@lotus-desk/contracts` เป็น dependency จะทำลาย invariant นี้ที่ระดับเครื่องมือ (ไม่ใช่แค่ธรรมเนียมที่ต้อง
จำ) เพราะเปิดช่องให้ `packages/core` มี dependency graph ที่ไม่ใช่ leaf node อีกต่อไป — ถ้าวันหนึ่ง
`contracts` เพิ่ม dependency อื่นเข้ามาโดยไม่ได้ตั้งใจ (เช่นบาง schema library ที่ทำ I/O) `packages/core`
จะโดนดึงไปด้วยทันทีโดยไม่มีใครสังเกตจนกว่าจะสาย — การซ้ำ type declaration แค่ enum ค่าคงที่ (ไม่ค่อยเปลี่ยน)
มีความเสี่ยง drift ต่ำกว่าความเสี่ยงด้าน architecture มาก

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือเพิ่ม `@lotus-desk/contracts` เป็น dependency แล้ว
import type-only (`import type { StaffLevel } from "@lotus-desk/contracts"`) — ปฏิเสธตามเหตุผลข้างต้น
แม้ type-only import จะไม่มี JS runtime ถูก emit จริง (ไม่กระทบ bundle) แต่ยังนับเป็น dependency edge ใหม่ใน
package.json ที่ CLAUDE.md บอกว่า "ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม" — Task T5.3 (promotion engine) และ
T6.2 (commission engine) ที่จะตามมาใน `packages/core` เช่นกัน ควรใช้แนวทางเดียวกันนี้ (ประกาศ type ของ
ตัวเอง ไม่ import จาก contracts) เพื่อความสม่ำเสมอ

---

## ADR-020: Appointment/AppointmentItem — สถานะอยู่ที่ AppointmentItem, EXCLUDE constraint กันพนักงานเสมอ แต่กันห้องเฉพาะ capacity=1

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.2

บริบท: T4.2 ต้องกันจองซ้อนทั้งพนักงานและห้องด้วย PostgreSQL `EXCLUDE USING gist` ให้ทนต่อ concurrent request
จริง (เกณฑ์ผ่าน: ยิงจองพร้อมกัน 50 request ช่องเดียวกัน ต้องสำเร็จ 1 เท่านั้น) ระหว่างออกแบบพบ 3 ปัญหาที่
เอกสารไม่ได้ระบุไว้ตรง ๆ — ถามผู้ใช้แล้ว 1 ข้อ (เรื่อง room capacity) ส่วนอีก 2 ข้อตัดสินใจเองเพราะมีคำตอบ
ที่ถูกต้องทางเทคนิคชัดเจน

ตัดสินใจ:
1. **`status` อยู่ที่ `AppointmentItem` ไม่ใช่ `Appointment`** — เพราะ EXCLUDE constraint เป็น single-table
   constraint อ้างคอลัมน์ของตารางอื่นผ่าน JOIN ไม่ได้ ถ้า WHERE clause ของ constraint ต้องกันเฉพาะสถานะที่
   ยัง "กันช่องจริง" (ไม่รวม CANCELLED/NO_SHOW) สถานะต้องอยู่ตารางเดียวกับ staffId/roomId/startAt/endAt
   ผลพลอยได้ที่สมเหตุสมผลด้วย: 1 นัดมีหลายบริการต่อกันได้ (เช่น นวด 60 นาทีต่อด้วยทำหน้า 30 นาที)
   แต่ละอันควรเดินสถานะอิสระจากกัน (Lane Board ที่ T4.5 ก็วาดสีสถานะต่อ "บล็อก" = ต่อ item อยู่แล้ว)
2. **EXCLUDE ของ staffId ใช้เสมอทุกกรณี ไม่มีเงื่อนไข capacity** — พนักงาน 1 คนมี "capacity" เป็น 1 เสมอ
   โดยธรรมชาติทางกายภาพ ไม่ต้องถามผู้ใช้เพราะไม่มีทางเลือกอื่นที่สมเหตุสมผล
3. **EXCLUDE ของ roomId ใช้เฉพาะห้อง capacity=1** (ถามผู้ใช้แล้วเลือกตัวเลือกนี้จาก 3 ตัวเลือก) — เก็บ
   `roomCapacityAtBooking` (snapshot ของ `Room.capacity` ตอนสร้างแถว คล้ายหลักการ ADR-008) ไว้บน
   `AppointmentItem` แล้วใส่ในเงื่อนไข WHERE ของ constraint เอง (`WHERE ... AND "roomCapacityAtBooking" = 1`)
   ห้อง capacity > 1 (เช่นห้องทำเล็บ 2 ที่นั่ง) ไม่ได้รับการป้องกันที่ระดับ DB constraint เลยตอนนี้ — ต้องกัน
   ด้วย transaction + row lock ที่ระดับ service ตอนสร้างนัดจริง (ยังไม่ได้ implement เพราะ endpoint สร้างนัด
   ยังไม่เกิดใน T4.2 — Task ที่จะสร้าง endpoint นี้ในอนาคตต้องอ่าน ADR นี้ก่อนเขียน service.create ของ
   Appointment)
4. **เพิ่ม EXCLUDE constraint ด้วย raw SQL เขียนเองในไฟล์ migration** — Prisma schema DSL ไม่มีทางประกาศ
   EXCLUDE constraint ได้เลย (ต่างจาก GIN trgm index ที่ยังพอมี `@@index(type: Gin)` ให้ใช้ตาม ADR-017)
   **ทดสอบแล้วจริง**: รัน `prisma migrate dev` ซ้ำหลังใส่ constraint เข้าไป ผลคือ "Already in sync, no
   schema change or pending migration was found" — Prisma ไม่เสนอ DROP CONSTRAINT ทิ้งเหมือนที่เคยเกิดกับ
   index ใน ADR-017 เพราะ EXCLUDE constraint ไม่ใช่ concept ที่ Prisma รู้จัก/diff เทียบกับ schema.prisma
   เลยด้วยซ้ำ (ต่างจาก index ที่ Prisma รู้จักและ diff ผ่าน `@@index` แต่แค่ไม่มี syntax ให้ประกาศ EXCLUDE
   โดยเฉพาะ) — สรุปคือ **ปลอดภัยกว่ากรณี index เดิม ไม่ต้องกังวลเรื่องนี้ซ้ำอีก** แต่ก็แปลว่า schema.prisma
   "โกหก" อยู่เล็กน้อย (ไม่ได้สะท้อนทุก constraint ที่มีจริงในตาราง) — แก้ด้วยการเขียนคอมเมนต์อธิบายไว้ในตัว
   schema.prisma ตรงโมเดล `AppointmentItem` เอง ให้คนอ่านรู้ทันทีว่าต้องดูไฟล์ migration ประกอบด้วย

เหตุผล: ตัวเลือกที่ถูกเลือกสำหรับ room capacity (ข้อ 3) เป็นตัวเลือกที่ implement น้อยที่สุดตอนนี้ (ไม่ต้อง
เพิ่ม concept "ที่นั่ง/seat" ใหม่ที่ไม่มีใครขอ และไม่กระทบ T4.1 ที่ทำเสร็จไปแล้ว) ตรงกับสภาพร้านจริงที่ห้อง
ส่วนใหญ่ capacity=1 (`Room.capacity @default(1)`) และไม่ปิดทางแก้ทีหลังถ้าร้านต้องการห้อง multi-seat จริงจัง
(เพิ่ม transaction+lock ตอนสร้าง endpoint จองจริงได้โดยไม่ต้อง migrate schema ใหม่)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) เพิ่ม concept "ที่นั่ง" (seatIndex) ให้ทุกห้องแล้ว
EXCLUDE บน roomId+seatIndex+ช่วงเวลา — ปฏิเสธเพราะ over-engineer เกินความจำเป็นตอนนี้และต้องแก้ T4.1 ที่ปิด
งานไปแล้วให้คืน seat ด้วย (2) ตัดฟีเจอร์ room capacity>1 ออกจากระบบทั้งหมด (ล็อก capacity=1 เสมอ) —
ปฏิเสธเพราะ T4.1 ทำรองรับไว้แล้วและอาจมีประโยชน์จริงในอนาคต ไม่มีเหตุผลต้องตัดทิ้งทั้งที่ schema เดิมรองรับ
อยู่แล้ว — **ข้อควรระวังสำหรับ Task ในอนาคตที่จะสร้าง endpoint จองจริง**: ต้องจำไว้ว่าห้อง capacity>1 ยังไม่
มี hard guarantee ระดับ DB กันชนกันเกิน capacity เลยตอนนี้ ต้องเพิ่ม transaction+`SELECT ... FOR UPDATE`
หรือเทียบเท่าเองตอน implement การสร้างนัดจริง มิเช่นนั้นจะมี race condition ที่ EXCLUDE constraint ปัจจุบัน
จับไม่ได้

---

## ADR-021: กติกาการข้ามสถานะนัด (T4.3) — ลัด BOOKED→CHECKED_IN ได้, ยกเลิก/ไม่มาได้เฉพาะก่อนเช็คอิน, ไม่มีทางย้อนกลับ

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.3

บริบท: docs/PLAN.md ให้แค่ลำดับสถานะหลัก (`booked → confirmed → checked_in → in_service → completed`
+ `no_show` / `cancelled`) แต่ไม่ได้ระบุกติกาการข้ามสถานะแบบละเอียด (ข้ามขั้นได้ไหม ย้อนกลับได้ไหม ยกเลิกได้
ถึงขั้นไหน) — docs/DOMAIN.md ก็ไม่ได้ตอบคำถามนี้ตรง ๆ (คำถาม 18 ข้อในหัวข้อ 8 ไม่มีข้อไหนถามเรื่องนี้)
ต้องตัดสินใจเองเพราะเป็นรายละเอียดการ implement state machine ไม่ใช่กติกาธุรกิจที่ AI เดาไม่ได้ (ต่างจาก
เรื่องเงิน/ค่ามือที่ต้องถามเจ้าของร้านเสมอ)

ตัดสินใจ (กราฟการข้ามสถานะเต็ม อยู่ที่ `packages/contracts/src/booking.ts`):
- เส้นทางหลัก: `BOOKED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED`
- ลัดได้: `BOOKED → CHECKED_IN` ตรง ๆ (ข้าม `CONFIRMED`) — รองรับลูกค้า walk-in (T4.6) ที่มาถึงร้านแล้วเลย
  ไม่มีขั้น "โทรยืนยัน" ให้ทำก่อน
- ยกเลิก (`CANCELLED`) และไม่มา (`NO_SHOW`) ทำได้เฉพาะจาก `BOOKED`/`CONFIRMED` เท่านั้น (ก่อนเช็คอิน) —
  เช็คอินแล้วถือว่าลูกค้ามาจริงแล้ว ไม่มีเหตุผลทางธุรกิจให้ "ยกเลิก" หรือ "ไม่มา" หลังจากนั้น
- ไม่มีทางย้อนสถานะกลับเลยแม้แต่ก้าวเดียว (เช่น `CHECKED_IN → BOOKED`, `COMPLETED → IN_SERVICE`) — ทุก
  สถานะเป็น "เดินหน้าทางเดียว" ยกเว้นจะสร้างนัดใหม่
- สถานะปลายทาง (`COMPLETED`/`NO_SHOW`/`CANCELLED`) ไปต่อไม่ได้อีกเลยไม่ว่ากรณีใด
- self-transition (สถานะเดิมไปสถานะเดิม) ไม่ถือเป็นการเปลี่ยนสถานะที่อนุญาต (ไม่มี use case จริงที่ต้องทำ)
- ใช้ permission `booking:manage` เดียวสำหรับทุกการเปลี่ยนสถานะ (ไม่แยกสิทธิ์ย่อยตาม target status) —
  ตรงกับแพทเทิร์นที่ทุกโมดูลก่อนหน้าใช้ (`xxx:view`/`xxx:manage` สองระดับเท่านั้น ไม่มีความละเอียดกว่านี้ที่
  ไหนในระบบเลย) และ `booking:manage` มีอยู่แล้วใน seed ให้ owner/manager/cashier (ไม่ใช่ staff ธรรมดา) ตรง
  กับที่พนักงานต้อนรับ/แคชเชียร์เป็นคนจัดการคิวจริงในร้าน
- ตรรกะการข้ามสถานะ (`canTransitionAppointmentStatus`) อยู่ที่ `packages/contracts` ไม่ใช่ apps/api ตรง ๆ —
  เพราะ apps/web (T4.5 Lane Board) จะต้องใช้ตัวเดียวกันเพื่อปิดปุ่ม/ตัวเลือกที่ข้ามสถานะไม่ได้ก่อนยิง
  request จริงด้วยซ้ำ (ประสบการณ์ใช้งานดีกว่าปล่อยให้กดแล้วเจอ 422)

เหตุผล: กติกาทั้งหมดออกแบบจากการอ่าน flow การใช้งานจริงของร้านสปา (พนักงานต้อนรับกดสถานะตามที่เห็นลูกค้าทำ
จริงหน้าร้าน) ไม่ใช่การเดากติกาธุรกิจที่กระทบเงิน (ไม่มีผลต่อค่ามือ/ราคาโดยตรง — T5.5 ใบงานต่างหากที่ผูกกับ
ค่ามือ) จึงไม่เข้าเกณฑ์ "ต้องถามเจ้าของร้านก่อน" ตาม CLAUDE.md — เป็นการตัดสินใจเชิง engineering ล้วน ๆ ที่
กลับมาแก้ทีหลังได้ง่ายถ้าร้านใช้จริงแล้วพบว่ากติกาไม่ตรงกับที่ต้องการ (แค่แก้ตาราง transition ในไฟล์เดียว)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) บังคับผ่าน `CONFIRMED` เสมอไม่มีทางลัด — ปฏิเสธ
เพราะจะทำให้ walk-in (T4.6) ต้องกดสถานะเกินจำเป็น 1 ครั้งทุกครั้งโดยไม่มีประโยชน์ (2) อนุญาตยกเลิกได้ทุก
สถานะรวมถึงหลังเช็คอิน — ปฏิเสธเพราะไม่มี use case จริงรองรับ (ถ้าลูกค้าเช็คอินแล้วแต่ไม่ได้รับบริการจริง
กรณีนี้ยังไม่มี requirement ชัดเจน รอ Task ในอนาคตถ้าพบว่าจำเป็นจริง) (3) แยก permission ย่อยตาม target
status (เช่น ต้องมีสิทธิ์พิเศษถึงจะยกเลิกได้) — ปฏิเสธเพราะไม่ตรงกับ permission model 2 ระดับที่ใช้ทั้งระบบ
และ DOMAIN.md ก็ไม่ได้ขอความละเอียดระดับนี้

---

## ADR-022: คิวหมุน (T4.4) — persisted position ต่อวัน, ผูกกับ status transition, ขยาย NO_SHOW ให้พฤติกรรมเหมือน CANCELLED

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.4

บริบท: docs/DOMAIN.md ตอบกติกาคิวหมุนไว้ 3 ข้อ (เรียงตามเวลามาถึง, "ลูกค้าขอ" เสียตำแหน่ง, ยกเลิกกะทันหันได้
กลับต้นคิว) แต่ docs/PLAN.md T4.4 เองกลับใช้คำว่า "ตั้งค่าได้ว่า..." (ให้เป็น setting ไม่ใช่ค่าตายตัว) และ
ไม่ได้พูดถึง NO_SHOW เลย ต้องตัดสินใจเพิ่ม 3 เรื่อง

ตัดสินใจ:
1. **`Branch.customRequestKeepsQueuePosition: Boolean @default(false)`** — ทำเป็นค่าตั้งค่าต่อสาขาได้จริง
   ตามที่ T4.4 ระบุ แต่ตั้งค่าเริ่มต้นเป็น `false` ให้ตรงกับคำตอบจริงของร้านนี้ใน docs/DOMAIN.md ข้อ 2
   ("เสียตำแหน่ง — นับเป็นงานปกติ") — คืนความยืดหยุ่นไว้เผื่อร้านอื่นในอนาคตใช้เอกสารนี้ชุดเดียวกัน
2. **เพิ่ม `AppointmentItem.assignType: AssignType` (`ROTATION`/`CUSTOMER_REQUEST`)** — จำเป็นเพื่อให้รู้ว่า
   งานที่จบไปเป็นแบบไหนตอนคำนวณผลต่อคิว ค่านี้ยังผูกกับ T4.5 Lane Board ด้วย (บล็อก "ลูกค้าขอ" มีจุด brass
   มุมขวาบนตาม docs/PLAN.md §7.3) จึงใส่ไว้ที่ AppointmentItem โดยตรงตั้งแต่ T4.4 นี้เลย
3. **NO_SHOW ให้พฤติกรรมเหมือน CANCELLED (กลับหัวคิวเช่นกัน)** — DOMAIN.md ข้อ 3 พูดถึงแค่ "ยกเลิกกะทันหัน"
   (ตรงกับ status `CANCELLED`) ไม่ได้พูดถึง `NO_SHOW` ตรง ๆ แต่หลักการเดียวกัน ("ไม่ใช่ความผิดพนักงาน" —
   พนักงานรอคิวไว้แล้วแต่ไม่ได้งานจริง) ใช้ได้กับ NO_SHOW เท่ากัน — ตัดสินใจขยายกติกาให้ครอบคลุมทั้งสอง
   สถานะ ไม่ใช่การเดากติกาธุรกิจใหม่ (ไม่กระทบเงิน แค่ลำดับคิวซึ่งเป็นเรื่อง fairness ภายในทีม แก้ทีหลังง่าย
   ถ้าร้านต้องการพฤติกรรมต่างกัน)
4. **ตรรกะคิวหมุน (`joinQueue`/`moveToBack`/`moveToFront`/`reorderAfterJobCompleted`) อยู่ที่
   `apps/api/src/modules/booking/staff-queue.ts`** ไม่ใช่ `packages/core` หรือ `packages/contracts` —
   ต่างจาก `canTransitionAppointmentStatus` (T4.3) ที่อยู่ contracts เพราะฝั่งเว็บต้องใช้ตัดสินใจ UI ด้วย
   ตรรกะคิวหมุนเป็นเรื่อง server-side mutation ล้วน ๆ ไม่มีเหตุผลให้ client คำนวณเองซ้ำ
5. **การย้ายคิว (จบงาน/ยกเลิก/ไม่มา) อยู่ในทรานแซกชันเดียวกับการอัปเดตสถานะเสมอ** (ใน
   `AppointmentItemController.updateStatus`) — กันสถานะกับตำแหน่งคิวไม่ตรงกันถ้า process ล่มกลางคัน
6. **renumber ทั้งคิวใหม่ทุกครั้งที่มีการเปลี่ยนแปลง** (ไม่ใช้เลขตำแหน่งแบบเศษส่วน/มีช่องว่าง) — ร้านมี
   พนักงานไม่กี่คนต่อวัน renumber ทั้งหมดทุกครั้งไม่ใช่ปัญหาประสิทธิภาพ และโค้ดอ่านง่ายกว่ามาก

เหตุผล: ทุกข้อเป็นการตัดสินใจเชิง engineering ที่มีคำตอบทางเทคนิคชัดเจนหรือขยายจากหลักการที่ DOMAIN.md ให้ไว้
แล้วอย่างสมเหตุสมผล ไม่ใช่การเดากติกาธุรกิจที่กระทบเงินโดยตรง (คิวหมุนกระทบแค่ลำดับการรับงาน ไม่ใช่ค่ามือ/
ราคา — ค่ามือคำนวณจากใบงานจริงที่ T5.5/T6.2 แยกต่างหาก)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) ไม่แยก NO_SHOW ออกจาก "ไม่มีผลต่อคิวเลย" (ปล่อยตำแหน่ง
เดิมไว้เฉย ๆ) — ปฏิเสธเพราะขัดกับหลักการ "ไม่ใช่ความผิดพนักงาน" ที่ DOMAIN.md วางไว้ (2) ใช้เลขตำแหน่งแบบ
เศษส่วน (เช่น แทรกที่ 0.5) แทน renumber ทั้งคิว — ปฏิเสธเพราะซับซ้อนเกินความจำเป็นสำหรับคิวขนาดเล็ก (3) เก็บ
`customRequestKeepsQueuePosition` เป็น env var / ค่าคงที่แทนที่จะเป็นคอลัมน์ต่อสาขา — ปฏิเสธเพราะ T4.4 ระบุ
ชัดว่าต้อง "ตั้งค่าได้" (เป็น runtime setting ไม่ใช่ build-time constant) — **ข้อควรระวังสำหรับ Task ในอนาคต
ที่จะสร้าง endpoint สร้างนัดจริง**: ต้องกำหนด `assignType` ให้ถูกต้องตอนสร้าง AppointmentItem เสมอ (ค่า
default เป็น `ROTATION` ถ้าไม่ได้ตั้งใจเลือก "ลูกค้าขอ" ชัดเจน)
