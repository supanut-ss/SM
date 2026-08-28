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

---

## ADR-023: Lane Board (T4.5) — HTML5 drag-and-drop + pointer events (ไม่ใช่ pointer events ล้วน), reschedule ไม่ผูก availability engine เต็มรูป, ไม่มี toast component

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.5

บริบท: T4.5 เป็น Task ใหญ่และเสี่ยงที่สุดใน M4 (★★) โจทย์ระบุว่า "ห้ามใช้ไลบรารี scheduler สำเร็จรูป —
เขียนเองด้วย CSS Grid + pointer events" และให้ virtualize ด้วย `@tanstack/react-virtual` (ชื่อ library
ที่ระบุตรง ๆ ในตัว docs/PLAN.md เอง จึงถือว่าอนุญาตแล้วไม่ต้องถามซ้ำตาม CLAUDE.md เรื่องเพิ่ม dependency ใหม่)
ระหว่าง implement พบว่าต้องตัดสินใจเพิ่มหลายเรื่องที่ PLAN.md ไม่ได้ลงรายละเอียด

ตัดสินใจ:
1. **ลาก "ย้าย" บล็อกใช้ HTML5 native drag-and-drop (`draggable`/`onDragStart`/`onDragOver`/`onDrop`) ไม่ใช่
   pointer events ล้วนตามที่โจทย์เขียนตรง ๆ** — เหตุผล: repo นี้มีแพทเทิร์นลาก-วางแบบเดียวกันอยู่แล้วจริงที่
   `apps/web/src/app/(app)/staff/shifts/shifts-page-client.tsx` (ลากแม่แบบกะไปวางบนตาราง) ใช้ native D&D
   สำเร็จมาก่อน — คงความสม่ำเสมอของโค้ดเบสดีกว่า และ native D&D ก็ยัง "ไม่ใช่ไลบรารี scheduler สำเร็จรูป"
   ตามเงื่อนไขที่ห้ามไว้ (มันคือ browser API ไม่ใช่ npm package) จึงไม่ขัดกติกาจริง — คำนวณเวลาเป้าหมายจาก
   `e.clientX` ตอน drop (พิกเซล → นาที) ไม่ใช่ drop บน "ช่องกริดแยก" แบบตารางกะรายสัปดาห์เดิม เพราะแกนเวลา
   ที่นี่ต่อเนื่อง (นาทีจริง) ไม่ใช่ "1 ช่อง = 1 วัน" แบบเดิม
2. **ลาก "ย่อ/ขยาย" (resize) ใช้ pointer events จริง** (`onPointerDown`/`window.addEventListener("pointermove"/"pointerup")`
   + `setPointerCapture`) — เพราะ native D&D ให้ feedback ระหว่างลากได้แย่กว่า (ไม่มี drag-over ที่ smooth
   พอสำหรับพรีวิวความกว้างบล็อกแบบ real-time) ตรงกับที่โจทย์อยากได้ pointer events จริง ๆ สำหรับ interaction
   ที่ต้องการความ smooth — สรุปคือใช้ทั้งสองแบบผสมกันตามความเหมาะสมของแต่ละ interaction ไม่ใช่เลือกอันเดียว
   ทั้งหมด
3. **`reschedule` endpoint (T4.5) ไม่ผูก availability engine (T4.1) เต็มรูป** — ตรวจแค่ (ก) ทักษะพนักงานตรง
   กับที่บริการต้องใช้ (ข) ประเภทห้องตรงกับที่บริการต้องใช้ (ค) ปล่อยให้ EXCLUDE constraint (T4.2) เป็นด่าน
   สุดท้ายกันชนจริง — **ยังไม่เช็คว่าเวลาที่ลากไปอยู่ในกะพนักงานหรือไม่** เพราะการเรียก `findAvailableSlots`
   แบบเต็มรูปสำหรับ "เช็คสล็อตเดียว" ต้องประกอบ input ทั้งชุด (shifts/leaves/existing ทั้งวัน) ซึ่งเป็นงาน
   วิศวกรรมเพิ่มเติมที่ยังไม่จำเป็นต่อเกณฑ์ผ่านของ T4.5 (เกณฑ์คือ "ลากแล้วชนต้องเด้งกลับพร้อมบอกเหตุผล" ซึ่ง
   วัดที่การชนกันของนัด ไม่ใช่การชนขอบกะ) — ทำเครื่องหมายไว้เป็นข้อควรระวังสำหรับ Task ในอนาคต
4. **ไม่มี toast component** — repo นี้ยังไม่มี Toast ใน `packages/ui` แม้ docs/DESIGN.md §6 จะพูดถึง Toast
   เป็นหนึ่งใน 4 จุดที่ใช้ motion ก็ตาม — ใช้ error banner แบบเดียวกับทุกหน้าที่มีอยู่แล้วแทน (`role="alert"`
   แถบสีข้อความ rose เหนือตาราง) ไม่สร้าง Toast component ใหม่ใน Task นี้เพราะเป็น UI primitive ข้ามหน้าที่
   ควรออกแบบแยกต่างหาก ไม่ใช่ผลพลอยได้จาก Task เดียว
5. **กระดานคงที่ 08:00–22:00 (14 ชั่วโมง) เสมอ ไม่คำนวณจากกะพนักงานจริงของวันนั้น** — ตรงกับเกณฑ์ประสิทธิภาพ
   ที่ระบุไว้ตรง ๆ ("พนักงาน 40 คน × 14 ชม.") ทำให้ทดสอบ/อ้างอิงตรงกับเกณฑ์ได้ชัดเจน ปรับเป็น dynamic ทีหลัง
   ได้ง่ายถ้าร้านต้องการ
6. **virtualize เกิน 30 แถวเท่านั้น** (`VIRTUALIZE_THRESHOLD`) — ต่ำกว่านั้น render ปกติ กัน overhead ของ
   virtualizer ที่ไม่จำเป็นเมื่อพนักงานน้อย (ร้านสาขาเดียวช่วงแรกมีพนักงานไม่กี่คน)
7. **คีย์บอร์ด: ArrowLeft/Right เปลี่ยนนัดในแถวเดียวกันตามลำดับเวลา, ArrowUp/Down ข้ามไปแถวถัดไปแล้วเลือกนัด
   ที่เวลาใกล้เคียงที่สุด (ข้ามแถวว่างอัตโนมัติ), Shift+ArrowLeft/Right เลื่อนเวลานัดที่เลือกทีละ granularity**
   — ออกแบบให้ตรงกับ mental model ของตาราง (แถว = คน, คอลัมน์ = เวลา) ไม่ใช่แค่ flat list เดียว

เหตุผล: ทุกข้อเป็นการชั่งน้ำหนักระหว่างความสมบูรณ์แบบทางทฤษฎีกับเวลา/ความซับซ้อนที่ใช้จริงในเซสชันเดียว —
เลือกสิ่งที่ตรงกับเกณฑ์ผ่านที่ระบุไว้จริงและปลอดภัย (ไม่ผูกมัดสถาปัตยกรรมจนแก้ทีหลังยาก) มากกว่าสร้างของที่
สมบูรณ์เกินความจำเป็นตอนนี้แล้วเสี่ยง regression จาก scope ที่ใหญ่เกินไป

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) เขียน drag ทั้งหมดด้วย pointer events ตามตัวอักษรของ
โจทย์เป๊ะ — ปฏิเสธเพราะขัดกับความสม่ำเสมอของโค้ดเบสที่มีอยู่แล้วโดยไม่ได้ประโยชน์เพิ่มจริง (2) ผูก
availability engine เต็มรูปเข้ากับ reschedule ตั้งแต่ตอนนี้ — เก็บไว้เป็นงานต่อยอด ไม่ใช่ปฏิเสธถาวร (3) สร้าง
Toast component ใหม่ทันที — เก็บไว้เป็น Task/ADR แยกในอนาคตถ้าจำเป็นจริงหลายหน้าพร้อมกัน — **ข้อควรระวังสำหรับ
Task ในอนาคต**: ถ้าจะสร้าง endpoint สร้างนัดใหม่ (ไม่ใช่แค่ reschedule ที่มีอยู่แล้ว) ควรผูก
`findAvailableSlots` (T4.1) เข้าไปด้วยให้ครบ เพราะตอนนั้นไม่มี "นัดเดิม" ให้อ้างอิงเหมือน reschedule แล้ว
ต้องเช็คกะตั้งแต่ต้น

---

## ADR-024: จองด่วนจากคิวหมุน (T4.6) — auto-assign ผ่าน findAvailableSlots จริง, เช็คอินทันทีข้าม BOOKED/CONFIRMED, ไม่ต้องมี memberId, พิมพ์ด้วย CSS ล้วน

วันที่: 2026-08-23
Task ที่เกี่ยวข้อง: T4.6 (Task สุดท้ายของ M4)

บริบท: T4.6 คือ endpoint "สร้างนัดใหม่" ตัวแรกในระบบทั้งหมด (T4.2-T4.5 ก่อนหน้ามีแต่แก้/ย้ายนัดที่มีอยู่แล้ว)
เกณฑ์ผ่านคือ "จองลูกค้าเดินเข้าเสร็จใน ≤ 4 คลิก" — ต้องตัดสินใจว่าระบบเลือกพนักงาน/ห้อง/เวลาให้เองอย่างไร

ตัดสินใจ:
1. **ใช้ `findAvailableSlots` (T4.1) เต็มรูปจริง** ตามที่ ADR-023 ทิ้งข้อควรระวังไว้ — ประกอบ input จาก
   StaffShift/StaffLeave/AppointmentItem ของ "วันนี้" ทั้งหมด แล้วขอช่องที่เริ่มเร็วที่สุด (ตอนนี้เลยถ้า
   เป็นไปได้) ในบรรดาคนที่ว่างพร้อมกันตอนนั้น **เลือกคนที่อยู่หัวคิวหมุนที่สุด** (`StaffQueueEntry.position`
   ต่ำสุด) — ตรงกับชื่อ "จองด่วนจากคิวหมุน" ตรง ๆ ไม่ใช่แค่ "คนแรกที่ว่าง"
2. **สร้างด้วยสถานะ `CHECKED_IN` ทันที ข้าม `BOOKED`/`CONFIRMED` ทั้งคู่** — ลูกค้า walk-in ยืนอยู่หน้าร้าน
   แล้วจริง ๆ ไม่มีเหตุผลให้ผ่านสถานะที่แปลว่า "ยังไม่มา" เลย ใช้ทางลัดของ state machine (T4.3, ADR-021)
   ที่อนุญาต `BOOKED → CHECKED_IN` อยู่แล้วแต่ข้ามไปได้ไกลกว่านั้นอีกเพราะเป็นการสร้างใหม่ ไม่ใช่ transition
3. **`memberId` ไม่บังคับ** — `Appointment.memberId` nullable อยู่แล้วตั้งแต่ T4.2 การบังคับให้ค้นหา/สร้าง
   สมาชิกก่อนจองจะทำให้เกิน 4 คลิกได้ง่าย ๆ (ต้องค้นหา+เลือก+ยืนยันอย่างน้อย) — Lane Board (T4.5) แสดง
   "ลูกค้า Walk-in" อยู่แล้วเป็นค่าเริ่มต้นเมื่อไม่มีสมาชิกผูกไว้ ผูกสมาชิกทีหลังได้ผ่านการแก้ไขนัด (ยังไม่มี
   UI แก้ไขส่วนนี้ตอนนี้ — เก็บเป็นข้อควรระวังสำหรับอนาคต)
4. **`assignType` เป็น `ROTATION` เสมอ** — เพราะ endpoint นี้นิยามตัวเองว่า "จากคิวหมุน" (ถ้าลูกค้าต้องการ
   พนักงานคนใดคนหนึ่งเจาะจง ต้องใช้ Lane Board ลาก-วางเลือกเองแทน ซึ่งเป็นคนละ flow — endpoint นี้ไม่รับ
   staffId/roomId จาก client เลยด้วยเหตุผลเดียวกัน)
5. **พิมพ์ใบคิวด้วยเทคนิค CSS ล้วน** (`@media print` ซ่อนทั้งหน้าด้วย `visibility: hidden` แล้วเปิดเฉพาะ
   element เป้าหมาย) ไม่แก้ `AppShell`/`Sidebar`/`Topbar`/layout ใด ๆ เลย — เป็นเทคนิคมาตรฐานที่ทำงานได้จริง
   โดยไม่ต้องเพิ่ม dependency หรือแตะ shared layout code ข้ามหน้า

เหตุผล: การใช้ availability engine เต็มรูปแทนการเขียน logic คู่ขนานใหม่ (ที่ ADR-023 เคยเลี่ยงไว้ตอน
reschedule) ตรงนี้คุ้มค่าเพราะ T4.6 ไม่มี "นัดเดิม" ให้อ้างอิงเหมือน reschedule เลย จำเป็นต้องเช็คกะ/ความว่าง
เต็มรูปแบบอยู่แล้วเพื่อความถูกต้อง ไม่ใช่ทางเลือก — ทุกข้อที่เหลือเลือกเส้นทางที่สั้นที่สุดสำหรับพนักงาน
ต้อนรับหน้าร้าน (เกณฑ์ ≤ 4 คลิก) โดยไม่ทำให้ข้อมูลผิดหลักการที่วางไว้ก่อนหน้า (ไม่ลบ/ข้าม audit, ไม่ผูกมัด
สถาปัตยกรรมใหม่)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) ให้พนักงานต้อนรับเลือกพนักงาน/ห้องเองในฟอร์มจองด่วน
— ปฏิเสธเพราะขัดกับคำว่า "ด่วน" และเกณฑ์ 4 คลิกโดยตรง (สลับไปใช้ Lane Board แทนถ้าต้องการควบคุมเอง) (2)
บังคับผูก memberId เสมอ — ปฏิเสธตามเหตุผลข้อ 3 ข้างบน (3) เลือกพนักงานแบบ "คนแรกที่ trueในลิสต์" แทนการเรียง
ตามคิวหมุน — ปฏิเสธเพราะขัดกับ docs/DOMAIN.md ข้อ 1 (เรียงตามเวลามาถึง) ที่คิวหมุนถูกออกแบบมาเพื่อเรื่องนี้
โดยเฉพาะ — **ข้อควรระวังสำหรับ Task ในอนาคต**: (ก) ยังไม่มี UI ผูก/แก้ไขสมาชิกให้นัด walk-in ที่สร้างไปแล้ว
(ข) ยังไม่มีการย้ายพนักงานที่ถูกจ่ายงานเข้าคิวหมุนอัตโนมัติถ้ายังไม่เคย "เข้าคิว" มาก่อน (ยังต้องกดเข้าคิวเอง
ผ่าน T4.4 endpoint ก่อน endpoint นี้ถึงจะพิจารณาลำดับคิวให้ถูกต้อง — ถ้าพนักงานไม่เคยเข้าคิวเลยจะยังได้รับ
เลือกได้ถ้าว่าง แต่จะถูกจัดลำดับความสำคัญท้ายสุด (`Infinity`) เทียบกับคนที่เข้าคิวแล้ว)

---

## ADR-025: คอร์ส/แพ็กเกจ (T5.1) — catalog ล้วน ไม่มี transferable/freezable flags, ผูก ServiceVariant เดียวเฉพาะ SESSION_COUNT/UNLIMITED_DURATION, แก้ไขได้แค่ name/price/validDays/isActive

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.1 (Task แรกของ M5)

บริบท: T5.1 คือ catalog ของคอร์ส/แพ็กเกจ 3 แบบ (SESSION_COUNT/VALUE/UNLIMITED_DURATION) — ยังไม่ใช่ยอด
คงเหลือของลูกค้าคนใด (นั่นคือ `MemberPackage` + ledger ของ T5.2 ตาม CLAUDE.md ข้อ 7) docs/DOMAIN.md มีกฎ
เกี่ยวกับคอร์สหลายข้อ (#5 หมดอายุใช้ได้ถ้าผู้จัดการอนุมัติ, #6 โอนได้ทั้งใบเท่านั้น, #7 คืนเงินคิดเต็มราคาที่
ใช้ไปแล้วไม่ใช่สัดส่วน, #8 แช่แข็งได้สูงสุด 30 วัน/ปี ต้องผู้จัดการอนุมัติ) ต้องตัดสินใจว่าอะไรอยู่ใน catalog
(T5.1) และอะไรเป็นเรื่องของ ledger operation (T5.2)

ตัดสินใจ:
1. **ไม่มีฟิลด์ `transferable`/`freezable` (boolean) บน `Package`** — กฎ DOMAIN.md #5/#6/#8 (หมดอายุ/โอน/
   แช่แข็ง) ใช้แบบเดียวกันกับคอร์สทุกใบในระบบเสมอ (ต้องผู้จัดการอนุมัติทุกกรณี) ไม่ใช่คุณสมบัติที่ผันแปรตาม
   catalog แต่ละรายการ — เป็นเรื่องของ *การอนุญาต operation บน ledger* (T5.2) ไม่ใช่คุณสมบัติของ catalog
   เพิ่มฟิลด์ตอนนี้จะสร้างความสับสนว่า "ปิด transferable ที่นี่ = ห้ามโอนแม้ผู้จัดการอนุมัติ" ซึ่งขัดกับ
   DOMAIN.md ที่ไม่เคยพูดถึงข้อยกเว้นต่อคอร์สรายตัว
2. **`SESSION_COUNT`/`UNLIMITED_DURATION` ผูกกับ `ServiceVariant` เดียวเสมอ (บังคับ `serviceVariantId`),
   `VALUE` ไม่ผูกกับบริการใดเลย (`serviceVariantId = null`)** — ตรงกับความหมายจริงของแต่ละแบบ: นับจำนวน
   ครั้ง/ไม่จำกัดเวลา ต้อง "นับ" กับบริการใดบริการหนึ่งเจาะจงถึงจะมีความหมาย ส่วนมูลค่า (บัตรเงินสด) ตัดยอด
   ข้ามบริการได้โดยธรรมชาติ — ใช้ `z.discriminatedUnion("type", ...)` ที่ชั้น contracts บังคับรูปร่างนี้ตรง
   ๆ ตั้งแต่ก่อนเข้า DB ไม่ปล่อยให้ client ส่ง `serviceVariantId` มาพร้อม `type: "VALUE"` โดยไม่ error
3. **แก้ไขได้เฉพาะ `name`/`priceSatang`/`validDays`/`isActive` เท่านั้นหลังสร้างแล้ว** (`type`,
   `sessionCount`, `valueSatang`, `serviceVariantId` เปลี่ยนไม่ได้) — เพราะ T5.2 (ledger) จะอ้างอิงคอร์สที่
   ลูกค้าซื้อไปแล้วโดย snapshot ความหมายพื้นฐาน (จำนวนครั้งที่ซื้อ, บริการที่ผูกไว้) จาก catalog ตอนซื้อ ถ้า
   อนุญาตให้แก้ทีหลัง ยอดคงเหลือของลูกค้าที่ซื้อไปแล้วจะตีความผิดย้อนหลัง (เช่น เปลี่ยน `sessionCount` จาก 10
   เป็น 5 หลังลูกค้าซื้อไปแล้วจะทำให้ยอดคงเหลือเดิมงงว่านับจากฐานไหน) — ต้องการเปลี่ยนความหมายพื้นฐานจริง ๆ
   ให้ปิดขาย (`isActive: false`) แล้วสร้างรายการใหม่แทน
4. **endpoint สร้าง/แก้ไข ตรวจ `serviceVariantId` ต้องอยู่ในสาขาเดียวกันเสมอ** (ผ่าน `assertServiceVariantInBranch`) — รูปแบบเดียวกับ `ServiceController.assertRoomTypeInBranch` (T2.3) กัน
   คอร์สข้ามสาขาผูกบริการผิดสาขา

เหตุผล: ทุกข้อคือการแยกขอบเขตให้ชัดระหว่าง "catalog คงที่" (T5.1 — นิยามว่าคอร์สแบบนี้คืออะไร ราคาเท่าไหร่)
กับ "ธุรกรรมที่เปลี่ยนแปลงได้" (T5.2 ledger — ใครซื้อไปแล้วเท่าไหร่ ใช้ไปกี่ครั้ง โอน/แช่แข็ง/คืนเงินอย่างไร)
— ไม่ผสมสองเรื่องนี้เข้าด้วยกันตั้งแต่ต้น เพราะ CLAUDE.md ข้อ 7 (ห้าม UPDATE ยอดคงเหลือตรง ต้องผ่าน ledger)
บังคับให้ T5.2 ต้องเป็น append-only อยู่แล้ว — ถ้า catalog เองแก้ไขความหมายพื้นฐานได้อิสระ จะทำให้ ledger ที่
อ้างอิงย้อนหลังไม่สอดคล้องกับสิ่งที่บันทึกไว้

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) เพิ่ม `transferable`/`freezable` flags ตั้งแต่ตอนนี้
เผื่ออนาคตร้านอยากปิดสิทธิ์นี้ต่อคอร์สบางใบ — ปฏิเสธเพราะ DOMAIN.md ไม่เคยระบุกรณีนี้ เป็นการเดา requirement
ที่ไม่มีอยู่จริง (ผิดกฎ "ห้ามเดาแล้วเขียนต่อ" ของ CLAUDE.md) ถ้าจำเป็นจริงในอนาคตค่อยเพิ่มเป็น Task ใหม่ (2)
อนุญาตแก้ `type`/`sessionCount`/`valueSatang`/`serviceVariantId` ได้เสมอ — ปฏิเสธตามเหตุผลข้อ 3 ข้างบน (3)
ให้ `SESSION_COUNT`/`UNLIMITED_DURATION` ผูกได้หลาย `ServiceVariant` (เช่น ใช้ได้กับทุกระยะเวลาของบริการ
เดียวกัน) — เก็บไว้เป็นแนวทางขยายในอนาคตถ้าร้านต้องการจริง ไม่ใช่ปฏิเสธถาวร แต่ตอนนี้ผูกเดียวง่ายต่อการนับ
ยอดคงเหลือใน T5.2 ชัดเจนกว่า — **ข้อควรระวังสำหรับ Task ในอนาคต**: T5.2 (ledger) ต้อง snapshot
`sessionCount`/`valueSatang`/`priceSatang` ของ `Package` ณ เวลาที่ลูกค้าซื้อลงใน `MemberPackage` ตรง ๆ
ไม่ใช่ join กลับไปอ่านค่าจาก `Package` สด ๆ ทุกครั้ง (เพราะแม้ `priceSatang` แก้ได้ตาม ADR นี้ ก็ไม่ควรกระทบ
ราคาที่ลูกค้าจ่ายไปแล้วในอดีต) — ตรงกับหลักการเดียวกับที่ `ServiceController` (T2.3, comment ในโค้ด) วางไว้
สำหรับ `ServiceJob` ใน T5.5

---

## ADR-026: MemberPackage + ledger append-only (T5.2) — ledger เดียว delta ตัวเดียว, row lock กัน race, โอนคือปิดใบเก่า+สร้างใบใหม่, อนุมัติผู้จัดการเช็คแค่ role ยังไม่มี PIN

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.2 (Task ที่สองของ M5 — money-critical ★)

บริบท: T5.2 คือยอดคงเหลือจริงของลูกค้าแต่ละคน (ต่างจาก T5.1 ที่เป็นแค่ catalog) — CLAUDE.md ข้อ 7 บังคับ
ห้าม UPDATE ยอดคงเหลือตรง ต้อง INSERT ลง ledger แล้วอ่านผลรวมเสมอ เกณฑ์ผ่านที่ docs/PLAN.md ระบุตรง ๆ คือ
"ตัดคอร์สแล้วยกเลิกบิล ต้องคืนครั้งอัตโนมัติและยอดตรง 100%" และ "ตัดพร้อมกัน 2 request เหลือ 1 ครั้ง ต้อง
สำเร็จแค่รายการเดียว" — ก่อนเขียนโค้ด ได้หยุดถามผู้ใช้ 3 คำถามสถาปัตยกรรมหลัก (ดู AskUserQuestion ในเซสชัน
นี้) เพราะเป็นการตัดสินใจโครงสร้างข้อมูลเงินที่แก้ทีหลังยาก ไม่ใช่รายละเอียดเล็กที่เดาแล้วแก้ทีหลังง่าย —
ผู้ใช้ตอบ 3 ข้อคือ: (1) ledger ตารางเดียว ฟิลด์ `delta` ตัวเดียวความหมายขึ้นกับ `PackageType` ของใบนั้น (2)
โอนคอร์ส = ปิดใบเดิม + สร้างใบใหม่ให้ผู้รับ (ไม่ใช่ย้าย `memberId` บนแถวเดิม) (3) กันแข่งกันตัดยอดด้วย row
lock ระดับ transaction (`SELECT ... FOR UPDATE`) ไม่ใช่ DB trigger/constraint

ตัดสินใจเพิ่มเติมที่ไม่ได้ถาม (สมเหตุสมผล แก้ทีหลังง่าย ไม่ผูกมัดโครงสร้างข้อมูล):
1. **`MemberPackageLedgerKind` มี 7 ค่า**: PURCHASE/USE/REFUND/EXPIRE/FREEZE/TRANSFER_OUT/TRANSFER_IN —
   ตรงกับ "ทุกการซื้อ/ตัด/คืน/หมดอายุ/แช่แข็ง" ที่ docs/PLAN.md ระบุตรง ๆ ในคอลัมน์ "งาน" ของ T5.2 บวก
   TRANSFER 2 ทิศทาง (เพราะ DOMAIN.md ข้อ 6 พูดถึงการโอนโดยตรง แม้ไม่ได้อยู่ในลิสต์ 5 คำนั้น)
2. **`EXPIRE` เป็น manual action เท่านั้น ไม่ใช่ cron อัตโนมัติ** — เพราะ docs/DOMAIN.md ข้อ 5 ระบุชัดว่า
   "คอร์สหมดอายุแล้วยังใช้ได้ ถ้าผู้จัดการอนุมัติ" ดังนั้นการหมดอายุ (ผ่านเวลา `expiresAt`) เพียงอย่างเดียว
   **ไม่ควร** ไปล้างยอดคงเหลือทิ้งอัตโนมัติ (ลูกค้ายังทวงสิทธิ์คืนได้ผ่านผู้จัดการ) — `EXPIRE` ในระบบนี้คือ
   ผู้จัดการตัดสินใจ "ปิดยอดทิ้งถาวร" ต่างหาก (เช่น ลูกค้าหายไปเกิน 1 ปีไม่ติดต่อ) ต้องมีผู้จัดการอนุมัติ +
   เหตุผลเสมอ ส่วนงาน cron จริง (daily summary) อยู่ที่ T7.1 ซึ่งยังไม่ได้ทำในเซสชันนี้ — **ข้อควรระวังสำหรับ
   Task ในอนาคต**: ถ้าจะเพิ่ม auto-expire จริงทีหลัง ต้องตัดสินใจแยกว่ามันคือ status flag เฉย ๆ (ไม่กระทบ
   ยอด) หรือ ledger entry จริง (กระทบยอด) — ตอนนี้เลือกแบบหลังเฉพาะ manual path เท่านั้น
3. **แช่แข็งสูงสุด 30 วัน "ต่อคอร์ส 1 ใบ ตลอดอายุการใช้งาน" ไม่ใช่ "ต่อปีปฏิทิน"** — docs/DOMAIN.md ข้อ 8
   เขียนว่า "30 วันต่อปี" แต่ไม่ได้นิยามว่า "ปี" คือปีปฏิทิน (ต้อง reset ทุก 1 ม.ค.) หรือปีนับจากวันซื้อ
   คอร์สส่วนใหญ่ในระบบนี้มี `validDays` ≤ 365 วันอยู่แล้ว (90/180/365) ทำให้ตีความแบบ "ทั้งอายุคอร์ส" กับ
   "ต่อปี" แทบไม่ต่างกันในทางปฏิบัติ (คอร์สหมดอายุก่อนจะครบปีถัดไปอยู่ดี) จึงเลือกแบบเรียบง่ายที่สุดที่ไม่
   ต้องทำ calendar-year-rollover logic ซึ่ง DOMAIN.md ไม่ได้ระบุรายละเอียดพอจะทำถูกต้อง — implement เป็น
   `MAX_FREEZE_DAYS_PER_PACKAGE = 30` ใน packages/core คำนวณจากผลรวม `freezeDays` ของ ledger entry kind
   FREEZE ทั้งหมดของใบนั้น (ไม่มี cache column แยก ตรงกับหลัก "อ่านจากผลรวมเสมอ") — **ข้อควรระวังสำหรับ
   Task ในอนาคต**: ถ้าเจ้าของร้านยืนยันว่าต้องการ reset ทุกปีปฏิทินจริง ต้องกลับมาแก้จุดนี้
4. **ผู้อนุมัติ (`approvedByUserId`) เช็คแค่ role (`owner`/`manager`) ของสาขานั้น ยังไม่มีการยืนยันตัวตนด้วย
   PIN** — endpoint รับ `approvedByUserId` มาตรง ๆ แล้วเช็คว่า user คนนั้นมี role ที่สาขานี้ถูกต้องไหม
   (`MemberPackageService.assertManagerApprover`) แต่ไม่ได้ตรวจว่า "ผู้จัดการคนนั้นยืนยันตัวตนจริงตอนนี้"
   ด้วย PIN เหมือนที่ docs/PLAN.md T5.6 ระบุไว้สำหรับการยกเลิกบิล ("ต้องมี PIN ผู้จัดการ") เพราะ (ก) T5.2 นี้
   เป็นจุดแรกในระบบที่ต้องมี manager-approval-gate เลย ยังไม่มี pattern ที่ใช้ซ้ำได้จาก Task ก่อนหน้า (ข)
   การออกแบบกลไก "ยืนยัน PIN แบบ one-off ไม่ login เต็มรูป" เป็นงานคนละก้อนที่ T5.6 เป็นเจ้าของโดยตรงตาม
   docs/PLAN.md ควรออกแบบครั้งเดียวให้ใช้ร่วมกันได้ (ยกเลิกบิล + คอร์สหมดอายุ + แช่แข็ง + ปิดหมดอายุ) ไม่ใช่
   ต่างคนต่างทำ — **ข้อควรระวังสำหรับ Task ในอนาคต (สำคัญ)**: T5.6 ต้องออกแบบกลไกยืนยัน PIN ผู้จัดการแบบ
   ใช้ซ้ำได้ (เช่น endpoint กลาง `/auth/verify-manager-pin` คืน short-lived approval token) แล้วย้อนกลับมา
   เสริม T5.2's `approvedByUserId` ให้ต้องแนบ token นี้ด้วย ไม่ใช่รับ userId เปล่า ๆ เหมือนตอนนี้ — ช่องโหว่
   ปัจจุบันคือใครก็ได้ที่มีสิทธิ์ `package:manage` (รวมแคชเชียร์) สามารถ "อ้าง" ว่าผู้จัดการอนุมัติได้โดยรู้
   แค่ userId ของผู้จัดการ (ไม่ใช่ความลับ) โดยไม่ต้องมีผู้จัดการอยู่จริงตรงนั้น — ยอมรับความเสี่ยงนี้ชั่วคราว
   เพราะเป็น Task คั่นกลาง ไม่ใช่ทางออกสุดท้าย ต้องปิดช่องโหว่นี้ก่อนขึ้น production จริง
5. **UI (`member-package-section.tsx`) ครอบเฉพาะ ซื้อ/ตัดใช้/คืนยอดล่าสุด/โอน — ไม่มี UI สำหรับแช่แข็งและ
   ปิดหมดอายุ (manual EXPIRE)** — เพราะทั้งสองต้องมี `approvedByUserId` ที่เป็นผู้จัดการจริง แต่หน้าเว็บยัง
   ไม่มีกลไกเลือก/ยืนยันตัวตนผู้จัดการ (ดูข้อ 4) การใส่ dropdown เลือก "ผู้จัดการที่จะอนุมัติ" แบบไม่มีการ
   ยืนยันตัวตนจริงจะยิ่งเปิดช่องโหว่ข้อ 4 ให้เห็นชัดในหน้าเว็บโดยตรง จึงเลือกเปิดให้ใช้ผ่าน API เท่านั้นไปก่อน
   (เหมือนที่ ADR-024 เคยทำกับ "ยังไม่มี UI ผูกสมาชิกให้นัด walk-in") — "คืนยอด" ในหน้าเว็บนี้ทำแบบง่าย
   ("คืนยอดล่าสุด" — คืนแถว USE ล่าสุดของใบนั้นเสมอ) ไม่ใช่เลือกแถวเจาะจงจากประวัติทั้งหมด เพราะ use case จริง
   ของหน้านี้คือ "เพิ่งตัดไปแล้วเปลี่ยนใจ/ยกเลิกบิลทันที" ซึ่งเกือบทั้งหมดคือแถวล่าสุดอยู่แล้ว — endpoint เอง
   (`POST .../refund`) ยังรองรับเลือก `ledgerEntryId` เจาะจงได้เต็มรูปสำหรับ T5.6 (บิล) ที่จะเรียกใช้จริง

เหตุผล: ทุกข้อคือการจำกัดขอบเขตให้อยู่ใน "ledger ที่ถูกต้อง" (สิ่งที่ T5.2 ต้องรับผิดชอบจริง) โดยไม่ลาม
ไปทำงานที่ Task อื่นเป็นเจ้าของอยู่แล้ว (PIN-approval gate เป็นของ T5.6, auto-expire cron เป็นของ T7.1)
แต่ยังคงความถูกต้องทางบัญชี (ยอดคงเหลืออ่านจากผลรวมเสมอ, row lock กันแข่งกันตัดยอด, snapshot ราคา ณ
เวลาซื้อ) ตามที่ CLAUDE.md ข้อ 7 บังคับไว้อย่างเคร่งครัด

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) สร้างกลไก PIN-approval แบบเต็มรูปตอนนี้เลย — ปฏิเสธ
เพราะเป็นขอบเขตของ T5.6 โดยตรง ทำตอนนี้เสี่ยงออกแบบไม่ตรงกับที่ T5.6 ต้องการจริง (2) auto-expire ผ่าน cron
ตอนนี้ — ปฏิเสธเพราะขัดกับ docs/DOMAIN.md ข้อ 5 ที่บอกว่าใช้ได้แม้หมดอายุ (แค่ต้องอนุมัติ) และ T7.1 (cron job
infrastructure) ยังไม่ได้ทำ (3) freeze cap แบบ calendar-year รวมทุกคอร์สของสมาชิกคนเดียวกัน — ปฏิเสธเพราะ
DOMAIN.md ไม่ได้ระบุว่าเป็น "ต่อสมาชิก" หรือ "ต่อคอร์ส" ชัดเจน เลือกตีความแบบระวังที่สุด (ต่อคอร์ส 1 ใบ) ซึ่ง
เข้มงวดกว่า ปลอดภัยกว่าถ้าตีความผิด — **ข้อควรระวังสำหรับ Task ในอนาคต (สำคัญที่สุด)**: ก่อนขึ้น production
ต้องปิดช่องโหว่ข้อ 4 (approvedByUserId ไม่มีการยืนยันตัวตนจริง) เป็นอันดับแรกเมื่อทำ T5.6 — ห้ามปล่อยผ่านไป
โดยไม่แก้

---

## ADR-027: packages/core/promotion (T5.3) — ไม่มีฟิลด์ stackable เลยตามที่ DOMAIN.md สั่งตรง ๆ, เลือกโปรฯ เดียวที่ลดมากสุดเทียบ priority ตอนเสมอ, ตัดคอร์สใช้โปรฯ ไม่ได้บังคับที่ระดับรายการ, tier/เดือนเกิดรับเป็น input เปล่า ๆ (ยังไม่มีคอลัมน์จริงใน Member)

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.3 (Task ที่สามของ M5 — money-critical ★, pure function เท่านั้น)

บริบท: docs/PLAN.md อธิบาย T5.3 ว่าต้องมีฟิลด์ `stackable` + `priority` และ "unit test ≥ 20 เคสรวมโปรฯ
ซ้อนกัน 3 ตัว" แต่ docs/DOMAIN.md ข้อ 15 ตอบคำถามเรื่องนี้ไว้ชัดเจนกว่าและใหม่กว่าตรง ๆ ว่า "ซ้อนไม่ได้เลย
ใช้ได้โปรฯ เดียวต่อบิล" พร้อมระบุผลต่อ T5.3 ไว้ในเอกสารเองว่า "ปิดการใช้ stackable=true ทั้งระบบ (หรือไม่ต้อง
มีฟิลด์นี้เลย) เก็บแค่ priority" — ถือว่าเป็นคำถามที่ตอบไว้แล้วอย่างชัดเจนใน DOMAIN.md ไม่ใช่คำถามใหม่ที่ต้อง
หยุดถามซ้ำ จึงตีความ "เคสรวมโปรฯ ซ้อนกัน 3 ตัว" ในเกณฑ์ผ่านของ PLAN.md ว่าหมายถึง "เทสสถานการณ์ที่มี 3 โปรฯ
เข้าเงื่อนไขพร้อมกัน แล้วต้องเลือกได้ถูกต้องแค่ 1 ตัว" ไม่ใช่ "รวมส่วนลดจาก 3 โปรฯ เข้าด้วยกัน" (ซึ่งขัดกับ
DOMAIN.md ตรง ๆ)

ตัดสินใจ:
1. **ไม่มีฟิลด์ `stackable` ใน `PromotionRule` เลย** ตามที่ DOMAIN.md เสนอทางเลือกไว้เองว่า "ไม่ต้องมีฟิลด์
   นี้เลย" — เก็บแค่ `priority` (ใช้เทียบตอนส่วนลดเท่ากันเป๊ะเท่านั้น ไม่ใช่ลำดับการซ้อนเพราะไม่มีการซ้อน)
2. **เลือกโปรฯ ที่ให้ `discountSatang` มากที่สุดเสมอ (ตรงตัวตาม DOMAIN.md ข้อ 15: "เลือกโปรที่ลดมากที่สุด")**
   — `BONUS_MINUTES` มี `discountSatang = 0` เสมอ (ไม่ใช่ส่วนลดเป็นเงิน) จึงมักแพ้โปรฯ อื่นที่ลดเป็นเงินถ้ามี
   ตัวเลือก เว้นแต่เป็นโปรฯ เดียวที่ใช้ได้จริง — ยอมรับผลลัพธ์นี้เพราะ DOMAIN.md ไม่ได้ให้วิธีเทียบ "นาที" กับ
   "เงิน" ในหน่วยเดียวกัน การเทียบด้วยเงินเป็นแกนหลักตรงกับคำที่ DOMAIN.md ใช้ตรง ๆ ที่สุด
3. **"ห้ามใช้โปรฯ กับรายการที่ตัดคอร์ส" บังคับที่ระดับรายการในตะกร้า (`CartLine.paymentMethod !== "PACKAGE"`)
   ไม่ใช่ทั้งบิล** — ถ้าบิลผสมรายการเงินสด+ตัดคอร์สในบิลเดียว โปรฯ ยังลดส่วนเงินสดได้ปกติ แค่ไม่แตะรายการที่
   ตัดคอร์สเลย ตรงกับความหมายตามตัวอักษรของกติกาที่สุด ("ห้ามใช้กับรายการที่ตัดคอร์ส" ไม่ใช่ "ห้ามใช้ถ้าบิลมี
   รายการตัดคอร์สอยู่เลย") — `minSpendSatang` ยังคงนับยอดรวมทั้งบิล (รวมรายการตัดคอร์สด้วย) เพราะ "ยอดขั้นต่ำ"
   ตามความหมายทั่วไปคือยอดบิลรวม ไม่ใช่ยอดที่ลดได้เท่านั้น — เป็นการตีความรายละเอียดย่อยของกติกาที่ DOMAIN.md
   ตอบหลักการไว้แล้ว (ไม่ใช่คำถามนโยบายใหม่) จึงตัดสินใจเองแล้วบันทึกไว้ที่นี่แทนการหยุดถาม
4. **เงื่อนไข tier/เดือนเกิด รับเป็นพารามิเตอร์ธรรมดา (`memberTier: string | null`, `memberBirthMonth: number
   | null`) ไม่อ้างอิงจาก Member schema จริง** — เพราะ `Member` model (T3.1) ยังไม่มีคอลัมน์ `tier`/`birthDate`
   เลยตอนนี้ engine เป็น pure function ไม่ผูกกับ Prisma อยู่แล้ว จึงไม่ใช่ปัญหาของ Task นี้ (ผู้เรียกส่งข้อมูล
   อะไรมาก็ประเมินตามนั้น) — **ข้อควรระวังสำหรับ Task ในอนาคต**: T5.4 (CRUD โปรโมชั่น + หน้าทดลองคำนวณ) หรือ
   T5.6 (บิล ที่จะเรียก engine นี้จริง) ต้องเพิ่มคอลัมน์ `tier`/`birthDate` ใน `Member` schema ก่อนถึงจะประกอบ
   input ตรงนี้ได้ครบ ไม่งั้นเงื่อนไข 2 ข้อนี้ใช้งานจริงไม่ได้ (evaluate ได้แต่ input จะเป็น null เสมอ)
5. **`dayOfWeek`/`minuteOfDay`/`currentMonth` รับเป็น parameter ที่แปลงมาแล้ว ไม่ derive จาก `Date` เองในนี้
   เลย** — สอดคล้องกับ T4.1 (`findAvailableSlots`) ที่ไม่รับ `now: Date` แล้วเรียก `.getDay()`/`.getHours()`
   ตรง ๆ เพราะ `Date` methods อย่าง `getDay()`/`getHours()` คืนค่าตาม timezone ของเครื่องที่รันโค้ด ไม่ใช่เวลา
   ไทยเสมอ (server อาจรันที่ timezone อื่น) — ผู้เรียก (apps/api) ต้องแปลงเป็นเวลาไทยก่อนส่งเข้ามาเสมอ ตรงกับ
   ที่ `apps/api/src/modules/booking/bangkok-date.ts` (T4.1/T4.4/T4.6) ทำไว้แล้วสำหรับ availability engine

เหตุผล: ทุกข้อคือการตีความรายละเอียดที่ DOMAIN.md ตอบหลักการไว้ชัดแล้วให้เป็นรูปธรรมในโค้ด (ไม่ใช่การเดา
นโยบายใหม่ที่ไม่มีคำตอบอยู่) และรักษาความเป็น pure function ตาม CLAUDE.md ข้อ 1 อย่างเคร่งครัด (ไม่มี
Date.now()/import Prisma ใด ๆ ในนี้เลย)

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) ทำตาม PLAN.md ตัวอักษรเป๊ะแล้วใส่ `stackable` field
ไว้เผื่ออนาคต — ปฏิเสธเพราะ DOMAIN.md สั่งปิดฟีเจอร์นี้ไว้ตรง ๆ อยู่แล้ว ใส่ไว้เฉย ๆ โดยไม่ใช้งานจะสร้างความ
สับสนว่า "ตั้ง true ได้ไหม" (2) ห้ามใช้โปรฯ ทั้งบิลถ้ามีรายการตัดคอร์สแม้แต่รายการเดียว — ปฏิเสธเพราะเข้มงวด
เกินกว่าที่ข้อความกติการะบุ ("ห้ามใช้กับรายการนั้น" ไม่ใช่ "ห้ามใช้กับบิลที่มีรายการนั้น") (3) เทียบ BONUS_MINUTES
กับโปรฯ เงินด้วยอัตราแปลงนาที→บาทสมมติ — ปฏิเสธเพราะ DOMAIN.md ไม่ได้ให้อัตราแปลงมา เป็นการเดาตัวเลขที่ไม่มี
ที่มา — **ข้อควรระวังสำหรับ Task ในอนาคต**: T5.4 ต้องเพิ่ม `Member.tier`/`Member.birthDate` ก่อนเงื่อนไข
tier/เดือนเกิดจะใช้งานได้จริง และ T5.6 (บิล) คือจุดที่ประกอบ `CartLine[]` จริงจาก `ServiceJob`/สินค้าในบิล
แล้วเรียก `evaluatePromotions` — ต้องแม็ป `paymentMethod` ของแต่ละบรรทัดให้ตรงกับแหล่งชำระจริงตาม
docs/DOMAIN.md ข้อ 10 เสมอ ไม่งั้นกติกา "ห้ามใช้โปรฯ กับรายการที่ตัดคอร์ส" จะรั่ว

---

## ADR-028: CRUD โปรโมชั่น + คูปอง + หน้าทดลองคำนวณ (T5.4) — ไม่มีเงื่อนไข branchIds เพราะผูกสาขาเดียวอยู่แล้ว, คูปองคือ "ตัวกระตุ้น" ไม่ใช่ตาราง junction, แก้ไขโปรฯ ทีหลังถูกจำกัดฟิลด์เหมือน Package, ยังไม่มี Member.tier/birthDate จริง

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.4 (Task ที่สี่ของ M5)

บริบท: T5.4 คือ catalog ของโปรโมชั่น + คูปอง + หน้าทดลองคำนวณที่เรียก `evaluatePromotions` (T5.3) จริง
ต้องตัดสินใจว่าคูปองสัมพันธ์กับโปรโมชั่นอย่างไร และฟิลด์ไหนแก้ไขได้หลังสร้างแล้ว

ตัดสินใจ:
1. **`Promotion` ไม่มีฟิลด์ `branchIds` แม้ engine (T5.3, packages/core/promotion) จะรองรับเงื่อนไขนี้ก็ตาม**
   — เพราะ `Promotion` model ผูกกับ `branchId` เดียวอยู่แล้วโดยตัวมันเอง (เหมือน `Package` ใน T5.1) เงื่อนไข
   `branchIds` ของ engine มีไว้รองรับกรณีในอนาคตที่โปรฯ ระดับ HQ ใช้ข้ามหลายสาขาได้ ซึ่ง schema ปัจจุบันยังไม่
   รองรับแนวคิด "โปรฯ กลาง" แบบนั้น — ถ้าจะทำในอนาคตต้องออกแบบ schema ใหม่ ไม่ใช่แค่เติมฟิลด์นี้เข้ามา
2. **คูปองคือ "ตัวกระตุ้นให้โปรฯ ใช้ได้" ไม่ใช่แค่ป้ายกำกับ** — โปรฯ ที่ไม่มีคูปองผูกเลย = อัตโนมัติ (ประเมิน
   เสมอถ้าเข้าเงื่อนไข) โปรฯ ที่มีคูปองผูกอย่างน้อย 1 ใบ = ต้องกรอกรหัสคูปองที่ตรงและยังใช้ได้เท่านั้นถึงจะถูก
   พิจารณา (ดู `PromotionCalculatorController.calculate` — คัดกรองก่อนส่งเข้า `evaluatePromotions`) เลือก
   แบบนี้แทนการเพิ่มฟิลด์ `requiresCoupon: boolean` แยกต่างหาก เพราะการมี/ไม่มีคูปองผูกอยู่แล้วบอกความหมาย
   นี้ได้ตรงตัวโดยไม่ต้องเพิ่ม state ซ้ำซ้อนที่อาจไม่ตรงกัน (เช่น `requiresCoupon=true` แต่ไม่มีคูปองผูกเลย)
3. **แก้ไขโปรโมชั่นทีหลังได้แค่ `name`/`priority`/`quotaTotal`/`isActive`/เงื่อนไข — ห้ามแก้ `type` หรือฟิลด์
   ส่วนลด/ของแถมเฉพาะประเภทหลังสร้างแล้ว** — หลักการเดียวกับ `Package` (ADR-025): แก้ความหมายพื้นฐานของ
   สิ่งที่อาจถูกใช้ไปแล้วในบิลเก่าไม่ได้ (แม้ตอนนี้ยังไม่มี billing/T5.6 ที่อ้างอิงโปรฯ จริง ก็ตั้งกฎไว้ล่วง
   หน้าให้สอดคล้องกันทั้งระบบ) — **แต่ UI ฟอร์มแก้ไข (`PromotionEditForm`) แคบกว่า schema ที่อนุญาตจริง**:
   schema (`updatePromotionSchema`) ยอมให้แก้เงื่อนไข (conditions) ได้ด้วย แต่ฟอร์มเว็บไม่เปิดให้แก้เงื่อนไข
   เลย (ต้องลบแล้วสร้างใหม่ถ้าจะเปลี่ยนเงื่อนไข) — ตัดสินใจจำกัดขอบเขต UI ให้เล็กลงกว่า API เพื่อไม่ให้ฟอร์ม
   ใหญ่เกินไป ไม่ใช่ข้อจำกัดทางธุรกิจ (คนละเรื่องกับข้อ 3 ที่เป็นกฎถาวรทาง data integrity)
4. **หน้าทดลองคำนวณรับข้อมูลสมาชิก (tier/ครั้งแรก/เดือนเกิด) เป็น input ที่พนักงานกรอกเองเสมอ ไม่ผูกกับ
   สมาชิกจริงในระบบเลย** — เพราะ (ก) `Member` schema ยังไม่มีคอลัมน์ `tier`/`birthDate` จริง (ดู ADR-027) (ข)
   ระบบยังไม่มีประวัติบิล (T5.6 ยังไม่ทำ) จึงหา "ลูกค้าใหม่ครั้งแรกจริงไหม" จากข้อมูลจริงไม่ได้ — ตรงกับ
   ความหมายของคำว่า "จำลอง" ("ใส่ตะกร้าจำลอง") ตามที่ docs/PLAN.md ใช้เองตรง ๆ ไม่ใช่การลดทอนฟีเจอร์
5. **โควตา (`quotaUsed`) เป็นแค่ตัวเลขสะสมธรรมดา ไม่ใช่ ledger append-only แบบ `MemberPackage` (T5.2)** —
   เพราะ CLAUDE.md ข้อ 7 พูดถึง "ยอดคงเหลือของคอร์ส" (เงิน/สิทธิ์ของลูกค้าเฉพาะราย) ตรง ๆ ไม่ใช่ตัวนับการใช้
   งานทั่วไปแบบนี้ — T5.4 ไม่มี logic การเพิ่ม `quotaUsed` เลยด้วยซ้ำ (แค่ field เปล่าไว้ให้ T5.6 เพิ่มตอนบิล
   จริงเรียกใช้โปรฯ) ไม่ใช่ scope ของ Task นี้

เหตุผล: ทุกข้อคือการรักษาขอบเขต "catalog + หน้าจำลอง" ให้ตรงกับที่ docs/PLAN.md ระบุ ไม่ลามไปทำ logic การ
ใช้จริง (redemption, ledger, การผูกกับบิล) ที่เป็นของ T5.6 โดยตรง เช่นเดียวกับที่ ADR-025 (T5.1) แยกขอบเขต
ระหว่าง catalog กับ ledger ของคอร์สไว้แล้ว

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) เพิ่มฟิลด์ `requiresCoupon` แยกจากการมีคูปองผูกจริง
— ปฏิเสธตามเหตุผลข้อ 2 (2) เปิดให้แก้เงื่อนไขได้เต็มรูปในฟอร์มเว็บตั้งแต่ตอนนี้ — เก็บไว้เป็นงานต่อยอดในอนาคต
ถ้าพนักงานร้องขอจริง ไม่ใช่ปฏิเสธถาวร (3) ผูกข้อมูลสมาชิกในหน้าคำนวณเข้ากับสมาชิกจริงในระบบ — ปฏิเสธเพราะ
ข้อมูลที่จำเป็น (tier/birthDate/ประวัติบิล) ยังไม่มีอยู่จริง จะทำให้ต้องเดา/mock ข้อมูลอยู่ดี — **ข้อควรระวัง
สำหรับ Task ในอนาคต**: T5.6 (บิล) คือจุดที่ต้อง (ก) เพิ่ม logic `quotaUsed += 1` แบบ race-safe เมื่อโปรฯ ถูก
ใช้จริง (น่าจะใช้ row lock แบบเดียวกับ `MemberPackageService.lock` ใน ADR-026) (ข) เพิ่ม `Coupon.redeemedCount
+= 1` แบบเดียวกัน (ค) ตัดสินใจว่า "ลูกค้าใหม่ครั้งแรก" หาอัตโนมัติจากประวัติบิลจริงได้หรือยังต้องให้พนักงาน
เลือกเอง (ง) ถ้า T6.x หรือ T5.x ในอนาคตเพิ่ม `Member.tier`/`birthDate` จริง ต้องกลับมาผูกหน้าคำนวณนี้กับ
สมาชิกจริงแทน manual input ปัจจุบัน

---

## ADR-029: ใบงาน ServiceJob (T5.5) — ผูกกับ state machine ของ AppointmentItem แทนสร้าง endpoint แยก, แหล่งชำระตัดสินใจตอนจบงาน, snapshot ค่ามือแค่เรตเดียวที่ตรงกับระดับพนักงาน ณ ตอนนั้น, ปิดงานแบบ updateMany กันพังกับข้อมูลเก่าที่ไม่มีใบงาน

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.5 (Task ที่ห้าของ M5 — money-critical ★)

บริบท: T5.5 ต้องมี "เริ่มงาน/จบงาน" ซึ่งซ้อนกับ state machine ของ `AppointmentItem` ที่มีอยู่แล้ว
(BOOKED→...→IN_SERVICE→COMPLETED จาก T4.3) และต้อง snapshot ราคา/ค่ามือ ณ เวลานั้นไม่ให้กระทบจากการแก้ไข
`ServiceVariant` ทีหลัง — ก่อนเขียนโค้ดได้หยุดถามผู้ใช้ 2 คำถามสถาปัตยกรรมหลัก (ดู AskUserQuestion ใน
เซสชันนี้) เพราะกระทบทั้งการออกแบบ T5.5 เองและ T5.6 (บิล) ที่จะตามมา ผู้ใช้ตอบว่า: (1) ผูก ServiceJob เข้า
กับ `AppointmentItem` status transition โดยตรง ไม่แยก endpoint /start /complete ต่างหาก (2) แหล่งชำระ
ตัดสินใจตอนจบงาน (ส่งมาพร้อม body ตอน PATCH .../status เป็น COMPLETED) ไม่ใช่ตอนเริ่มงาน

ตัดสินใจเพิ่มเติมที่ไม่ได้ถาม (สมเหตุสมผล แก้ทีหลังง่าย ไม่ผูกมัดโครงสร้างข้อมูล):
1. **`commissionSatang` snapshot แค่เรตเดียวที่ตรงกับ `staff.level` ณ เวลาเริ่มงาน ไม่ใช่ทั้ง 3 เรต
   (Junior/Senior/Master) ของ `ServiceVariant`** — เพราะ ณ เวลาเริ่มงาน "ใครทำ" และ "ระดับอะไร" ตัดสินแล้ว
   แน่นอนแล้ว เก็บทั้ง 3 เรตไปด้วยจะเป็นข้อมูลที่ไม่มีความหมาย (2 เรตที่เหลือไม่มีวันถูกใช้กับ ServiceJob
   ใบนี้เลย) — เก็บ `staffLevelAtJob` แยกไว้ด้วยเพื่อให้ตรวจสอบย้อนหลังได้ว่าตอนนั้นเลือกเรตจากระดับไหน (ถ้า
   พนักงานถูกปรับระดับทีหลัง ใบงานเก่ายังอ้างระดับตอนนั้นถูกต้อง)
2. **`PaymentMethod` ย้ายจาก `promotion.ts` (T5.4, ตอนนั้นชื่อ `LinePaymentMethod`) มาเป็นไฟล์กลาง
   `packages/contracts/src/payment.ts` ใช้ร่วมกันข้ามฟีเจอร์** — เพราะ ServiceJob ก็ต้องใช้ค่าเดียวกันเป๊ะ
   (เงินสด/คอร์ส/วอยเชอร์/อภินันทนาการ ตาม docs/DOMAIN.md ข้อ 10) ไม่ใช่แนวคิดเฉพาะของตะกร้าจำลองโปรโมชั่น
   อีกต่อไป — คง export ชื่อเดิม (`LinePaymentMethod`/`LINE_PAYMENT_METHODS`) ไว้เป็น alias ใน promotion.ts
   ด้วยเพื่อไม่ต้องแก้โค้ด T5.4 ที่ทดสอบผ่านแล้ว (`api-client.ts`, `promotion-calculator-client.tsx`)
3. **ปิดงาน (COMPLETED) ใช้ `serviceJob.updateMany` ไม่ใช่ `update`** — เจอบั๊กจริงตอน live-browser test:
   ข้อมูลสาธิต/นัดเก่าที่เคยถูกตั้งเป็น IN_SERVICE ไว้ก่อนมี T5.5 (ไม่ผ่าน endpoint เริ่มงานที่สร้าง
   ServiceJob) ทำให้ตอนปิดงานหา ServiceJob ไม่เจอ `update` (ที่ throw P2025 ถ้าไม่เจอแถว) ทำให้ทั้ง
   transaction ล้มด้วย 500 — เปลี่ยนเป็น `updateMany` (ไม่ throw ถ้า 0 แถว) ปิดสถานะนัดได้ปกติแม้ไม่มีใบงาน
   ให้บันทึกก็ตาม เพิ่ม regression test ครอบเคสนี้ไว้แล้ว (ดู service-job.e2e-spec.ts)
4. **`updateAppointmentItemStatusSchema` (T4.3, packages/contracts/src/booking.ts) เพิ่ม `.refine()` บังคับ
   `paymentMethod` เมื่อ `status === "COMPLETED"` เท่านั้น** — ทำที่ชั้น Zod กลาง (ไม่ใช่แค่เช็คในคอนโทรลเลอร์)
   เพื่อให้ error message เป็นมาตรฐานเดียวกับ validation อื่นทั้งระบบ (400 พร้อม field-level error) และฝั่งเว็บ
   ใช้ schema เดียวกันตรวจได้ในอนาคตถ้าต้องการ (ยังไม่ได้ทำฝั่งเว็บตอนนี้ เพราะ UI ใช้ dropdown บังคับเลือก
   ค่าอยู่แล้วโดยธรรมชาติ ไม่มีทางส่ง request ที่ไม่มี paymentMethod ได้จาก UI ปกติ)
5. **UI (Lane Board detail sheet) ต้องเลือกแหล่งชำระก่อนกด "ยืนยันจบงาน" เสมอ — ปุ่ม "เสร็จแล้ว" คลิกแรกแค่
   เปิด dropdown เลือกแหล่งชำระ ไม่ยิง request ทันที** — ต่างจากการเปลี่ยนสถานะอื่นทั้งหมดที่คลิกเดียวจบ เป็น
   ข้อยกเว้นเดียวในระบบเพราะ COMPLETED เป็นจุดเดียวที่ต้องกรอกข้อมูลเพิ่มก่อนยืนยันได้จริง

เหตุผล: การผูกกับ state machine ที่มีอยู่แล้ว (แทนสร้างระบบคู่ขนาน) ทำให้ Lane Board (T4.5) ที่มีอยู่แล้วใช้
งานได้ทันทีโดยไม่ต้องแก้ UI ใหม่ทั้งหมด มีแค่จุดเดียวที่ต้องเพิ่ม (ตัวเลือกแหล่งชำระตอนกด COMPLETED) ตรงกับ
หลักการไม่สร้างของซ้ำซ้อนโดยไม่จำเป็น — การ snapshot แบบเรตเดียวรักษาหลักการเดียวกับ ADR-025/ADR-026/ADR-028
คือ "เก็บเฉพาะข้อมูลที่มีความหมายจริง ณ เวลานั้น ไม่เก็บทุกอย่างเผื่อไว้"

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) สร้าง POST /start /complete endpoint แยกต่างหาก —
ปฏิเสธตามคำตอบผู้ใช้ข้อ 1 (2) เก็บ commissionSatang ทั้ง 3 เรตไว้ในใบงานเผื่ออนาคตพนักงานเปลี่ยนระดับแล้ว
อยากคำนวณใหม่ย้อนหลัง — ปฏิเสธเพราะขัดกับเกณฑ์ผ่านตรง ๆ ("ใบงานเก่าต้องไม่เปลี่ยนแม้แต่บาทเดียว") การคำนวณ
ย้อนหลังใหม่คือสิ่งที่ต้องห้ามอยู่แล้ว (3) ตัดสินใจแหล่งชำระตอนเริ่มงาน — ปฏิเสธตามคำตอบผู้ใช้ข้อ 2 — **ข้อ
ควรระวังสำหรับ Task ในอนาคต**: T5.6 (บิล) คือจุดที่จะรวมหลาย ServiceJob เข้าบิลเดียว จ่ายได้หลายช่องทางต่อบิล
(ตาม docs/PLAN.md) — ต้องตัดสินใจว่า `ServiceJob.paymentMethod` ที่ตั้งไว้ตอนจบงานเป็นค่าเริ่มต้นที่บิลแก้ไข
ทีหลังได้ หรือเป็นค่าตายตัวที่บิลต้องเคารพเป๊ะ ๆ ไม่ตรงกับ workflow จริงตอนนั้นค่อยออกแบบเพิ่ม — คิดไว้ล่วง
หน้าตั้งแต่ตอนนี้แต่ไม่ใช่การตัดสินใจของ T5.5

---

## ADR-030: บิล (T5.6) — PIN ผู้จัดการเป็น endpoint กลางคืน approval token อายุสั้น, สินค้าเป็นรายการอิสระไม่ผูกคลัง, ยกเลิกบิลทำ ServiceJob เป็นโมฆะแทนลบ, บังคับยอดชำระตรงเป๊ะ, engine โปรโมชั่นใช้ร่วมกับหน้าทดลองคำนวณ

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.6 (Task ที่หกของ M5 — money-critical ★, เกณฑ์ผ่านคือการยกเลิกบิลต้องคืนครั้ง+คืน
โควตาโปรฯ+กลับค่ามือครบทุกรายการ)

บริบท: T5.6 คือจุดที่ ADR-026 (T5.2) ทิ้งไว้ว่าต้องแก้ก่อนขึ้น production — ตอนนั้น `approvedByUserId`
รับเป็น string เปล่าจาก client โดยไม่ยืนยันตัวตนจริง เพราะยังไม่มีกลไก PIN gate ในเว็บ นอกจากนี้ PLAN.md
ระบุ T5.6 ต้อง "รวมใบงาน + สินค้า" ทั้งที่ระบบยังไม่มี Product/Inventory model เลย และ "ยกเลิกบิลต้องกลับ
ค่ามือ" ทั้งที่ T6.2 (payroll/commission ledger) ยังไม่ได้สร้าง — ก่อนเขียนโค้ดได้หยุดถามผู้ใช้ 3 คำถาม
สถาปัตยกรรมหลัก (ดู AskUserQuestion ในเซสชันนี้) ผู้ใช้ตอบว่า: (1) endpoint ยืนยัน PIN กลาง (ไม่ใช่เช็ค PIN
แยกทุก endpoint) คืน short-lived approval token ให้แนบไปกับ endpoint ที่ต้องมี PIN ผู้จัดการ (2) รายการ
สินค้าในบิลเป็นรายการอิสระ (ชื่อ+ราคาที่พนักงานกรอกเอง) ไม่ผูกกับ catalog/คลังใด ๆ (3) ยกเลิกบิลที่ตัด
ค่ามือไปแล้ว (ยังไม่มี T6.2) ให้ทำ ServiceJob เป็นโมฆะ (`voidedAt`) แทน — T6.2 ในอนาคตต้องกรอง
`voidedAt IS NULL` เอง

ตัดสินใจตามคำตอบผู้ใช้ (ขยายรายละเอียดตอนเขียนโค้ดจริง):
1. **`AuthService.verifyManagerPin(branchId, userId, pin)`** — ตรวจว่า `userId` มี role `owner`/`manager`
   ที่สาขานั้นจริง (`APPROVER_ROLE_KEYS`) ใช้ตรรกะ lockout/argon2 เดียวกับ `pinLogin` (แยกออกมาเป็น private
   `verifyPin()` ใช้ร่วมกัน 2 ที่ ไม่ก็อปโค้ด) แล้วเซ็น JWT อายุ 2 นาทีเท่านั้น (`purpose: "manager-approval"`)
   ด้วย secret เดียวกับ access token — คนละ endpoint กับ `pin-login` เพราะไม่ใช่การ login เต็มรูป (ไม่เซ็ต
   cookie ไม่สร้าง session) แค่ "ยืนยันว่ามีผู้จัดการมายืนอนุมัติตรงนี้จริง ณ ขณะนี้"
   `AuthService.verifyManagerApprovalToken(branchId, token)` ฝั่งตรวจสอบคืน userId ของผู้อนุมัติกลับมาเก็บ
   ใน `Bill.cancelledByUserId` — กลไกนี้ตั้งใจให้ endpoint อื่นในอนาคตเรียกใช้ซ้ำได้ (เช่น
   `MemberPackageSection`'s แช่แข็ง/ปิดหมดอายุที่ ADR-026 ทิ้งไว้ว่ายังไม่มี PIN gate) ไม่ใช่แค่ของ
   BillController.cancel เท่านั้น
2. **`checkoutBillSchema.productLines`: `{description, priceSatang, quantity, paymentMethod}` ไม่มี
   `productId`/SKU ใด ๆ** — ตรงกับคำตอบผู้ใช้ข้อ 2 บิลจึงรวม "ใบงาน" (ผูก ServiceJob จริง มี snapshot ราคา/
   ค่ามือจาก T5.5) กับ "สินค้า" (แค่ข้อความ+ราคาที่พนักงานพิมพ์เอง ไม่ตรวจสอบกับ catalog ใด ๆ) ในโครงสร้าง
   บิลเดียวกันได้โดยไม่ต้องรอ inventory model — ถ้า Task ในอนาคตสร้าง `Product` model จริง ต้องมาเพิ่ม
   `productId` ทางเลือกใน schema นี้ (ไม่ใช่แทนที่ `description`/`priceSatang` เพราะร้านอาจยังอยากขาย
   สินค้านอกบัญชีได้อยู่)
3. **ยกเลิกบิล: `ServiceJob.voidedAt = now()` ไม่ลบ ServiceJob ทิ้ง ไม่มีฟิลด์กลับค่ามือเองในตอนนี้** — ตรงกับ
   คำตอบผู้ใช้ข้อ 3 เพราะ T6.2 (คำนวณค่ามือจาก ServiceJob) ยังไม่มีอยู่จริง จึงยังไม่มี "ค่ามือที่จ่ายไปแล้ว"
   ให้กลับจริง ๆ — การเก็บ `voidedAt` ไว้เฉย ๆ (ไม่ลบแถว) รักษาประวัติเต็มไว้ให้ตรวจสอบย้อนหลังได้เสมอ (ตรง
   กับหลักการ append-only/ไม่ทำลายข้อมูลเดิมที่ใช้ทั้งระบบ) **ข้อควรระวังสำหรับ T6.2**: query คำนวณค่ามือ
   ทุกจุดต้องกรอง `voidedAt IS NULL` เอง ไม่มีกลไกกลางบังคับให้อัตโนมัติ (ต่างจาก branch scope ที่มี
   Prisma extension บังคับ) เพราะ "ค่ามือ" ไม่ใช่แนวคิดข้าม-โมเดลแบบ branchId
4. **`checkoutBillSchema` ไม่รับ `promotionId`/`discountSatang` จาก client เลย — server เรียก
   `evaluatePromotions` (T5.3) เองเสมอโดยใช้ cart ที่ประกอบจาก serviceJobLines/productLines จริง** — ห้าม
   trust ตัวเลขเงินจาก client ตาม CLAUDE.md เป็นกฎเดียวกับที่หน้าทดลองคำนวณ (T5.4) ใช้อยู่แล้ว แค่ตอนนี้เป็น
   บิลจริงที่บันทึกผลลัพธ์ลง DB ไม่ใช่แค่แสดงผล — สกัด `toPromotionRule()`/`resolveUsablePromotions()` ออก
   จาก `promotion-calculator.controller.ts` เดิมมาไว้ที่ `promotion-rules.ts` กลาง ให้ทั้งหน้าทดลองคำนวณและ
   บิลจริงเรียก engine เดียวกันเป๊ะ ป้องกัน logic ระหว่างสองที่ค่อย ๆ เพี้ยนออกจากกันเมื่อมีคนแก้จุดเดียว
5. **`payments[].amountSatang` รวมกันต้อง "เท่ากับเป๊ะ" `totalSatang` (ไม่ใช่ `>=`)** — เงินทอนคำนวณแยกจาก
   `tenderedSatang` ของช่องทาง CASH เท่านั้น (ส่วนต่างจาก `amountSatang` ของบรรทัดนั้น) ไม่เกี่ยวกับยอดรวม
   ทั้งบิล — ป้องกันเคสพนักงานกรอกช่องทางชำระผิดจนยอดบิลเพี้ยนโดยไม่รู้ตัว (ระบบไม่เดา/ปัดเศษให้เอง)
6. **หน้าเว็บแคชเชียร์ (`/billing`) แบ่งขั้นตอนเป็น "คำนวณยอด/ส่วนลด" (เรียก
   `promotionCalculatorApi.calculate` ของ T5.4 ตัวเดียวกันเพื่อพรีวิว) ก่อนเปิดให้กรอกช่องทางชำระ แล้วค่อย
   กด "ออกบิล" จริงแยกกัน** — ไม่คำนวณส่วนลดฝั่ง client เองเลย (ข้อ 4) แต่ก็ไม่บังคับให้พนักงานกรอกช่องทาง
   ชำระแบบเดามั่ว ๆ ก่อนรู้ยอดจริง — ปุ่ม "เติมอัตโนมัติ" ช่วยกระจายยอดตามช่องทางชำระของแต่ละรายการในตะกร้า
   แล้วหักส่วนลดออกจากกลุ่มที่ไม่ใช่ PACKAGE กลุ่มแรกที่เจอ (โปรฯ ห้ามแตะ PACKAGE อยู่แล้วตาม `isPromotable`
   ใน packages/core) เป็นแค่ค่าเริ่มต้นที่แก้ได้ ไม่ใช่ตัวบังคับ — ระบบตรวจแค่ว่าผลรวมสุดท้ายตรงยอดสุทธิก่อน
   ส่ง (ข้อ 5 บังคับอยู่แล้วที่ server)
7. **เพิ่ม `GET /branches/:branchId/users` (BranchController) และเพิ่ม `serviceJob.billLine` เข้า include
   ของ `AppointmentItemController.list()`** — ทั้งสองจุดนี้ไม่ได้ถูกถามผู้ใช้ล่วงหน้าเพราะเป็น plumbing
   เชิงกลไกที่จำเป็นต่อ UI ของ T5.6 เอง ไม่ใช่การตัดสินใจเชิงสถาปัตยกรรม: (ก) ต้องมีรายชื่อผู้ใช้ที่มี role
   owner/manager ของสาขาให้เลือกตอนกรอก PIN ยกเลิกบิล กันสิทธิ์ด้วย `staff:view` (แคชเชียร์มีสิทธิ์นี้อยู่
   แล้วตาม `ROLE_PERMISSIONS`) — ยังไม่ใช่ endpoint จัดการผู้ใช้เต็มรูป (ข) ต้องรู้ว่าใบงานไหน "จบงานแล้วแต่
   ยังไม่ออกบิล" (`completedAt` ไม่ null แต่ `billLine` null) ถึงจะกรองรายการ "พร้อมออกบิล" ให้แคชเชียร์เห็น
   ถูกต้อง กันเลือกใบงานที่ออกบิลไปแล้วซ้ำ (ซึ่งจะโดน 409 จาก unique constraint อยู่ดีแต่ UX แย่กว่าถ้าไม่
   กรองไว้ก่อน)

เหตุผล: ทุกข้อรักษาหลักการเดียวกับ ADR ก่อนหน้าในซีรีส์เดียวกัน — ไม่ trust ตัวเลขเงินจาก client (ADR-027,
ADR-028), ไม่ทำลายข้อมูลเดิมทิ้ง เก็บเป็นประวัติ append-only เสมอ (ADR-025, CLAUDE.md ข้อ 7), และไม่สร้าง
กลไกคู่ขนานที่ซ้ำกับของเดิมโดยไม่จำเป็น (ADR-029) — กลไก PIN ผู้จัดการแบบ token กลางเป็นการปิดช่องโหว่ที่
ADR-026 ทิ้งไว้ตรง ๆ ตามที่ตั้งใจไว้ตั้งแต่ตอนนั้น

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) เช็ค PIN แบบ inline ในแต่ละ endpoint ที่ต้องการ —
ปฏิเสธตามคำตอบผู้ใช้ข้อ 1 เพราะจะก็อปโค้ดซ้ำทุกจุดที่ต้องการ manager approval ในอนาคต (2) ผูกรายการสินค้า
กับ catalog ปลอม ๆ ที่สร้างขึ้นเฉพาะกิจ — ปฏิเสธเพราะทำให้ดูเหมือนมี inventory จริงทั้งที่ไม่มี สร้างความ
เข้าใจผิดมากกว่าไม่มีเลย (3) ลบ ServiceJob ทิ้งตอนยกเลิกบิล — ปฏิเสธเพราะขัดกับหลัก append-only ทั้งระบบ
(4) ให้ payments อนุญาตยอดเกิน/ขาดได้บ้างแล้วปัดเศษเอง — ปฏิเสธเพราะเงินต้องแม่นเป๊ะตาม CLAUDE.md ข้อ 2 —
**ข้อควรระวังสำหรับ Task ในอนาคต**: T5.7 (ปิดรอบกะ) ตาม DOMAIN.md ข้อ 16 ผูกการยกเลิกบิลเข้ากับสถานะรอบกะ
("ยกเลิกบิลหลังปิดรอบกะแล้ว ต้องให้ผู้จัดการเปิดรอบกะใหม่ก่อน") — `BillController.cancel()` ที่มีอยู่ตอนนี้
ยังไม่เช็คเงื่อนไขนี้เลยเพราะยังไม่มี Shift model จริง ต้องกลับมาเพิ่ม guard ใน T5.7 เอง ไม่ใช่งานที่ทำไว้
ล่วงหน้าใน T5.6

---

## ADR-031: ปิดรอบกะ (T5.7) — checkout ไม่บังคับต้องมีรอบกะเปิดอยู่, หา "รอบกะของบิล" จากช่วงเวลาแทน foreign key, ยอดระบบคำนวณจาก CASH เท่านั้น, เปิดใหม่ใช้กลไก PIN เดียวกับยกเลิกบิล

วันที่: 2026-08-24
Task ที่เกี่ยวข้อง: T5.7 (Task สุดท้ายของ M5 — เกณฑ์ผ่านคือ "ปิดรอบแล้วแก้บิลต้องได้ 409 พร้อมบอกว่าต้องให้
ผู้จัดการเปิดรอบก่อน")

บริบท: docs/PLAN.md ระบุแค่ "นับเงินในลิ้นชักเทียบยอดระบบ, บันทึกผลต่างพร้อมเหตุผล, ปิดแล้วห้ามแก้บิล
ย้อนหลัง" ไม่ได้พูดถึงการ "ออกบิลใหม่" เลยว่าต้องมีรอบกะเปิดอยู่ก่อนหรือไม่ — ก่อนเขียนโค้ดได้หยุดถามผู้ใช้
1 คำถามสถาปัตยกรรมหลัก (ดู AskUserQuestion ในเซสชันนี้) เพราะกระทบทั้ง workflow ของแคชเชียร์และการออกแบบ
ว่า `Bill` ต้องมี foreign key ไปยังรอบกะหรือไม่ ผู้ใช้ตอบว่า: **ไม่บังคับ** — ออกบิลได้ตลอดไม่ว่ารอบกะจะเปิด
อยู่หรือไม่ สิ่งที่ต้องบล็อกจริงตามเกณฑ์ผ่านคือ "แก้บิลย้อนหลัง" (ยกเลิกบิล) เท่านั้น

ตัดสินใจตามคำตอบผู้ใช้ (ขยายรายละเอียดตอนเขียนโค้ดจริง):
1. **`CashierShift` ไม่มีความสัมพันธ์กับ `Bill` ผ่าน foreign key เลย** — เพราะ checkout ไม่บังคับต้องมีรอบกะ
   เปิดอยู่ (คำตอบผู้ใช้) การผูก `Bill.shiftId` ตรง ๆ จะสร้างปัญหา "บิลที่สร้างตอนไม่มีรอบกะเปิดอยู่" (shiftId
   เป็น null) ซึ่งไม่มีความหมายชัดเจนว่าจะจัดการยังไงตอนคำนวณยอดปิดรอบ — เลือกหา "รอบกะที่ครอบช่วงเวลาที่บิล
   ถูกสร้าง" แทนด้วย query `openedAt <= bill.createdAt AND (closedAt IS NULL OR closedAt >= bill.createdAt)`
   ที่ `BillController.cancel()` เรียกตอนยกเลิกบิลเท่านั้น (ดู bill.controller.ts) ข้อดี: (ก) ไม่ต้องแก้
   schema ของ `Bill` เลย (ข) บิลที่สร้างในช่วง "ไม่มีรอบกะเปิดอยู่" (ช่องว่างระหว่างรอบ) จะไม่ถูกรอบกะไหน
   ครอบเลย — ยกเลิกได้ตลอดไม่ต้องเปิดรอบกะใด ๆ ก่อน (ไม่มีอะไรให้ "เปิดใหม่" เพราะไม่มีรอบกะเป็นเจ้าของบิลนั้น
   จริง ๆ) ตรงกับความหมายของ "ปิดรอบแล้วห้ามแก้บิลย้อนหลัง" ที่พูดถึงบิลที่ *อยู่ในรอบกะที่ปิดไปแล้ว* เท่านั้น
   ไม่ใช่บิลทุกใบในระบบ
2. **ยอดระบบ (`systemCashSatang`) นับเฉพาะ `BillPayment.method = CASH` ของบิลที่ยังไม่ถูกยกเลิก** — "นับเงินใน
   ลิ้นชัก" หมายถึงเงินสดจริงที่จับต้องได้เท่านั้น วอยเชอร์/อภินันทนาการ/ตัดคอร์สไม่ใช่เงินในลิ้นชัก — คำนวณ
   ฝั่ง server เสมอตอนปิดรอบ (`BillPayment.aggregate`) ไม่รับตัวเลขนี้จาก client เด็ดขาด (ตาม CLAUDE.md)
   เก็บเป็นค่าคงที่ (snapshot) ในแถว ไม่คำนวณสดใหม่ทุกครั้งที่อ่าน — กันเลขขยับถ้ามีคนยกเลิกบิลเก่าทีหลัง
3. **`varianceReason` บังคับเฉพาะตอนยอดไม่ตรง เช็คที่ controller ไม่ใช่ zod schema** — เพราะต้องรู้
   `systemCashSatang` ที่คำนวณสดก่อนถึงจะรู้ว่าต่างจาก `countedCashSatang` ที่ client ส่งมาหรือไม่ (zod schema
   ตรวจแค่รูปร่าง input ไม่มีสิทธิ์เข้าถึงข้อมูลจาก DB) — คืน 422 พร้อมบอกทั้งสองยอดในข้อความ ให้พนักงานเห็น
   ส่วนต่างได้ทันทีโดยไม่ต้องเดา
4. **"เปิดรอบกะใหม่" หลังปิดแล้วใช้กลไก approval-token เดียวกับยกเลิกบิล (T5.6, ADR-030) — reopen แถวเดิม
   (เคลียร์ `closedAt` กลับเป็น null) ไม่สร้างแถวใหม่** — เพราะ guard ที่ `BillController.cancel()` อ้างอิง
   "รอบกะที่ครอบช่วงเวลาบิลนั้น" ต้องเป็นแถวเดิมแถวเดียวกันเป๊ะ ถ้าสร้างแถวใหม่แทน `closedAt` ของแถวเดิมจะยัง
   เป็นค่าเดิม (ไม่ null) ทำให้ guard ยังบล็อกอยู่ดี — ค่าปิดรอบเก่า (closedAt/counted/system/variance เดิม)
   ไม่ถูกล้างทิ้งตอนเปิดใหม่ (เก็บไว้เป็นร่องรอย) จนกว่าจะปิดรอบใหม่จริงทับ — เพิ่ม `reopenedAt`/
   `reopenedByUserId` แยกไว้บันทึกว่า "เปิดใหม่ครั้งล่าสุดเมื่อไหร่ ใครอนุมัติ" โดยไม่ปนกับ `openedAt`/
   `openedByUserId` เดิม (ความหมายคนละอย่างกัน)
5. **เปิด/ปิดรอบกะทำได้เองโดยแคชเชียร์ (permission `billing:manage` เดียวกับออกบิล) ไม่ต้องมี PIN ผู้จัดการ
   — เฉพาะ "เปิดใหม่" หลังปิดแล้วเท่านั้นที่ต้อง PIN** — ตรงกับ docs/DOMAIN.md ข้อ 16 ที่พูดถึงแค่การเปิดรอบ
   กะใหม่ ไม่ได้บังคับ PIN สำหรับเปิด/ปิดปกติ (แคชเชียร์นับเงินในลิ้นชักของตัวเองได้อยู่แล้วโดยธรรมชาติของงาน)
6. **`GET /branches/:branchId/cashier-shifts/current` ห่อ response เป็น `{ shift }` เสมอ ไม่คืน bare `null`
   ตรง ๆ ตอนไม่มีรอบกะเปิดอยู่** — ไม่ได้ตั้งใจไว้ล่วงหน้า แต่เจอบั๊กจริงตอน browser test: NestJS ส่ง response
   body ว่างเปล่า (Content-Length: 0) เมื่อ handler คืนค่า `null`/`undefined` ตรง ๆ ทำให้ `res.json()` ฝั่งเว็บ
   throw ทันทีเพราะ parse JSON จาก string ว่างไม่ได้ — ห่อ object กันปัญหานี้แบบตรงไปตรงมา ไม่มี endpoint อื่น
   ในระบบที่เคย "คืน null ได้ตรง ๆ" มาก่อน (ทุกตัวคืน array ว่างหรือโยน 404 แทน) จึงไม่มีบั๊กแบบนี้ที่อื่น

เหตุผล: การไม่ผูก `Bill.shiftId` รักษาหลักการ "ไม่แก้ schema ของโมเดลที่ Task ก่อนหน้าล็อกไว้แล้วโดยไม่จำเป็น"
(Bill เพิ่งล็อกจาก T5.6) และทำให้ T5.7 เป็น Task ที่ต่อเติมได้แบบ additive ล้วน ๆ (โมเดลใหม่ 1 ตัว + guard
1 จุดใน BillController) — การคำนวณยอดระบบเฉพาะ CASH ตรงกับความหมายจริงของ "นับเงินในลิ้นชัก" ตามคำใน
docs/PLAN.md ตรง ๆ — การใช้กลไก PIN เดียวกับ T5.6 (ไม่สร้างระบบอนุมัติคู่ขนานใหม่) ตรงกับหลักการเดียวกับที่
ADR-030 วางไว้ตั้งแต่ต้นว่าเป็น "endpoint กลาง" ให้ endpoint อื่นเรียกใช้ซ้ำได้

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือ (1) บังคับต้องมีรอบกะเปิดอยู่ก่อนถึงจะ checkout ได้ —
ปฏิเสธตามคำตอบผู้ใช้ เพราะ PLAN.md ไม่ได้ระบุไว้ และจะกระทบ workflow ทุกจุดที่ออกบิลโดยไม่จำเป็น (2) เพิ่ม
`Bill.shiftId` เป็น foreign key ตรง ๆ — ปฏิเสธเพราะสร้างปัญหา nullable-FK ที่ไม่มีความหมายชัดเจนตามที่อธิบาย
ในข้อ 1 (3) นับยอดระบบจากทุกช่องทางชำระ ไม่ใช่แค่ CASH — ปฏิเสธเพราะขัดกับความหมายของ "เงินในลิ้นชัก" ตรง ๆ
(4) สร้างแถว `CashierShift` ใหม่ตอน "เปิดใหม่" แทนที่จะ reopen แถวเดิม — ปฏิเสธเพราะขัดกับกลไก guard ที่ต้อง
อ้างอิงแถวเดิมเป๊ะตามข้อ 4 — **ข้อควรระวังสำหรับ Task ในอนาคต**: T6.3 (ทิป) ระบุ "ยอดทิปรวมต้องกระทบยอดปิด
รอบถูกต้อง" — ตอนนี้ `CashierShift.systemCashSatang` นับจาก `BillPayment` เท่านั้น ยังไม่มีแนวคิดเรื่องทิปแยก
ต่างหากในระบบเลย (T6.3 ยังไม่ทำ) ต้องกลับมาตัดสินใจว่าทิปที่จ่ายเป็นเงินสดจะรวมเข้า `systemCashSatang` นี้
ด้วยหรือแยกยอดต่างหาก ตอนทำ T6.3 จริง

---

## ADR-032: ลงเวลาเข้า-ออกงาน (T6.1) — PIN ของ StaffProfile แยกจาก User.pinHash ทั้งระบบ, กันลงเวลาซ้ำด้วย state ไม่ใช่เทียบเวลา, ค่ามือยังไม่มีตัวเลขจริง

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T6.1 (M6 — ผู้ใช้สั่งให้ทำทั้ง milestone รวดเดียว "ดำเนินการ M6 ได้เลย ส่วนข้อมูลที่ติด
ให้สมมติไปก่อนแล้วเดี๋ยวมาตั้งค่าทีหลัง")

บริบท: docs/PLAN.md ระบุแค่ "ลงเวลา: clock in/out ด้วย PIN ที่เครื่องหน้าร้าน, คำนวณสาย/ขาด/OT เทียบกะ" ไม่ได้
บอกว่า PIN นี้คือระบบเดียวกับ PIN login ของ T1.3 (`User.pinHash`) หรือไม่ — สำรวจโค้ดพบว่าระบบยังไม่มีทางสร้าง
`User` ใหม่ผ่าน API เลย (มีแต่ seed/test สร้างตรง ๆ) ในขณะที่ "พนักงานให้บริการ" (`StaffProfile`) ส่วนใหญ่ไม่มี
บัญชี `User` ตามคอมเมนต์เดิมบนโมเดลนั้น (T2.1)

ตัดสินใจ:
1. **เพิ่ม `pinHash`/`pinFailedAttempts`/`pinLockedUntil` ลงบน `StaffProfile` ตรง ๆ แยกขาดจาก `User.pinHash`
   ของ T1.3 โดยสิ้นเชิง — ไม่ผูกกับสิทธิ์ RBAC ใด ๆ** เหตุผล: การใช้ `User`-based PIN login (T1.3) ต้องสร้าง
   `User` ใหม่ต่อพนักงานให้บริการทุกคนก่อน ซึ่งไม่มี endpoint ทำเรื่องนี้อยู่แล้ว (จะเป็นการเปิดขอบเขตงาน
   "ระบบจัดการบัญชีผู้ใช้" ที่ไม่มีใน T6.1 เลย) ในขณะที่ permission resource `"attendance"`/`"payroll"` และ
   role `"staff"` ที่ seed ไว้ล่วงหน้าตั้งแต่ T1.1 (`packages/contracts/src/permissions.ts`) ตั้งใจไว้สำหรับ
   T12.5 Staff Portal (ส่วนขยายในอนาคต — พนักงานล็อกอินดูตารางงาน/ค่ามือของตัวเอง) ไม่ใช่สำหรับปุ่มลงเวลาที่
   เครื่องหน้าร้านเครื่องเดียวที่ใคร ๆ ก็กดได้ (คนละ concept กัน) — การแยก PIN ของ `StaffProfile` ออกมาทำให้
   T6.1 เป็นงาน additive ล้วน ไม่แตะระบบ User/RBAC เลย, endpoint ลงเวลายังคงต้อง login เข้าเครื่องหน้าร้านด้วย
   บัญชี `User` ปกติก่อน (permission `attendance:manage`) แล้วเลือกพนักงานจากลิสต์ + กรอก PIN ของพนักงานคนนั้น
   ยืนยันตัวตนอีกชั้น — สองชั้นนี้แยกจุดประสงค์กันชัดเจน (ใครกดเครื่องได้ vs. พนักงานคนไหนกำลังลงเวลาจริง)
2. **ตั้ง PIN ผ่าน endpoint ใหม่บน `StaffController` (`POST :staffId/pin`, permission `staff:manage`) ไม่ใช่
   โมดูล attendance** — เพราะ PIN เป็นคุณสมบัติของ `StaffProfile` (แก้ไขได้เหมือนฟิลด์อื่นของโปรไฟล์) ผู้จัดการ
   เป็นคนตั้ง ไม่ใช่พนักงานตั้งเอง (ไม่มี self-service ในรอบนี้)
3. **กันลงเวลาซ้ำ ("ลงเวลาซ้ำในนาทีเดียวกันต้องถูกปฏิเสธ" — เกณฑ์ผ่าน T6.1) ด้วย state machine ล้วน ๆ ไม่ใช่
   เทียบ timestamp** — clock-in เช็คว่ามีแถวที่ `clockOutAt IS NULL` ของพนักงานคนนั้นอยู่แล้วหรือไม่ (409 ถ้ามี)
   clock-out เช็คว่ามีแถวเปิดอยู่ให้ปิดหรือไม่ (422 ถ้าไม่มี) — สองการ์ดนี้ครอบคลุมกรณีกดซ้ำ (double-tap) ได้
   เองโดยธรรมชาติ: กดซ้ำรอบสองไม่ว่าจะห่างกี่วินาทีก็เจอ error เดิมเสมอ ไม่ต้องเปรียบเทียบเวลานาทีต่อนาทีที่
   เสี่ยง false-positive กว่า (เช่น เข้างานจริงกับออกงานจริงบังเอิญตกนาทีเดียวกันของคนละพนักงาน)
4. **สาย/ขาด/OT (`packages/core/attendance`) รับ input เป็นตัวเลขนาทีล้วน ไม่รับ `Date` ตรง ๆ** — ตามแพทเทิร์น
   เดียวกับ `packages/core/promotion` (`bangkokMinuteOfDay` แปลงที่ apps/api ก่อนส่งเข้า pure function) กะที่
   ข้ามเที่ยงคืนไม่รองรับ (ตรงกับ ADR-013 ที่ `StaffShift` เองก็ไม่รองรับกะข้ามเที่ยงคืนอยู่แล้ว)
5. **⚠️ ยังไม่มีตารางค่ามือจริงจากเจ้าของร้าน (T6.2 ก็ยังไม่มีเช่นกัน — ดู docs/DOMAIN.md ข้อ 9) และยังไม่มี
   requirement เรื่องหักค่าปรับสาย/ขาด (docs/DOMAIN.md ข้อ 13 ยืนยันแล้วว่าไม่มี) — โมดูลนี้จึงแค่ "รายงาน" สาย/
   ขาด/OT เป็นตัวเลข ไม่กระทบเงินเดือนใด ๆ ทั้งสิ้นในรอบนี้**

เหตุผล: หลีกเลี่ยงการเปิดขอบเขตงาน (สร้างระบบจัดการบัญชี User สำหรับพนักงานให้บริการ) ที่ไม่มีใน T6.1 จริง ๆ
รักษาหลักการ "ทำเฉพาะ Task ที่ได้รับมอบหมาย" ของ CLAUDE.md ในขณะที่ยังใช้ pattern lockout (PIN_MAX_ATTEMPTS/
PIN_LOCKOUT_MS) เดิมจาก T1.3 ซ้ำ ไม่ต้องคิดค่าคงที่ใหม่

ผลกระทบ/ทางเลือกที่ไม่เลือก: ทางเลือกที่ไม่เลือกคือใช้ `User`-based PIN login (T1.3) ตรง ๆ กับพนักงานให้บริการ
ทุกคน — ปฏิเสธเพราะต้องสร้างระบบจัดการบัญชี User ก่อน (ไม่มีอยู่จริง) ซึ่งเป็นงานคนละ Task — **ข้อควรระวังสำหรับ
อนาคต**: ถ้า T12.5 (Staff Portal) เริ่มทำจริง จะต้องตัดสินใจว่าพนักงานให้บริการจะได้บัญชี `User` แยกต่างหาก
(เพื่อ login ดูตารางงาน/ค่ามือของตัวเอง ตาม permission ที่ seed ไว้แล้ว) หรือจะขยาย `StaffProfile.pinHash` นี้
ให้ทำหน้าที่นั้นด้วย — ยังไม่ได้ตัดสินใจในรอบนี้

---

## ADR-033: ค่ามือรวมยอดรายงวด (T6.2) — ขอบเขตจริงคือ aggregation ไม่ใช่การเลือกเรต (เลือกไปแล้วตั้งแต่ T5.5), unit test ครอบ business rule ไม่ใช่ตัวเลขจริง

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T6.2 (M6)

บริบท: docs/PLAN.md เขียน T6.2 กว้างมาก ("pure function รองรับ: เหมาต่อชั่วโมง / % ของราคา / ขั้นบันไดตาม
ชั่วโมงสะสม / แยกตามระดับพนักงาน / เรตต่างกันระหว่างคิวหมุนกับลูกค้าขอ / กรณีตัดคอร์สคิดจากมูลค่าหน้าบัตร /
คอมมิชชั่นการขายคอร์ส") แต่ docs/DOMAIN.md ข้อ 9-11 (ตอบไว้ตั้งแต่ต้นโปรเจกต์) ตัดตัวเลือกเกือบทั้งหมดออกแล้ว:
บาทคงที่ต่อครั้งเท่านั้น (ไม่มีเหมาชั่วโมง/%/ขั้นบันได), เรตเดียวกันทั้งคิวหมุน/ลูกค้าขอ, ตัดคอร์สใช้เรตเดียวกับ
ตั้งไว้ (ไม่ผูกมูลค่าหน้าบัตร), ไม่มีคอมมิชชั่นขายคอร์สเลย — และการ "เลือกเรตที่ตรงกับระดับพนักงาน" ก็ถูกเขียน
ไปแล้วจริงตั้งแต่ T5.5 (`AppointmentItemController`, snapshot ลง `ServiceJob.commissionSatang` ทันทีที่เริ่มงาน
ตาม ADR-029) — จึงไม่เหลืออะไรให้ "เลือกเรต" อีกที่ `packages/core/commission`

ตัดสินใจ: ขอบเขตจริงของ `packages/core/commission` คือ**รวมยอดค่ามือของแต่ละพนักงานสำหรับงวดจ่ายหนึ่งงวด**
(`calculateStaffCommission`) จากรายการ `ServiceJob.commissionSatang` ที่ snapshot ไว้แล้ว กรอง 3 เงื่อนไข:
จบงานแล้ว (`completedAt` ไม่ null), ยังไม่ถูกยกเลิก (`voidedAt` เป็น null — ADR-029), และ `completedAt` อยู่ใน
ช่วงงวด `[periodStart, periodEnd)` — ฟังก์ชันนี้ไม่รู้จัก branchId เลย (เป็นหน้าที่ผู้เรียกกรองมาก่อนผ่าน Prisma
branch-scope extension) unit test ≥ 20 เคสตามเกณฑ์ผ่านใน docs/PLAN.md ครอบ business rule ของการกรอง/รวมยอด
(ขอบเขต inclusive/exclusive, voided/ไม่จบงานถูกตัดออก, หลายพนักงาน, ปริมาณมาก) — **ไม่ใช่การเทียบกับตารางค่ามือ
จริงจากเจ้าของร้าน เพราะยังไม่ได้รับตัวเลขจริง** (docs/DOMAIN.md ข้อ 9 ยังไม่ติ๊ก) เกณฑ์ผ่านเดิมที่เขียนว่า
"เทียบกับตารางตัวอย่างที่เจ้าของร้านให้มา ต้องตรงทุกบาท" ยังทำไม่ได้ในรอบนี้ — ฟังก์ชันไม่ขึ้นกับตัวเลขจริงเลย
(รับ `commissionSatang` เป็น input ตรง ๆ) จึงพร้อมใช้ได้ทันทีที่มีตัวเลขจริงมาแทนที่ seed placeholder โดยไม่ต้อง
แก้โค้ดใด ๆ

เหตุผล: เขียนโค้ดตามที่ docs/DOMAIN.md ตัดสินใจไว้แล้วจริง ไม่ใช่ตาม PLAN.md ตอนร่างก่อนถาม DOMAIN.md (ตาม
หลักการ §0 ของ PLAN.md เองที่บอกว่า DOMAIN.md คือคำตอบจริงที่ต้องยึดเมื่อขัดกับ PLAN.md ที่ร่างไว้ก่อนถาม)

ผลกระทบ: T6.4 (ปิดงวดจ่าย) เรียก `calculateStaffCommission` ตรง ๆ — **ข้อควรระวังสำหรับอนาคต**: ตัวเลขค่ามือใน
`packages/db/prisma/seed.ts` (และค่าที่กรอกผ่าน UI T2.3 ตอนนี้) เป็น placeholder ทั้งหมด ต้องขอตารางค่ามือจริง
+ สลิปย้อนหลัง 1 เดือนจากเจ้าของร้านมาตรวจว่ายอดสรุปงวดจ่ายจาก T6.4 ตรงทุกบาทจริงก่อนขึ้นระบบจริง (docs/PLAN.md
§9 checklist)

---

## ADR-034: ทิปกองกลาง (T6.3) — เกณฑ์แบ่งเท่ากันตาม TimeClockEntry เป็นค่าชั่วคราวรอผู้ใช้ยืนยัน, แบ่งทันทีตอนบันทึกไม่รอถึงปิดงวด, ยังไม่กระทบ CashierShift.systemCashSatang

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T6.3 (M6)

บริบท: docs/DOMAIN.md ข้อ 12 ตอบแค่ว่าทิปเข้า "กองกลางพนักงานทุกคน" (ไม่ใช่ผู้ให้บริการคนเดียว ไม่หักเข้าร้าน)
แต่ทิ้งคำถามไว้ตรง ๆ ว่า "ต้องมีกติกาแบ่งกองกลาง...ต้องถามเพิ่มว่าแบ่งตามเกณฑ์ใด เช่น เท่ากันทุกคน หรือตาม
ชั่วโมงทำงาน" — ผู้ใช้สั่งในเซสชันนี้ให้ดำเนินการ M6 ทั้งหมดโดย "สมมติไปก่อนแล้วเดี๋ยวมาตั้งค่าทีหลัง" สำหรับ
ข้อมูล/กติกาที่ยังไม่ครบ

ตัดสินใจ:
1. **ค่าเริ่มต้นชั่วคราว: แบ่งเท่ากันทุกคนที่มี `TimeClockEntry` (T6.1) คลุมวันปฏิทินไทยเดียวกับ `Bill.createdAt`
   ของบิลนั้น ที่สาขาเดียวกัน** — ไม่ใช่ตามชั่วโมงทำงานจริงหรือเกณฑ์อื่น เพราะยังไม่มีคำตอบสุดท้ายจากผู้ใช้
   เลือกอันนี้เพราะ (ก) ใช้ข้อมูลที่มีอยู่แล้วจาก T6.1 ได้ทันที ไม่ต้องเพิ่มตาราง/ฟิลด์ใหม่ (ข) ใกล้เคียงกับ
   วิธีที่ร้านนวดทั่วไปแบ่งทิปกองกลางในทางปฏิบัติมากกว่าแบ่งตามยอดขายส่วนตัว (ซึ่งขัดกับ "กองกลาง" ตรง ๆ) —
   `packages/core/tips.splitTipsEqually` แยกเป็น pure function ต่างหาก รับ `staffIds` เป็น input ล้วน ไม่รู้จัก
   วิธีหา "ใครทำงานวันนั้น" เอง เพื่อให้ **สลับเกณฑ์แบ่งทีหลังได้โดยแก้แค่ apps/api (query หา staffIds) ไม่ต้อง
   แก้ business logic การหารเงินเลย** เมื่อผู้ใช้ยืนยันเกณฑ์จริง (เท่ากัน / ตามชั่วโมง / อื่น ๆ)
2. **คำนวณแบ่งทันทีตอนบันทึกทิป (`POST .../tips`) เป็นแถว `TipAllocation` ถาวร ไม่รอคำนวณตอนปิดงวดจ่าย (T6.4)**
   — เพราะพนักงานที่ "ทำงานวันนั้น" ต้องอ่านจาก `TimeClockEntry` ณ เวลาที่บันทึกทิป ถ้ารอคำนวณตอนปิดงวด (อาจ
   ห่างเป็นสัปดาห์) พนักงานที่ลาออกไปแล้วระหว่างนั้นจะหาย/ปนกับพนักงานใหม่ที่ยังไม่ได้ทำงานวันนั้นจริง — T6.4
   แค่อ่านผลรวม `TipAllocation` ตรง ๆ ไม่คำนวณแบ่งซ้ำ
3. **หารเศษสตางค์ที่ลงตัวไม่ได้ (เช่น ทิป 100 บาท ÷ 3 คน) แจกให้พนักงาน N คนแรกตามลำดับ `staffId` ที่เรียง
   แล้ว (ไม่ใช่สุ่ม)** — เพื่อให้ deterministic/ทดสอบซ้ำได้ ไม่ใช่เพราะมีความหมายพิเศษว่าใคร "ควรได้" เศษมากกว่า
4. **ไม่มีพนักงานลงเวลาทำงานวันนั้นเลย → ปฏิเสธการบันทึกทิป (422) ไม่ใช่เก็บเงินไว้เฉย ๆ หรือทิ้ง** — เงินทิป
   ห้าม "หายไปเฉย ๆ" ตามหลักการเดียวกับ CLAUDE.md เรื่องเงิน ต้องมีคนรับเสมอถ้าจะบันทึก ถ้าไม่มีใครลงเวลาเลย
   ระบบไม่รู้จะแบ่งให้ใคร — ต้องให้พนักงานลงเวลาก่อนแล้วค่อยบันทึกทิป (workflow ปกติควรเป็นแบบนี้อยู่แล้ว)

ผลกระทบ/ข้อควรระวังสำหรับอนาคต:
- **`BillTip` แยกขาดจาก `BillPayment` โดยสิ้นเชิง — เงินทิปสดที่รับมาไม่ถูกนับเข้า `CashierShift.systemCashSatang`
  เลย** ตามที่ ADR-031 เตือนไว้ล่วงหน้าแล้วว่าต้องกลับมาตัดสินใจตอน T6.3 — **อัปเดต 2026-08-28: เจ้าของร้าน
  ยืนยันแล้วว่าให้แยกยอดทิปออกจากยอดปิดรอบกะถาวร (ตอนวิเคราะห์ระบบสำหรับร้าน 4-8 คน)** ไม่ใช่ค่าเริ่มต้น
  ชั่วคราวอีกต่อไป — พฤติกรรมปัจจุบันของโค้ดตรงกับการตัดสินใจนี้อยู่แล้ว ไม่ต้องแก้อะไรเพิ่ม ผลที่ยอมรับแล้ว:
  ถ้าลูกค้าทิปเป็นเงินสด ลิ้นชักจะมีเงินสดจริงมากกว่ายอดระบบเท่ากับยอดทิปเงินสดของวันนั้นเสมอ พนักงานต้อง
  อธิบายเป็น `varianceReason` ทุกรอบปิดกะที่มีทิปเงินสด — เป็นพฤติกรรมที่ตั้งใจแล้ว ไม่ใช่บั๊ก
- เมื่อผู้ใช้ยืนยันเกณฑ์แบ่งทิปจริง (ข้อ 1 ด้านบน) ต้องอัปเดต comment ในโค้ดที่ยังอ้างว่าเป็น "ค่าเริ่มต้น
  ชั่วคราว" ทั้งหมด (`schema.prisma` BillTip, `bill.controller.ts` recordTip, `packages/core/tips/index.ts`)

---

## ADR-035: ปิดงวดจ่ายค่ามือ (T6.4) — schema/migration ของทั้ง M6 รวมไว้ commit เดียว (T6.1), ปิดงวดล็อกด้วยช่วงเวลาแบบเดียวกับ CashierShift, ปิดซ้ำใช้ upsert, ส่งออกเป็น CSV ไม่ใช่ .xlsx จริง, ยังไม่มีหน้าเว็บ

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T6.4 (M6 — Task สุดท้ายของ milestone)

บริบท: ผู้ใช้สั่งให้ทำ M6 ทั้ง 4 Task รวดเดียวในเซสชันเดียว แต่ยังให้แยก commit ต่อ Task ตามปกติ (T6.1-T6.4
คนละ commit) schema ของทั้ง milestone ถูกออกแบบพร้อมกันตั้งแต่ต้น (โมเดลอ้างอิงกันข้าม Task เช่น `BillTip`
ของ T6.3 ต้องมีอยู่ก่อน T6.4 จะอ่าน `TipAllocation` ได้) จึงเขียนลง `schema.prisma` ครั้งเดียวตั้งแต่เริ่ม T6.1

ตัดสินใจ:
1. **Migration ของ schema ทั้ง M6 (StaffProfile.pin*, TimeClockEntry, BillTip, TipAllocation, PayrollPeriod,
   PayrollPeriodStaffSummary และ relation ที่เกี่ยวข้องทั้งหมด) รวมอยู่ใน commit ของ T6.1 (Task แรกที่แตะ
   schema) ไม่แยกเป็น 3 migration ตาม Task** — เพราะโมเดลเหล่านี้ผูกกันจริง (Branch/User ได้ relation ใหม่
   พร้อมกันหมดในการแก้ไฟล์ครั้งเดียว) การพยายามแยก migration ตาม Task ย้อนหลังจะต้อง comment โมเดลบางส่วนออก
   ชั่วคราวแล้ว migrate ทีละส่วน ซึ่งเสี่ยงสร้าง migration history ที่สับสน/ผิดพลาดมากกว่าประโยชน์ที่ได้ — โค้ด
   แอปพลิเคชัน (controller/service/DTO/test) ของแต่ละ Task ยังคงแยก commit ตามปกติ ตาม CLAUDE.md
2. **ล็อกงวดจ่ายด้วยแพทเทิร์นเดียวกับ `CashierShift` (T5.7, ADR-031) เป๊ะ — หา "งวดที่ครอบ `bill.createdAt`"
   แทนการผูก foreign key ตรง ๆ** เหตุผลเดียวกับ ADR-031 ข้อ 1 ทุกประการ (ไม่บังคับต้องมีงวดเปิดอยู่ก่อนออกบิล,
   ไม่ต้องแก้ schema ของ `Bill`) — เพิ่ม guard ใหม่ใน `BillController.cancel()` ต่อจาก guard ของ `CashierShift`
   เดิม (บิลหนึ่งใบอาจถูกทั้งรอบกะและงวดจ่ายที่ปิดไปแล้วบล็อกพร้อมกันได้ ไม่ขัดแย้งกัน)
3. **ปิดงวดคำนวณสรุปจาก `ServiceJob`/`TipAllocation` สดทุกครั้ง แล้ว `upsert` (ไม่ใช่ `create`) ลง
   `PayrollPeriodStaffSummary` ต่อพนักงาน** — เพราะงวดเปิดใหม่ได้ (เหมือน `CashierShift.reopen`) แล้วต้องปิดซ้ำ
   ได้โดยไม่ชนกับ `@@unique([payrollPeriodId, staffId])` เดิม หรือเหลือแถวซ้ำ/แถวเก่าค้าง — สรุปเก่าถูกทับด้วย
   สรุปใหม่เสมอตอนปิดซ้ำ (ตรงกับหลักการ snapshot ที่ยัง "แก้ไขได้อีกครั้งถ้าเปิดใหม่" เหมือน
   `CashierShift.countedCashSatang` ที่ ADR-031 วางไว้)
4. **"export Excel" ทำเป็น CSV endpoint (`GET .../summary.csv`) ไม่ใช่ไฟล์ `.xlsx` จริง** — เพราะ CLAUDE.md
   ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม และในระบบนี้ไม่มี library สร้างไฟล์ไบนารี (`.xlsx`/`.pdf`) เลยแม้แต่ตัว
   เดียว (ใบเสร็จ/ใบคิวใช้ `window.print()` + CSS ล้วนตาม ADR-024) — CSV เปิดใน Excel ได้ตรง ๆ โดยไม่ต้องขอ
   dependency ใหม่ ถือว่าตอบโจทย์ "export Excel" ในทางปฏิบัติ
5. **"สลิปรายบุคคล PDF" ยังไม่ได้ทำในรอบนี้ — ไม่มีหน้าเว็บ (apps/web) สำหรับ T6.4 เลย** — ขอบเขตรอบนี้จำกัดไว้
   เฉพาะ backend (endpoint เปิด/ปิด/เปิดใหม่งวด + สรุปยอด + CSV) ตามที่ T6.1/T6.3 ก็ไม่ได้แตะ apps/web เช่นกัน
   ให้สอดคล้องกันทั้ง milestone — **ต้องทำหน้าเว็บสรุปงวดจ่าย + ปุ่มพิมพ์สลิปรายบุคคล (แพทเทิร์นเดียวกับ
   `receipt.tsx` ที่ใช้ `window.print()` + CSS ล้วน ไม่ใช่ PDF library) เป็นงานที่เหลือค้างอยู่**

เหตุผล: รักษาความสอดคล้องของ schema/migration history ทั้ง milestone ที่ถูกออกแบบพร้อมกัน ในขณะที่ยังคง
แยกความรับผิดชอบของโค้ดแอปพลิเคชันแต่ละ Task ไว้ชัดเจนตาม CLAUDE.md — ใช้แพทเทิร์น lock/reopen ที่พิสูจน์แล้ว
จาก T5.7 ซ้ำ ลดความเสี่ยงจากการคิดกลไกใหม่

ผลกระทบ/งานที่เหลือค้าง:
- หน้าเว็บสรุปงวดจ่าย + พิมพ์สลิปรายบุคคล (ข้อ 5 ด้านบน) — ยังไม่ทำ
- ค่าหัก (`deductionSatang`) เป็น 0 เสมอในโค้ดตอนนี้ เพราะยังไม่มี requirement เรื่องการหักเงินใน docs/PLAN.md
  M6 เลย — field มีไว้เผื่ออนาคตเท่านั้น
- Docker Desktop ไม่พร้อมใช้งานตอนเริ่มเซสชันนี้ (ค้างที่ขั้นตอน first-run ที่ต้องมีคนคลิกยืนยันเอง) แต่กลับมาใช้ได้ก่อนจบเซสชัน — รันครบทุกอย่างแล้ว: migration `20260827112700_m6_attendance_tips_payroll` สร้าง+apply จริง (ไม่ใช่แค่ diff), `db:seed` ผ่าน (staff ได้ PIN placeholder ครบ), `pnpm --filter @lotus-desk/api test:e2e` ผ่านทั้ง 188 เทสต์ (23 ไฟล์ รวม T6.1/T6.3/T6.4 ของใหม่), `pnpm verify` ผ่านทั้ง monorepo (23/23 task)

---

## ADR-036: สรุปรายวัน (T7.1) — BullMQ ต่อตรงไม่ใช้ wrapper, สูตรคำนวณ "เงินเข้า vs รายได้รับรู้", ข้าม "ส่วนลดตามผู้อนุมัติ", pre-aggregate ต่อพนักงานแยกตาราง, backfill ต้องเลี่ยง Nest DI เพราะ tsx ไม่รองรับ emitDecoratorMetadata

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T7.1 (M7 — เริ่ม milestone รายงาน)

บริบท: ผู้ใช้สั่งให้ทำ M7 ทั้ง 4 Task ในเซสชันเดียว ก่อนเริ่มเขียนโค้ดพบ 2 ช่องว่างจริงในระบบที่กระทบขอบเขต
รายงานโดยตรง จึงหยุดถามผู้ใช้ก่อน (ไม่ใช่แค่ "ตัวเลขที่ยังไม่มี" แบบ M6 แต่เป็น "ฟีเจอร์ที่ไม่เคยทำ" ในโค้ด
ที่ปิด milestone ไปแล้ว):

1. **"ส่วนลดแยกตามผู้อนุมัติ"** — docs/DOMAIN.md ข้อ 14 เขียนไว้ว่าทุกส่วนลดต้องผ่าน PIN ผู้จัดการอนุมัติ
   แต่โค้ด checkout จริง (T5.6, `BillController.checkout`) ไม่เคยมี gate นี้เลย: `evaluatePromotions`
   auto-apply โปรฯ ที่ชนะทันทีฝั่ง server ไม่มีช่อง `approvedByUserId`/approval token ใด ๆ บน `Bill` ทั้งสิ้น
   — ผู้ใช้ตัดสินใจ: **ข้าม metric นี้ไปก่อน ห้ามแก้ checkout flow ของ T5.6 ในรอบ M7**
2. **"เงินเข้า" ฝั่งคอร์ส** — การซื้อคอร์ส/แพ็กเกจ (`MemberPackage`, T5.1/T5.2) ไม่เคยบันทึก payment channel
   เลยตั้งแต่ต้น (`purchaseMemberPackageSchema` รับแค่ `packageId` ไม่มี `paymentMethod`/`Bill`/`BillPayment`
   ผูกอยู่เลย) มีแค่ `priceSatang` + `purchasedAt` — ผู้ใช้ตัดสินใจ: **รายงานยอดรวมอย่างเดียว ไม่แยกช่องทาง
   ห้ามแก้ endpoint ซื้อคอร์สของ T5.1/T5.2 ในรอบ M7**

ตัดสินใจสถาปัตยกรรม:

1. **สูตร "เงินเข้า vs รายได้รับรู้"** (ต่อวัน ต่อสาขา):
   - `recognizedRevenueSatang` = SUM(`Bill.totalSatang`) ของบิลที่ไม่ถูกยกเลิกวันนั้น — นับรวมทั้งบิลที่จ่าย
     เงินสดและบิลที่ตัดคอร์ส (PACKAGE) เพราะรับรู้รายได้ตอนส่งมอบบริการ ไม่ใช่ตอนรับเงิน (docs/DOMAIN.md
     กำหนดหลักการ deferred revenue ไว้แล้ว)
   - `cashInSatang` = `paymentCashSatang` (ผลรวม `BillPayment.amountSatang` method=CASH ของบิลไม่ยกเลิก) +
     `cashInPackageSatang` (ผลรวม `MemberPackage.priceSatang` ที่ `purchasedAt` วันนั้น ทั้งก้อน ไม่แยกช่องทาง
     ตามข้อ 2 ด้านบน) — บิลที่ตัดคอร์ส (`BillPayment.method=PACKAGE`) ไม่ใช่เงินเข้าใหม่ (ตัดยอดที่จ่ายไปแล้ว
     ตอนซื้อคอร์ส) จึงไม่นับซ้ำใน `cashInSatang` แม้จะนับใน `recognizedRevenueSatang` แล้วก็ตาม — ตัวเลขสอง
     ตัวนี้ตั้งใจให้ต่างกันเมื่อมีบิลตัดคอร์สเยอะ เพื่อสะท้อน deferred revenue จริง
   - แยกช่องทางชำระ (`paymentCashSatang`/`paymentPackageSatang`/`paymentVoucherSatang`/
     `paymentComplimentarySatang`) ใช้ column แยกต่อค่า enum คงที่ 4 ค่า (แพทเทิร์นเดียวกับ ADR-008) ไม่ใช้
     JSON เพราะ `PaymentMethod` ไม่มีทางเพิ่มค่าใหม่บ่อย
2. **"คอร์สคงเหลือ"/"คอร์สใกล้หมดอายุ 30 วัน" ไม่ pre-aggregate** — เป็น snapshot ของสถานะปัจจุบัน
   (`MemberPackage` ที่ `status=ACTIVE`) ไม่ใช่ค่าย้อนหลังรายวัน T7.2 query สดได้ตรง ๆ ไม่ต้องพึ่ง
   `DailySummary`
3. **utilization พนักงาน + ค่ามือ ต้อง pre-aggregate แยกตาราง (`DailyStaffSummary`)** ไม่ query สดตอน T7.2
   เพราะเกณฑ์ผ่าน T7.2 คือ "รายงานย้อนหลัง 1 ปีตอบใน < 500ms" และ `ServiceJob` ไม่มี index บน
   (staffId, date) — คำนวณพร้อมกับ `DailySummary` ในรอบเดียวกัน เรียก `calculateStaffCommission`
   (packages/core, T6.2) ซ้ำ ไม่เขียนตรรกะค่ามือใหม่
4. **ลูกค้าใหม่/เก่า คำนวณตอนรัน job เท่านั้น** (เช็คว่า memberId ที่มีบิลวันนั้นเคยมีบิลก่อนหน้าไหม) ไม่ query
   สดตอน T7.2 เพราะสแกนประวัติบิลทั้งหมดของสมาชิกทุกครั้งจะช้าเมื่อข้อมูลสะสมมาก
5. **BullMQ ต่อ `Queue`/`Worker` ตรง ๆ เป็น provider ธรรมดา ไม่ใช้ `@nestjs/bullmq`** (wrapper package) — ลด
   dependency ที่ไม่จำเป็น ใช้ `REDIS_URL` จาก `ConfigService` (มีอยู่แล้วตั้งแต่ T0.2 ยังไม่เคยมีโค้ดต่อจริง)
   repeatable job ลงทะเบียนด้วย `queue.upsertJobScheduler(jobSchedulerId, ...)` (bullmq 6.x ย้ายมาจาก
   `queue.add({repeat})` เดิม) คีย์คงที่ทำให้ boot ซ้ำกี่ครั้งก็ไม่สร้าง job ซ้ำ — cron ตี 2 (`tz: "Asia/Bangkok"`
   ให้ BullMQ จัดการ timezone เอง ไม่ต้องคำนวณ UTC+7 มือ) สรุป "เมื่อวาน" เสมอ (วันที่เพิ่งจบเต็มวัน ไม่ใช่
   วันที่เพิ่งเริ่มมา 2 ชม.)
6. **Idempotency**: ทุกแถวเขียนด้วย `upsert` คีย์ตาม `@@unique` คำนวณใหม่จากข้อมูลต้นทางทั้งหมดทุกครั้ง (ไม่มี
   `increment`/สะสมค่าเดิมเลย) — รันซ้ำกี่ครั้งได้ผลเท่าเดิมเสมอ ทดสอบจริงด้วยการเรียก 3 ครั้งติดกันใน e2e

7. **⚠️ พบข้อจำกัดของ `tsx` (esbuild) ที่กระทบสคริปต์ backfill โดยตรง — `tsx` ไม่รองรับ
   `emitDecoratorMetadata` เลย** (ข้อจำกัดที่ทีม esbuild ประกาศไว้เอง ไม่ใช่ตั้งค่า tsconfig ผิด) ทำให้
   `Reflect.getMetadata("design:paramtypes", ...)` คืน `undefined` เสมอเมื่อรันผ่าน `tsx` — NestJS DI ที่พึ่ง
   การ inject อัตโนมัติจาก constructor type (ไม่มี `@Inject()` ชัดเจน) จะ inject `undefined` เงียบ ๆ ไม่ throw
   ชัดเจนตอนนั้น พังทีหลังตอนใช้งานจริงแทน (พิสูจน์ได้ว่าไม่ใช่แค่ Task นี้ — ทดสอบแล้วว่าเกิดกับทุกคลาสที่มี
   `@Injectable()` ในระบบ ไม่ใช่บั๊กเฉพาะโค้ดใหม่) — **แก้โดยไม่ให้สคริปต์ backfill bootstrap ทั้งแอปผ่าน
   `NestFactory.createApplicationContext(AppModule)` เลย** เพราะดึง RBAC/Auth/Audit ที่ไม่เกี่ยวข้องมาด้วยเปล่า
   ๆ — `PrismaService` (ไม่มี constructor param) และ `DailySummaryService` (รับแค่ `PrismaService` ตัวเดียว)
   บังเอิญไม่มี dependency ซับซ้อนพอที่จะ `new` ตรง ๆ ได้โดยไม่ต้องพึ่ง Nest DI/reflection เลย — เร็วกว่าด้วย
   (ไม่ bootstrap โมดูลอื่นที่ไม่เกี่ยวข้อง) **ข้อควรระวังสำหรับอนาคต**: ถ้า Task ต่อไปต้องเขียนสคริปต์ CLI ที่
   ต้องพึ่ง provider ที่มี dependency graph ซับซ้อนกว่านี้ (เช่นต้องใช้ `AuthService`/`ConfigService` เอง) วิธีนี้
   จะใช้ไม่ได้อีก ต้องกลับมาแก้ที่ tooling จริง (เช่น compile ด้วย `tsc` แล้วรันด้วย `node` แทน `tsx`)

ผลกระทบ: T7.2 (รายงาน API) อ่านจาก `DailySummary`/`DailyStaffSummary` เป็นหลัก + query สดเฉพาะ "คอร์สคงเหลือ/
ใกล้หมดอายุ" — ไม่มี metric "ส่วนลดตามผู้อนุมัติ" ในรายงานเลยจนกว่าจะมีคนตัดสินใจย้อนกลับไปทำ manager-PIN gate
ที่ checkout จริงตามที่ docs/DOMAIN.md ตั้งใจไว้ (นอกขอบเขต M7)

---

## ADR-037: API รายงาน (T7.2) — แยก compute จาก compute-and-persist เพื่อรองรับ "วันนี้" สด, groupBy ไม่อยู่ใน branch-scope extension ต้องใส่ branchId มือเอง

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T7.2 (M7)

บริบท: T7.1 เขียน `DailySummaryService.computeAndUpsertForBranchAndDate` เป็นเมธอดเดียวทั้งคำนวณและเขียน DB
แต่ "KPI วันนี้" (ต้องใช้ตอน T7.3 แดชบอร์ด) ไม่มีแถว `DailySummary` ให้อ่านจนกว่า cron ตี 2 ของพรุ่งนี้จะรัน —
ต้องคำนวณสดโดยไม่เขียนทับ (วันนี้ยังไม่ "ปิด")

ตัดสินใจ:
1. **แยก `computeForBranchAndDate` (คำนวณอย่างเดียว คืนค่า `DailySummaryComputation`) ออกจาก
   `computeAndUpsertForBranchAndDate` (เรียกตัวแรกแล้วค่อย upsert)** — `GET /reports/today` เรียกตัวแรกตรง ๆ
   ไม่ผ่าน upsert เลย ส่วน cron/backfill ยังใช้ตัวที่ผ่าน upsert เหมือนเดิม พฤติกรรมเดิมไม่เปลี่ยน (ยืนยันด้วย
   e2e เดิมของ T7.1 ที่ยังผ่านหลัง refactor)
2. **พบว่า `prisma.forBranch(branchId)` (branch-scope extension, T1.4) กรอง branchId อัตโนมัติเฉพาะ
   `findMany`/`findFirst`/`findUnique`/`count` เท่านั้น — ไม่ครอบ `groupBy`** (ดู `SCOPED_OPERATIONS` ใน
   `branch-scope.extension.ts`) รายงาน "ลูกค้าที่หายไป" ต้องใช้ `bill.groupBy` เป็น query แรก (ไม่ได้กรองผ่าน
   id list ที่ scoped มาก่อนเหมือนรายงานคอร์ส) — ถ้าใช้ `prisma.forBranch(...).bill.groupBy(...)` ตรง ๆ ตามที่
   ร่างไว้แต่แรก จะรั่วข้อมูลสมาชิกจากสาขาอื่นทันที (ละเมิด CLAUDE.md ข้อ 5) แก้โดยใส่ `branchId:
   branch.branchId` เข้า `where` ของ `groupBy` เองตรง ๆ + เขียน e2e test เจาะจงเช็คการรั่วข้ามสาขาไว้กันกลับมา
   พังอีก — **ข้อควรระวังสำหรับอนาคต**: Task ไหนใช้ `groupBy`/`aggregate` เป็น query แรก (ไม่ใช่ query ที่สอง
   ที่กรองด้วย id list ที่ scoped มาก่อนแล้ว) ต้องใส่ `branchId` ใน `where` เองเสมอ ห้ามพึ่ง `forBranch()` เฉย ๆ
3. **รายงานคอร์สคงเหลือ/ใกล้หมดอายุ/ลูกค้าหายไป เป็น live query ทั้งหมด ไม่อ่านจาก `DailySummary`** ตรงตาม
   ADR-036 ข้อ 2 — balance คำนวณด้วยแพทเทิร์นเดียวกับ `MemberPackageController.list` (T5.2): `groupBy` ผลรวม
   `MemberPackageLedgerEntry.delta` ต่อ `memberPackageId`

เหตุผล: การแยก compute/persist ทำให้ "วันนี้" กับ "ย้อนหลัง" ใช้ตรรกะคำนวณตัวเดียวกันเป๊ะ ไม่เสี่ยงเลขไม่ตรงกัน
ระหว่างสองทาง — การพบช่องโหว่ `groupBy` ตั้งแต่ตอนพัฒนา (ไม่ใช่ตอน production) ป้องกันข้อมูลรั่วข้ามสาขาจริง

---

## ADR-038: แดชบอร์ด (T7.3) — การ์ดแยก query กันเอง, ลิงก์สมาชิกใช้ /members?q= ชั่วคราวเพราะยังไม่มี route ลึก, เติม q= param ให้หน้าสมาชิกอ่านจริง

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T7.3 (M7)

บริบท: docs/PLAN.md เกณฑ์ผ่าน T7.3 คือ "ไม่มีการ์ดไหนที่กดไม่ได้" — ทุกการ์ดต้องพาไปหน้ารายการจริง หน้าสมาชิก
(T3.1) ยังไม่มี route ลึกแบบ `/members/[memberId]` (เปิดชีทแก้ไขจาก state ในหน้าเดียวเท่านั้น) และช่องค้นหา
เดิมเป็น local state ล้วน ไม่อ่านจาก URL query param เลย

ตัดสินใจ:
1. **4 การ์ดของแดชบอร์ดดึงข้อมูลแยก `useQuery` กันคนละตัว** ไม่รวมเป็น query เดียว — การ์ดที่โหลดช้าไม่บล็อก
   การ์ดอื่น แต่ละการ์ดมีสถานะ loading/empty/error/success ของตัวเองครบตาม CLAUDE.md
2. **ลิงก์จาก "คอร์สใกล้หมดอายุ"/"ลูกค้าหายไป" ไปหน้าสมาชิกใช้ `/members?q=<รหัสสมาชิก>`** เป็นทางเลือกที่ดี
   ที่สุดตอนนี้ (ไม่มี route ลึกให้ลิงก์ตรงถึงคนเดียว) — **เติม `useSearchParams().get("q")` เป็นค่าเริ่มต้นของ
   ช่องค้นหาใน `member-page-client.tsx`** (ก่อนหน้านี้เป็นแค่ local state ว่างเปล่า ไม่อ่าน URL เลย) ให้ลิงก์
   จากแดชบอร์ดกรองไปที่สมาชิกคนนั้นจริง ไม่ใช่แค่พาไปหน้าสมาชิกเฉย ๆ แล้วให้ผู้ใช้ค้นหาเอง — ปิดช่องว่างที่พบ
   ระหว่างตรวจงาน (เดิม agent ที่ทำ T7.3 ทิ้งไว้เป็น "ทำได้แค่พาไปหน้าจริง ยังไม่ auto-filter" ตามที่ระบุไว้ใน
   ขอบเขต Task แต่ขัดกับเกณฑ์ผ่านจริง ๆ ที่ต้องการ "กดแล้วไปยังรายการนั้นได้" ไม่ใช่แค่ "ไปหน้าเดียวกัน")
3. **กระดานคิวย่อไม่ reuse `QueueRail` (T4.5) เป็น component ตรง ๆ** — รูปทรงเดิมเป็นรางแนวตั้งแคบ ๆ ออกแบบมา
   ให้อยู่ข้าง Lane Board ไม่เหมาะกับการ์ดในกริดแดชบอร์ด reuse แค่แหล่งข้อมูล (`staffQueueApi`) แล้วจัด
   layout ใหม่เป็นลิสต์แนวตั้งกะทัดรัด

เหตุผล: การกดการ์ดแล้ว "ไปหน้าเดียวกันแต่ต้องค้นหาเอง" ไม่ตรงกับเจตนาจริงของเกณฑ์ผ่าน — ผู้ใช้ที่กดจากรายชื่อ
คอร์สใกล้หมดอายุ 20 รายชื่อ ควรเห็นสมาชิกคนนั้นทันที ไม่ใช่ต้องพิมพ์ค้นหาซ้ำเอง การเพิ่ม `useSearchParams`
เข้า `member-page-client.tsx` เป็นการเปลี่ยนแปลงเล็กมาก (initial state เท่านั้น ไม่กระทบ debounce/flow ค้นหา
เดิมเลย) จึงทำเป็นส่วนหนึ่งของ T7.3 แทนที่จะปล่อยเป็นช่องว่างค้างไว้

ผลกระทบ: เมื่อ T3.x มี route ลึกจริง (`/members/[memberId]`) ในอนาคต ควรเปลี่ยนลิงก์จากแดชบอร์ดให้ชี้ตรงไปที่
นั้นแทน `/members?q=` — ค้นหาข้อความ "ยังไม่มีเส้นทางลึก" ในโค้ดของ T7.3 เพื่อหาจุดที่ต้องแก้

---

## ADR-039: หน้ารายงาน + กราฟ (T7.4) — sync ตัวกรองเข้า URL สองทางเป็นครั้งแรกในระบบ, CSV มือ + BOM กัน Excel อ่านไทยพัง, สี Recharts อ่านจาก CSS variable ไม่ hardcode

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: T7.4 (M7 — Task สุดท้ายของ milestone)

บริบท: เกณฑ์ผ่าน T7.4 คือ "แชร์ URL แล้วเปิดได้ตัวกรองเดิม" — ในระบบตอนนี้มีแค่ตัวอย่างเดียวที่อ่านค่าเริ่มต้น
จาก URL query param (`member-page-client.tsx` จาก T7.3, ADR-038) แต่เป็นทิศทางเดียว (อ่านตอนโหลด ไม่เขียน
กลับตอนเปลี่ยนค่า) — T7.4 ต้องทำสองทางเป็นครั้งแรกในระบบ

ตัดสินใจ:
1. **sync ตัวกรอง (from/to/staffId) เข้า URL สองทาง**: อ่านค่าเริ่มต้นด้วย `useSearchParams()`, เขียนกลับด้วย
   `router.replace()` (ไม่ใช้ `push()` เพราะไม่อยากให้ทุกการเปลี่ยนตัวกรองสร้าง history entry ใหม่ — กด "ย้อน
   กลับ" ของเบราว์เซอร์ไม่ควรไล่ทีละตัวกรอง) โหลดหน้าเปล่า `/reports` ครั้งแรกจะ normalize URL ให้มี
   `?from=&to=` (ค่าเริ่มต้นย้อนหลัง 30 วัน) ทันที ไม่ปล่อยเป็น URL เปล่าที่ไม่มีความหมายอะไรให้แชร์
2. **export CSV เขียนมือ ไม่ใช้ library** — สอดคล้องกับ ADR-035 (T6.4) ไฟล์ต้องขึ้นต้นด้วย UTF-8 BOM
   (`\uFEFF`) เพราะ Excel บน Windows อ่าน CSV ที่มีภาษาไทยแบบ UTF-8 ไม่มี BOM แล้วตัวอักษรเพี้ยน (ปัญหาที่รู้
   กันทั่วไปของ Excel ไม่ใช่บั๊กเฉพาะระบบนี้)
3. **สี Recharts อ่านจาก CSS custom property ของ `packages/ui/src/tokens.css` ตรง ๆ** (`var(--celadon)`,
   `var(--indigo)` ฯลฯ) ไม่ hardcode hex เลยแม้แต่ค่าเดียว — สลับ light/dark ได้เองโดยไม่ต้องเขียน JS ตรวจธีม
   เพิ่ม เพราะ SVG `stroke`/`fill` ที่รับ `var(...)` ตรง ๆ จะ resolve ค่าปัจจุบันของตัวแปรเสมอ
4. **เพิ่ม `recharts` เป็น dependency ใหม่** — ตามที่ docs/PLAN.md T7.4 ระบุชื่อ library ตรง ๆ อนุมัติไปแล้ว
   ตั้งแต่ก่อนเริ่ม milestone

เหตุผล: การ sync URL สองทางเป็น pattern ใหม่ที่ยังไม่มีในระบบ บันทึกไว้ชัดเจนเพื่อให้ Task ในอนาคตที่ต้องการ
ตัวกรองแบบเดียวกัน (เช่นหน้ารายงานอื่น ๆ ที่อาจเพิ่มทีหลัง) มาอ้างอิงแพทเทิร์นนี้แทนที่จะคิดใหม่หรือใช้ local
state ล้วนเหมือนหน้าสมาชิกเดิม

ทดสอบจริง: seed ข้อมูลบิลจำลอง 10 วันชั่วคราว + รัน backfill script เพื่อยืนยันว่ากราฟ/ตารางแสดงผลถูกต้องกับ
ข้อมูลจริง (ไม่ใช่แค่ empty state) ก่อนลบข้อมูลทดสอบทิ้งจาก dev DB

---

## ADR-040: เพิ่มช่องทางชำระ TRANSFER (โอน/พร้อมเพย์) — ไม่นับเป็นเงินสดในลิ้นชัก, งวดจ่าย/schema ที่ copy enum ไว้เองต้องแก้คู่กัน

วันที่: 2026-08-27
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md (M7 ปิดแล้ว) — งานเสริมที่เจ้าของร้านยืนยันเพิ่มทีหลังหลังพบช่องว่างจริง
ตอนวิเคราะห์ระบบที่ส่งมอบแล้ว (ร้านสปาไทยรับโอน/พร้อมเพย์เป็นปกติ แต่ enum `PaymentMethod` เดิมมีแค่
CASH/PACKAGE/VOUCHER/COMPLIMENTARY ไม่มีทางบันทึกได้เลย)

บริบท: เจ้าของร้านยืนยันให้เพิ่ม `TRANSFER` เป็นแค่ tag ช่องทางชำระธรรมดา **ไม่มีเลขอ้างอิง/รูปสลิป** (ปฏิเสธ
ไปแล้วชัดเจน — เก็บง่ายเหมือน CASH) และย้ำว่าเงินโอนไม่ใช่เงินสดจริงในลิ้นชัก ห้ามปนกับ
`CashierShift.systemCashSatang`/`countedCashSatang` (ตามนิยาม "เงินในลิ้นชัก" ของ ADR-031) ต้องแยกเป็นช่องทาง
ที่ติดตามได้เองในรายงานเท่านั้น

ตัดสินใจ:
1. **เพิ่ม `TRANSFER` เข้า `PaymentMethod` enum ตรง ๆ** (schema.prisma + packages/contracts/src/payment.ts) —
   ปฏิบัติเหมือน CASH ทุกจุดยกเว้นไม่เข้า cashier-shift reconciliation และไม่มี `tenderedSatang` (ช่องนั้น
   มีความหมายเฉพาะ CASH เท่านั้นตาม comment เดิมบน `BillPayment.tenderedSatang`)
2. **`CashierShiftController.close()` ไม่แตะเลย** — ยังกรอง `method: "CASH"` เท่านั้นเหมือนเดิม 100% ตามที่
   ระบุไว้ชัดเจนในโจทย์ ป้องกันไม่ให้เงินโอนไปปนกับการนับเงินสดจริง
3. **`DailySummary` เพิ่มคอลัมน์ `paymentTransferSatang` แยกต่างหาก** (ตามแพทเทิร์นเดิมของ
   paymentCashSatang/paymentPackageSatang/paymentVoucherSatang/paymentComplimentarySatang) — **ไม่รวมเข้า
   `cashInSatang`** (นิยามเดิม = paymentCashSatang + cashInPackageSatang เป็น proxy "เงินสดในลิ้นชัก + ซื้อคอร์ส
   ใหม่" เท่านั้น) เงินโอนเป็นคนละช่องทางกับเงินสด ไม่ควรปนกันในตัวเลขนั้น
4. **ต้องแก้ 2 จุดที่ไม่ได้อยู่ในสโคปเดิมของโจทย์ แต่จำเป็นเพื่อให้ typecheck ผ่าน** เพราะเป็นจุดที่ enum
   `PaymentMethod` ถูก copy/ประกาศซ้ำเองแยกต่างหาก (ไม่ได้ import จาก packages/contracts):
   - `packages/core/src/promotion/types.ts` — `LinePaymentMethod` ประกาศ union เองตาม ADR-019 (core ห้ามมี
     dependency ใด ๆ แม้แต่ @lotus-desk/contracts) เดิมมีแค่ 4 ค่า ไม่มี TRANSFER เพิ่ม `"TRANSFER"` เข้าไป
     ให้ตรงกัน — `isPromotable()` กันแค่ PACKAGE เท่านั้น จึงไม่ต้องเพิ่ม branch logic ใหม่ (TRANSFER ใช้โปรฯ
     ได้เหมือน CASH/VOUCHER/COMPLIMENTARY ทุกกรณี)
   - `apps/api/src/modules/booking/appointment-item.controller.ts` — `completeServiceJob()` มี parameter
     type เป็น union ตัวอักษรเขียนมือ (`"CASH" | "PACKAGE" | "VOUCHER" | "COMPLIMENTARY"`) ไม่ได้อ้างจาก
     type กลางที่ไหน เพิ่ม `"TRANSFER"` เข้า union นี้ตรง ๆ
5. **กราฟสัดส่วนช่องทางชำระ (T7.4, `payment-breakdown-section.tsx`) สลับสีแทนที่จะเติมสีใหม่** — docs/DESIGN.md
   §3 มีสีตั้งชื่อไว้แค่ 4 สี (celadon/indigo/brass/rose) ไม่มีสีที่ 5 ให้ใช้ ย้าย COMPLIMENTARY (รายการที่ไม่ใช่
   รายได้จริง ความสำคัญน้อยสุดในกราฟนี้) ไปใช้สีกลาง `--ink-faint` แทน แล้วให้ TRANSFER (รายได้จริง) ได้ใช้
   `--rose` ที่ COMPLIMENTARY เคยครอง — ไม่มีการเติม hex ใหม่เข้า tokens.css เลย

เหตุผล: ข้อ 4 คือความเสี่ยงที่พบจริงตอนรัน `pnpm --filter @lotus-desk/api typecheck` (ไม่ได้ระบุไว้ในโจทย์ตั้งต้น)
— enum ที่ใช้ร่วมกันข้าม package แต่บาง package ห้าม import ข้ามเขต (ADR-019) จะมีจุด "ประกาศซ้ำเอง" กระจายอยู่
ต้องไล่หาให้ครบทุกจุดเวลาต่อ enum value ใหม่ ไม่ใช่แก้แค่ที่ schema.prisma/contracts แล้วจบ บันทึกไว้กันงานใน
อนาคตที่จะต่อ enum นี้อีก (เช่นถ้าจะเพิ่มช่องทางชำระอื่นอีก) ให้รู้ต้อง grep หา literal union ประเภทนี้ด้วย ไม่ใช่
แค่ไล่ตาม type ที่ TS ชี้ error ให้เท่านั้น (สองจุดนี้ TS ชี้ error ให้จริง แต่ต้องเข้าใจก่อนว่าทำไมถึงต้องแก้
ไม่ใช่แค่ widen type มั่ว ๆ ให้ compile ผ่าน)

ผลกระทบ: ถ้าจะเพิ่มช่องทางชำระใหม่อีกในอนาคต ต้องแก้ครบ 3 จุดเสมอ: (1) `PaymentMethod` enum ใน
schema.prisma + migration, (2) `PAYMENT_METHODS`/`PAYMENT_METHOD_LABEL` ใน packages/contracts,
(3) `LinePaymentMethod` ใน packages/core/src/promotion/types.ts — และไล่ grep หา literal union เขียนมืออื่น ๆ
ที่อาจหลงเหลืออยู่ (เจอ 1 จุดใน appointment-item.controller.ts รอบนี้ ไม่รับประกันว่าไม่มีจุดอื่นอีกที่ยังไม่ถูก
เรียกใช้จนกว่า TS จะชี้ error ให้เห็น) — `apps/web/src/app/(app)/reports/csv-export.ts` (T7.4) เพิ่มคอลัมน์
`paymentTransferSatang` เข้า CSV export เรียบร้อยแล้ว (เพิ่มโดยหัวหน้าทีมหลังตรวจงาน — จุดเล็กพอที่จะแก้ตรง ๆ
ไม่ต้องแยก Task ใหม่)

---

## ADR-041: ผ่อนสิทธิ์ยกเลิกบิลให้ cashier ทำเองได้ในเงื่อนไขจำกัด — บิลใหม่ + ยังไม่ตัดคอร์ส, ผู้จัดการยัง override ได้เสมอ, มาตรการอื่นไม่แตะ

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md — งานเสริมที่เจ้าของร้านสั่งเพิ่มหลังวิเคราะห์ระบบที่ส่งมอบแล้ว
(คำถามเดียวกับ ADR-040: ทำหลัง M7 ปิดแล้ว)

บริบท: การวิเคราะห์ระบบสำหรับร้าน 4-8 คนพบว่าการยกเลิกบิล (T5.6) บังคับ PIN ผู้จัดการเสมอทุกกรณี (docs/DOMAIN.md
ข้อ 14) — ร้านเล็กจริงมักไม่มีตำแหน่ง "ผู้จัดการ" แยกจากเจ้าของ เจ้าของแวะมาเป็นบางช่วง ถ้าเกิดพิมพ์ผิด/กดผิด
ตอนออกบิลแล้วต้องรอเจ้าของมาที่ร้านเพื่อกรอก PIN แก้ไขเรื่องเล็กน้อย เป็นคอขวดจริงในการทำงานประจำวัน — เจ้าของ
ร้านยืนยันให้ผ่อนเฉพาะ "ยกเลิกบิล" เท่านั้น (แนะนำเงื่อนไข: ภายใน 10 นาทีหลังออกบิล และยังไม่ตัดคอร์ส)

ตัดสินใจ:
1. **cashier ยกเลิกบิลเองได้โดยไม่ต้องมี PIN ผู้จัดการ ก็ต่อเมื่อเข้าเงื่อนไขทั้งสองข้อพร้อมกัน**: (ก)
   `bill.createdAt` ห่างจากตอนขอยกเลิกไม่เกิน 10 นาที (ข) ไม่มีรายการใดในบิลที่ตัดคอร์สสมาชิก (ไม่มี
   `BillLine.memberPackageLedgerEntryId`) — สองเงื่อนไขนี้ประกันว่าเป็นการแก้ไขความผิดพลาดสด ๆ เท่านั้น ไม่ใช่
   การย้อนแก้ประวัติเก่าหรือรายการที่กระทบยอดคงเหลือคอร์สของลูกค้า
2. **ผู้จัดการยัง override ได้เสมอไม่ว่าจะเข้าเงื่อนไขข้อ 1 หรือไม่** — ถ้ามี `approvalToken` ส่งมา ระบบ
   ตรวจสอบผ่านกลไกเดิม (`verifyManagerApprovalToken`) เหมือนเดิมทุกประการ ไม่เปลี่ยนพฤติกรรมเส้นทางนี้เลย —
   cashier ที่ไม่เข้าเงื่อนไขยกเลิกเองยังขอ PIN ผู้จัดการได้ตามปกติเสมอ ไม่มีทางตันที่ทำอะไรไม่ได้เลย
3. **มาตรการอนุมัติผู้จัดการอื่นทั้งหมดไม่แตะเลย** — เปิดรอบกะใหม่ (T5.7), เปิดงวดจ่ายใหม่ (T6.4), คืน/แช่แข็ง/
   หมดอายุคอร์ส (T5.2) ยังบังคับ PIN ผู้จัดการเหมือนเดิมทุกกรณี — ขอบเขตของการผ่อนจำกัดไว้แค่ "ยกเลิกบิล" ตาม
   ที่เจ้าของร้านอนุมัติเท่านั้น ไม่ขยายไปที่อื่นเอง
4. **ร่องรอยตรวจสอบยังครบ** — `Bill.cancelledByUserId` บันทึกผู้ยกเลิกจริงเสมอ (ไม่ว่าจะเป็น cashier ที่ยกเลิก
   เองหรือผู้จัดการที่อนุมัติ) `@AuditEntity("Bill")` ยังทำงานทุกเส้นทางเหมือนเดิม — เปิดดู audit log แล้วรู้ได้
   ทันทีว่ารายการไหนยกเลิกเอง รายการไหนต้องผ่านผู้จัดการ

เหตุผล: แก้คอขวดจริงของร้านขนาดเล็กโดยไม่ลดความเข้มงวดของจุดที่กระทบเงิน/ยอดคงเหลือคอร์สจริง (ทั้งสองเงื่อนไข
คัดกรองเฉพาะกรณี "แก้ไขสด ไม่มีอะไรกระทบไปแล้ว" ออกมาให้ทำเองได้) — เจตนาของ docs/DOMAIN.md ข้อ 14/16
(ป้องกันการยกเลิกบิลตามอำเภอใจ) ยังคงอยู่สำหรับกรณีที่มีความเสี่ยงจริง (บิลเก่า/ตัดคอร์สแล้ว)

ผลกระทบ: **แก้ไข 2026-08-28** — ตรวจสอบแล้วพบว่าอ้างอิง "docs/DOMAIN.md ข้อ 14/16" ในย่อหน้าเดิมของ ADR นี้
ไม่ถูกต้อง: ข้อ 14 เป็นเรื่องส่วนลด (ไม่เกี่ยวกับการยกเลิกบิล) ข้อ 16 เป็นเรื่อง "ยกเลิกบิลหลังปิดรอบกะแล้ว"
(คนละสถานการณ์ ยังคงพฤติกรรมเดิมไม่เปลี่ยน — ต้องเปิดรอบกะใหม่ก่อนเสมอ) ไม่มี Q&A ข้อไหนใน DOMAIN.md ที่ระบุ
ตรง ๆ ว่า "ยกเลิกบิลทั่วไปต้องมี PIN ผู้จัดการเสมอ" — ค่านั้นมาจาก `docs/decisions.md` ADR-030 (T5.6) และ
doc-comment บน `BillController.cancel()` เอง ซึ่งได้อัปเดตให้ตรงกับนโยบายผ่อนนี้แล้วในรอบเดียวกับที่แก้โค้ด
(ดู comment บนเมธอดนั้นตรง ๆ) — ไม่มีเอกสารไหนค้างไม่ตรงจริงจากงานนี้อีกแล้ว

---

## หมายเหตุแก้ไข ADR-040: เทสต์ walk-in ที่ค้างใกล้เที่ยงคืน ไม่ได้ถูกบันทึกไว้จริงในนั้น

ตอน commit ของ ADR-040 (เพิ่ม TRANSFER) และ ADR-041 (ผ่อน PIN ยกเลิกบิล) มีการอ้างถึง "บั๊ก flaky ใกล้เที่ยงคืน
ของ `appointment-item-walkin.e2e-spec.ts`" ว่า "บันทึกไว้แล้วใน ADR-040" ซึ่งไม่ถูกต้อง — ADR-040 พูดถึงแค่
TRANSFER เท่านั้น ไม่มีเนื้อหาเรื่องนี้จริง ขอบันทึกแยกไว้ที่นี่ให้ถูกต้อง: `appointment-item-walkin.e2e-spec.ts`
มี 1-2 เทสต์ (เกี่ยวกับ walk-in auto-assign จากคิวหมุน) ที่ fail เป็นระยะเมื่อรันในช่วง ~15 นาทีก่อน/หลังเที่ยงคืน
เวลาไทยพอดี (ยืนยันแล้วสองครั้งในเซสชันนี้ด้วย `git stash` + สังเกตเวลาจริง — รันตอน 23:53 และ 23:59 fail ทั้งคู่
รันตอน 00:02 ผ่านหมด) สาเหตุน่าจะเป็นขอบเขตวันปฏิทินในการหา availability/กะที่ครอบคลุม "วันนี้" ของ T4.6 —
ไม่เกี่ยวข้องกับงานใดในเซสชันนี้เลย (M6, M7, TRANSFER, self-cancel) ยังไม่ได้แก้ไข เป็น pre-existing bug ที่ควร
เป็น Task แยกต่างหากถ้าจะแก้ (ต้องดูโค้ด availability engine ของ T4.1/T4.6 จริง ๆ)

---

## ADR-042: หน้ารายละเอียดสมาชิก `/members/[memberId]` — route แรกที่เป็น dynamic segment, ปิด workaround ของ ADR-038

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md — งานเสริมที่เจ้าของร้านสั่งเพิ่มหลังพบช่องว่างจริงจาก workaround ของ
ADR-038 (T7.3 แดชบอร์ด ลิงก์ "คอร์สใกล้หมดอายุ"/"ลูกค้าที่หายไปเกิน 60 วัน" ต้องพาไปที่ `/members?q=<รหัส>`
เพราะตอนนั้นยังไม่มีเส้นทางลึกของสมาชิกรายคน)

ตัดสินใจ:
1. **เพิ่ม `apps/web/src/app/(app)/members/[memberId]/page.tsx` + `member-detail-page-client.tsx`** — dynamic
   segment แรกของระบบนี้ ไม่มีแพทเทิร์นเดิมในโค้ดฐานให้อ้างอิง จึงยึดตามคอนเวนชันมาตรฐานของ Next.js 15 App
   Router ตรง ๆ (`params: Promise<{ memberId: string }>` แล้ว `await params`)
2. **ไม่ต้องเพิ่ม backend endpoint ใหม่** — `GET /branches/:branchId/members/:memberId` (`MemberController.getOne`)
   และ `memberApi.get(branchId, memberId)` ฝั่งเว็บมีอยู่แล้วก่อนงานนี้ (ตรวจสอบโค้ดจริงแล้ว ไม่ใช่แค่เดา) จึงใช้
   ของเดิมได้ตรง ๆ ไม่ต้องแตะ `member.controller.ts`/`api-client.ts` ฝั่ง endpoint นี้เลย
3. **หน้ารายละเอียดใช้ `MemberConsentSection`/`MemberPackageSection` เดิมตรง ๆ** (props เดียวกับที่ชีทแก้ไข
   ในหน้ารายชื่อส่งให้อยู่แล้ว) ไม่แตะ internals — ส่วนแก้ไขข้อมูลหลัก (ชื่อ/เบอร์/บันทึก) ใช้ `MemberForm`
   เดิมในชีทเปิดจากปุ่ม "แก้ไขข้อมูล" เหมือนหน้ารายชื่อทุกประการ **ไม่รวม `MemberMergeSection`** ในหน้านี้
   (ไม่ได้อยู่ในขอบเขตที่ระบุ — คงไว้เฉพาะในชีทแก้ไขของหน้ารายชื่อเหมือนเดิม) และไม่เพิ่มปุ่มเปิด/ปิดใช้งาน
   สมาชิกในหน้านี้ (มีอยู่แล้วในหน้ารายชื่อ ไม่ได้อยู่ในขอบเขตที่ระบุเช่นกัน กันงานบวมเกินโจทย์)
4. **เพิ่มส่วน "ประวัติการซื้อ"** ดึงจาก `billApi.list(branchId, memberId)` (`GET /branches/:branchId/bills?memberId=`
   ที่มีอยู่แล้ว) แสดงตารางอ่านอย่างเดียว (เลขที่บิล/วันที่/ยอดสุทธิ/สถานะ) — ไม่ลิงก์ลึกไปหน้ารายละเอียดบิล
   เพราะ `/billing` ยังไม่มีเส้นทางลึกของบิลเดี่ยว (นอกขอบเขตงานนี้)
5. **แก้ลิงก์ workaround ของ ADR-038 ให้ตรงจริง**: `dashboard/expiring-courses-section.tsx` เปลี่ยนจาก
   `memberLink(pkg.member.code)` (`/members?q=`) เป็น `/members/${pkg.memberId}` ตรง ๆ — ใช้ `memberId` ที่เป็น
   ฟิลด์ของ `MemberPackage` เอง (FK ตรง ไม่ต้องพึ่ง `pkg.member.id` ซึ่ง `MEMBER_PACKAGE_INCLUDE` ฝั่ง API
   ไม่ได้ select มาให้ — ตรวจสอบแล้วว่า `member: { select: { name: true, code: true } }` ไม่มี `id`)
   ส่วน `dashboard/dormant-customers-section.tsx` ใช้ `row.member.id` ตรง ๆ ได้เลย เพราะ
   `ReportsController.dormantCustomers` select `id` ให้ในอ็อบเจกต์ `member` อยู่แล้ว ลบฟังก์ชัน `memberLink`
   และ comment "ยังไม่มีเส้นทางลึก" ออกจากทั้งสองไฟล์ (ไม่จริงอีกต่อไป)
6. **หน้ารายชื่อสมาชิก (`member-page-client.tsx`) เพิ่มคอลัมน์ "โปรไฟล์" ลิงก์ `/members/${member.id}`**
   แบบเสริมเท่านั้น — ไม่แตะ/ไม่ลบ flow ชีทแก้ไขแบบเดิมที่ทดสอบแล้วเลย

เหตุผล: ปิดช่องว่างที่ ADR-038 บันทึกไว้ตั้งแต่ T7.3 ให้ URL พาผู้ใช้ไปหน้าสมาชิกที่ถูกต้องจริงโดยตรง (ไม่ใช่แค่
เติมช่องค้นหาให้) และเป็นก้าวแรกที่ระบบมี dynamic route จริง — เก็บ diff ให้เล็กที่สุดเท่าที่จำเป็น (ไม่เพิ่ม
endpoint ที่ไม่จำเป็น ไม่เพิ่มฟีเจอร์เกินขอบเขตที่ระบุ) ตามกฎเหล็กข้อ "ทำเฉพาะ Task ที่ได้รับมอบหมาย"

ผลกระทบ: ถ้าจะเพิ่มเส้นทางลึกของบิลเดี่ยว (`/billing/[billId]`) ในอนาคต ตาราง "ประวัติการซื้อ" ในหน้านี้เป็นจุด
ที่ควรกลับมาเพิ่มลิงก์ต่อแถวด้วย — ยังไม่ทำตอนนี้เพราะนอกขอบเขต

---

## ADR-043: หน้าเว็บค่ามือ `/payroll` + สลิปพิมพ์ได้ + สลับ export จาก CSV เป็น `.xlsx` จริงด้วย exceljs — ปิดงานค้างที่ ADR-035 บันทึกไว้

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: T6.4 (เดิม backend เสร็จแล้ว ตาม ADR-035 — งานนี้ปิดส่วนที่เหลือค้าง: หน้าเว็บ + สลิป +
export Excel จริง ตามที่ PLAN.md ระบุไว้แต่แรกว่า T6.4 ต้องมี "export Excel + สลิปรายบุคคล PDF")

บริบท: ADR-035 (T6.4 รอบแรก) จงใจทำ "export Excel" เป็น CSV endpoint (`summary.csv`) เพราะตอนนั้น CLAUDE.md
ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม และไม่มีหน้าเว็บเลย — บันทึกไว้ชัดเจนว่าเป็นงานค้าง เจ้าของร้านอนุมัติเพิ่ม
`exceljs` แล้วในรอบนี้ (ระบุชื่อ library ตรง ๆ ในคำสั่งงาน เหมือนที่ `recharts` เคยได้รับอนุมัติมาก่อนใน ADR-039)

ตัดสินใจ:
1. **แทนที่ `GET .../summary.csv` ด้วย `GET .../summary.xlsx`** (`payroll.controller.ts`) ไม่ใช่เพิ่มเสริมคู่กัน
   — ของเดิมไม่มี consumer ฝั่งเว็บอยู่แล้ว (หน้าเว็บเพิ่งสร้างในรอบนี้) จึงลบ route เดิมทิ้งได้ปลอดภัย ใช้
   `ExcelJS.Workbook` เขียน 1 sheet ชื่อ "สรุปค่ามือ" คอลัมน์เงินแปลงสตางค์→บาทเป็นตัวเลขจริง (ไม่ใช่สตริง)
   เพื่อให้ Excel sum ได้ตรง ๆ — เพิ่ม `exceljs` เป็น dependency ของ `apps/api` เท่านั้นตามที่ระบุ (ยังไม่แตะ
   `apps/web` เลย, `/reports` CSV export ของ ADR-039 ไม่ถูกแตะเช่นกัน)
2. **ส่งไฟล์กลับด้วย `@Res()` แบบไม่ passthrough + `res.send(Buffer.from(buffer))` ตรง ๆ** — ทดสอบแล้วว่า
   `@Res({ passthrough: true })` + `return` ค่า Buffer ทำให้ Nest พยายาม JSON serialize body ให้ ซึ่งทำลาย
   ไฟล์ .xlsx (เป็น zip binary ล้วน ไม่ใช่ string/JSON) ยืนยันด้วย e2e test ที่เช็ค magic number `PK`
   (`0x50 0x4B`) 2 byte แรกของ response body ตรง ๆ และด้วยการดาวน์โหลดจริงผ่านเบราว์เซอร์ (ดูข้อ 6)
3. **หน้าเว็บ `apps/web/src/app/(app)/payroll/`** (`page.tsx` + `payroll-page-client.tsx`) โครงเดียวกับ
   `CashierShiftPanel` (T5.7): การ์ดงวดปัจจุบัน (เปิด/ปิด) + ประวัติงวดที่ปิดแล้ว (`ดูสรุป`/`ดาวน์โหลด Excel`/
   `เปิดงวดนี้ใหม่`) ปุ่มจัดการทั้งหมดกันด้วย `payroll:manage` (ใช้ `hasPermission` เดิม) ประวัติงวดกรองเฉพาะ
   `closedAt !== null` (งวดที่เปิดอยู่แสดงในการ์ดด้านบนอยู่แล้ว ไม่ซ้ำ) — ใช้ `ManagerPinDialog` เดิมจาก
   `billing/manager-pin-dialog.tsx` ตรง ๆ สำหรับ flow "เปิดงวดนี้ใหม่" (import ไม่ fork โค้ด) เหมือนที่โจทย์
   กำหนด — งวดใดก็เปิดใหม่ได้ (ไม่ได้จำกัดแค่งวดล่าสุด เพราะ backend เองก็ไม่ได้จำกัดไว้)
4. **ดาวน์โหลด `.xlsx` ด้วย `<a href>` ธรรมดา ไม่ใช้ fetch+blob** — ตรวจสอบ `apiFetch` (`api-client.ts`) แล้วพบ
   ว่าใช้ `credentials: "include"` ผ่าน rewrite `/api/:path*` ของ `next.config.ts` (proxy ฝั่ง server ของ
   Next.js เอง ไม่ใช่ client redirect) ทำให้เบราว์เซอร์เห็น request เป็น same-origin เสมอ cookie
   `access_token`/`refresh_token` เป็น `httpOnly` + `sameSite: "lax"` ซึ่ง sameSite=lax อนุญาต cookie ติดไปกับ
   top-level navigation แบบ GET อยู่แล้ว (และเป็น same-origin จริงด้วย จึงไม่มีข้อจำกัดจาก sameSite เลยด้วยซ้ำ)
   ประกอบกับ endpoint ส่ง `Content-Disposition: attachment` ทำให้เบราว์เซอร์ดาวน์โหลดไฟล์แทนการ navigate ออก
   จากหน้า — ทดสอบจริงด้วย `fetch(url, {credentials:"include"})` ในคอนโซลเบราว์เซอร์ (หลัง login จริงผ่าน UI)
   ได้ status 200, content-type/content-disposition ถูกต้อง, byte แรกเป็น `50 4b 03 04` (PK.. ของ zip/xlsx จริง)
   จึงเลือกทางนี้เพราะง่ายกว่า fetch+blob ของ `downloadCsv` (`reports/csv-export.ts`) มาก โดยไม่เสีย auth เลย
5. **สลิปพิมพ์ได้ `apps/web/src/app/(app)/payroll/payslip.tsx`** — ใช้เทคนิคเดียวกับ `receipt.tsx` ทุกประการ
   (`body * { visibility: hidden }` แล้วเปิดเฉพาะ id เดียวตอน `@media print`) ต่างจากใบเสร็จตรงที่ไม่มีตัวเลือก
   58/80mm (เป็นเอกสารทั่วไป ไม่ใช่กระดาษความร้อน) **นี่คือการตีความ "PDF" ของ PLAN.md เป็นแบบ print-to-PDF ของ
   เบราว์เซอร์เอง ไม่ใช่สร้างไฟล์ .pdf จริงด้วย library** — สอดคล้องกับ ADR-024 ที่วางบรรทัดฐานไว้แล้วว่าเอกสาร
   พิมพ์ได้ทั้งหมดในระบบนี้ (ใบเสร็จ/ใบคิว) ใช้ `window.print()` + CSS ล้วน ไม่มี PDF library เลยสักตัว ห่อสลิป
   ด้วย `Sheet` (แผงเลื่อนจากขวา) แทนการ render inline ตรง ๆ แบบ `receipt.tsx` — เลือกแบบนี้เพราะ `Sheet` มี
   focus trap/Escape ปิด/คืน focus ให้ฟรีอยู่แล้ว ไม่ต้องเขียนเอง และปุ่ม "พิมพ์สลิป" อยู่ในหน้าหลัก ไม่ได้อยู่ใน
   `ManagerPinDialog` จึงไม่ผิดกฎ "ห้าม modal ซ้อน modal" ของ docs/DESIGN.md §3.5 — mount/unmount แบบ
   conditional ทั้งก้อน (`{payslipTarget && <Payslip .../>}`) เหมือนที่ `billing-page-client.tsx` ทำกับ
   `Receipt` ตรง ๆ (ไม่ใช่ toggle prop `open` ค้างไว้แบบ `ManagerPinDialog` เพราะ props ที่ต้องส่ง — งวด/สรุป
   รายพนักงาน — เปลี่ยนไปตามแถวที่กด ไม่มี "ค่าว่าง" ที่สมเหตุสมผลจะ default ไว้ก่อนเลือก)
6. **ทดสอบมือเต็มรูปแบบผ่านเบราว์เซอร์จริง** (ไม่ใช่แค่ typecheck/build ผ่าน): login เป็น `owner@lotusdesk.local`,
   เปิดงวด → ปิดงวด (งวดว่าง เช็ค empty state ของตาราง "งวดนี้ไม่มีรายการค่ามือ/ทิปเลย") → สร้างข้อมูลทดสอบจริง
   ผ่าน API ตรง ๆ (walk-in + จบงาน + ออกบิล ตามแพทเทิร์นเดียวกับ `payroll.e2e-spec.ts`) → เปิด/ปิดงวดใหม่รอบสอง
   เห็นแถวพนักงานจริง (นก, มาสเตอร์, 1 ใบงาน, ฿210) → กด "พิมพ์สลิป" เห็นเนื้อหาสลิปถูกต้องครบทุกฟิลด์ → กด
   Escape ปิดสลิปได้ (คีย์บอร์ด) → ดาวน์โหลด `.xlsx` ยืนยัน byte จริงตามข้อ 4 — เจอบั๊กเครื่องมือทดสอบเอง (ไม่ใช่
   บั๊กของโค้ด) ระหว่างทาง: access token หมดอายุกลางเซสชันเบราว์เซอร์ทดสอบ ต้อง login ใหม่ และปุ่ม "เปิดงวดใหม่"
   บาง ต้องคลิกซ้ำ/รอ re-render — ไม่เกี่ยวกับโค้ดของงานนี้

เหตุผล: ปิดงานค้างที่ ADR-035 ระบุไว้ชัดเจนว่าต้องทำต่อ ("ต้องทำหน้าเว็บสรุปงวดจ่าย + ปุ่มพิมพ์สลิปรายบุคคล...
เป็นงานที่เหลือค้างอยู่") ให้ตรงกับที่ PLAN.md T6.4 ระบุไว้แต่แรก (export Excel จริง + สลิป) โดยไม่แตะ business
logic เดิมของ backend เลย (เปลี่ยนแค่ endpoint ส่งออกไฟล์ endpoint เดียว) และ reuse component/แพทเทิร์นเดิมของ
ระบบทุกจุดที่ทำได้ (`ManagerPinDialog`, `Sheet`, เทคนิค print ของ `receipt.tsx`, โครง `CashierShiftPanel`)
ตามกฎเหล็กเรื่องความสอดคล้องของโค้ดฐาน

ผลกระทบ: ADR-035 ข้อ 4-5 (CSV แทน xlsx, ไม่มีหน้าเว็บ) ถือเป็นโมฆะแล้วหลังงานนี้ — ถ้าอ่านย้อนหลังให้ยึดตาม
ADR นี้แทน `/reports` ยังคง export เป็น CSV มือเขียน (ADR-039) ต่อไปตามที่ระบุว่าเป็นงานแยกนอกขอบเขตรอบนี้

---

## ADR-044: หน้ารายงาน (T7.4) สลับ export จาก CSV เป็น `.xlsx` จริงฝั่งเบราว์เซอร์ล้วน ๆ — ปิดงานค้างสุดท้ายจากรายการช่องว่างเล็กๆ 9 ข้อ

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md — ต่อเนื่องจาก ADR-043 (payroll xlsx) ตามที่เจ้าของร้านอนุมัติเพิ่ม
`exceljs` ครอบคลุมทั้ง T6.4 และ T7.4

ตัดสินใจ: สร้างไฟล์ `.xlsx` ในเบราว์เซอร์ล้วน ๆ ไม่ยิง request ไปเซิร์ฟเวอร์เพิ่ม (ข้อมูลถูก fetch ไว้แล้วฝั่ง
client สำหรับวาดกราฟอยู่แล้ว) คอลัมน์/รูปแบบเดียวกับ `payroll.controller.ts` (ฝั่ง apps/api): เงินเป็นตัวเลข
บาทจริงไม่ใช่สตริง ให้ Excel sum/สร้างกราฟต่อได้ — ยืนยันแล้วว่า `import ExcelJS from "exceljs"` เฉยๆ (ไม่ต้อง
ชี้ path ไปที่ browser build ตรงๆ) ก็ resolve ถูก build ผ่าน Next.js webpack เองผ่าน `package.json#browser`
field ของ exceljs อยู่แล้ว — ทดลองเทียบกับการ import path ตรงแล้วพบว่า bundle ขนาดเท่ากันเป๊ะ แต่เสีย type
declaration ไป (ต้องใช้ `any`/เขียน `.d.ts` เอง ซึ่งขัด CLAUDE.md) จึงเลือก import แบบธรรมดา

ผลกระทบที่ทราบแล้ว ยอมรับได้: หน้า `/reports` มีขนาด bundle โตขึ้นมาก (~377 kB self, ~527 kB First Load JS)
เพราะ `exceljs`'s browser build มีขนาดใหญ่โดยธรรมชาติ (~948 KB ก่อน minify) — จำกัดผลกระทบไว้แค่ route นี้
เท่านั้น (Next.js code-split ตาม route อัตโนมัติ) หน้าอื่นในระบบไม่โตขึ้นเลย ยอมรับได้เพราะเป็นเครื่องมือภายใน
ให้เจ้าของ/ผู้จัดการเปิดดูรายงานเป็นครั้งคราว ไม่ใช่หน้าที่พนักงานทุกคนเปิดบ่อย — **ข้อควรพิจารณาในอนาคตถ้า
อยากลดผลกระทบ**: lazy-load `exceljs` ด้วย dynamic `import("exceljs")` เฉพาะตอนกดปุ่ม export แทนที่จะ bundle
เข้า initial route chunk เลย (ยังไม่ได้ทำรอบนี้เพราะไม่มีปัญหา ใช้งานจริงที่ต้องแก้)

**สรุปสถานะรายการช่องว่างเล็กๆ 9 ข้อที่วิเคราะห์ไว้ (2026-08-28):** ทำครบ 7 ข้อที่ทำได้จริง (DOMAIN.md sync,
walk-in flaky fix, member detail route, TRANSFER payment method [ก่อนหน้ารายการนี้], payroll UI+xlsx, tips
policy confirm, reports xlsx) เหลือข้ามไป 2 ข้อตามการตัดสินใจของเจ้าของร้าน: ส่วนลดตามผู้อนุมัติ (ขัดกับ
นโยบายผ่อน PIN ที่เพิ่งทำ) และ deductionSatang (ยังไม่มี requirement จริงตาม docs/DOMAIN.md ข้อ 13)

---

## ADR-045: ลงเวลาเข้า-ออกงาน (T6.1) — PIN เป็นทางเลือกไม่ใช่บังคับ, แคชเชียร์/เจ้าของร้านลงเวลาแทนพนักงานได้เลย, สร้างหน้าเว็บ /attendance ที่หายไป

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md — เจ้าของร้านชี้แจงโมเดลการทำงานจริงของร้าน

บริบท: เจ้าของร้านชี้แจงชัดเจนว่าโมเดลการทำงานจริงของร้านคือ **พนักงานให้บริการไม่แตะระบบซอฟต์แวร์เลย**
ไม่ล็อกอิน ไม่กด PIN อะไรทั้งสิ้น — แคชเชียร์หรือเจ้าของร้านเป็นคนบันทึกการทำงานทั้งหมดแทน ระบบส่วนใหญ่ตรงกับ
โมเดลนี้อยู่แล้ว (จอง/เริ่ม-จบใบงาน/เช็คเอาต์ ล้วนดำเนินการโดยคนที่ล็อกอินเครื่องหน้าร้านอยู่แล้ว ไม่ใช่พนักงาน
ให้บริการเอง) — จุดเดียวที่ขัดกับโมเดลนี้คือ T6.1 (ลงเวลาเข้า-ออกงาน) ที่บังคับให้กรอก PIN 6 หลักของพนักงาน
คนนั้นเองเสมอ ทำให้ใช้งานจริงตามโมเดลนี้ไม่ได้เลย และระหว่างตรวจสอบพบว่า **ไม่มีหน้าเว็บสำหรับฟีเจอร์นี้เลย
แม้แต่หน้าเดียว** (ไม่มีใน nav-items.ts ด้วยซ้ำ) ทั้งที่ backend เขียนและเทสต์ผ่านหมดแล้วตั้งแต่ M6 — เป็น
ช่องว่างที่พลาดไปตอนสรุปรายการ "ช่องว่างเล็กๆ" ก่อนหน้านี้

ตัดสินใจ:
1. **PIN เป็น "ทางเลือก" (`optional`) ไม่ใช่ "บังคับ"** — ถ้าไม่ส่ง `pin` มาด้วย ระบบข้ามการตรวจ PIN ไปเลย
   ใช้แค่สิทธิ์ `attendance:manage` ของผู้ล็อกอินเครื่อง (แคชเชียร์/ผู้จัดการ/เจ้าของ) เป็นการยืนยันตัวตนที่
   เพียงพอ — ตรงกับหลักการเดียวกับทุกจุดอื่นในระบบที่ไม่เคยให้พนักงานให้บริการยืนยันตัวตนเองเลย
2. **ไม่ลบความสามารถ PIN เดิมทิ้ง** ตามคำสั่งเจ้าของร้าน ("ฟังก์ชันที่มีอยู่เก็บไว้ไม่ต้องลบทิ้ง") —
   `StaffProfile.pinHash`/lockout, `verifyStaffPin`, endpoint `POST /staff/:staffId/pin` ยังอยู่ครบและทำงาน
   ปกติถ้ามีใครส่ง `pin` มาจริง (เผื่ออนาคตร้านเปลี่ยนใจอยากเปิดโหมดพนักงานกรอกเองที่เครื่อง) แค่ไม่บังคับ
   อีกต่อไป
3. **สร้างหน้าเว็บ `/attendance` ใหม่ทั้งหมด** — ตารางพนักงานที่ใช้งานอยู่ทุกคน (ไม่ใช่แค่คนที่มีรายการลงเวลา
   วันนี้แล้ว) แต่ละแถวมีปุ่ม "ลงเวลาเข้า"/"ลงเวลาออก" ให้แคชเชียร์กดแทนพนักงาน **ไม่มีช่องกรอก PIN ในหน้านี้
   เลย** ตรงกับโมเดลการทำงานจริง — แสดงสถานะวันนี้ (ยังไม่มา/กำลังทำงาน/กลับแล้ว) และป้ายสาย/ตรงเวลา/OT เมื่อ
   มีข้อมูลกะเทียบ

เหตุผล: ปรับซอฟต์แวร์ให้ตรงกับวิธีทำงานจริงของร้าน ไม่ใช่บังคับร้านให้ปรับตัวเข้าหาซอฟต์แวร์ — เก็บ
ความสามารถเดิมไว้ครบตามคำสั่ง เผื่อความต้องการเปลี่ยนในอนาคตโดยไม่ต้องเขียนใหม่

ผลกระทบ: ตอนนี้ทุกฟีเจอร์ในระบบสอดคล้องกับโมเดล "แคชเชียร์/เจ้าของร้านบันทึกทุกอย่างแทนพนักงาน" แล้วครบถ้วน
100% ไม่มีจุดไหนที่ยังคาดหวังให้พนักงานให้บริการแตะซอฟต์แวร์เองอีก

---

## ADR-046: ย้ายจุดตัดสินใจ+ตรวจสิทธิ์แหล่งชำระของ ServiceJob จาก "ตอนจบงาน" มา "ตอนเริ่มงาน" — พลิกกลับ ADR-029 ข้อ 4 ตามความเป็นจริงหน้าร้าน, ไม่แตะจังหวะตัดยอดจริงที่ยังอยู่ที่ checkout เหมือนเดิม

วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md — เจ้าของร้านชี้แจงโมเดลการทำงานจริงของร้าน ทับคำตัดสินใจเดิมใน ADR-029

บริบท: ADR-029 (T5.5) ตัดสินใจไว้ว่า `paymentMethod` ของ `ServiceJob` ต้องระบุตอนเปลี่ยนสถานะเป็น `COMPLETED`
เท่านั้น ("ตัดสินใจตอนจบงาน ไม่ใช่ตอนเริ่มงาน") — รอบนี้เจ้าของร้านชี้แจงโมเดลการทำงานจริงของร้านตรงกันข้าม
ชัดเจน: ลูกค้าเลือกบริการ (หรือถือคอร์ส/แพ็กเกจอยู่แล้ว) แล้ว **จ่ายเงินหรือถูกตัดคอร์สก่อนเริ่มนวดเสมอ ไม่ใช่
หลังจบงาน** ("จ่ายหรือตัดก่อนรับบริการเสมอ") — ระบบเดิมทำให้เกิดเคสที่แย่ในทางปฏิบัติ: เริ่มนวดไปแล้ว จบงาน
แล้ว ค่อยมารู้ตอนเลือกแหล่งชำระ (หรือแย่กว่านั้นคือตอนออกบิลที่แคชเชียร์) ว่าคอร์สที่ลูกค้าจะใช้ยอดไม่พอ/หมด
อายุ/ใช้กับบริการนี้ไม่ได้ — ทำให้บริการที่ทำไปแล้วกลายเป็นปัญหาเก็บเงินย้อนหลัง

ทางเลือกที่คุยกัน 2 ทาง: (1) restructure ให้ Bill/ledger deduction เกิดที่ตอนเริ่มงานจริง ๆ (ตรงกับความจริง
ที่สุด แต่กระทบโครงสร้างเยอะ — Bill/BillLine ผูกกับใบงานที่ "จบแล้ว" มาตั้งแต่ T5.6 เปลี่ยนแนวคิดทั้งระบบบิล)
กับ (2) แค่ย้าย "จุดตัดสินใจ + ตรวจสิทธิ์ล่วงหน้า" มาไว้ตอนเริ่มงาน แต่ตัวธุรกรรมตัดยอดจริง (Bill/
MemberPackageLedgerEntry) ยังคงอยู่ที่ checkout เหมือนเดิม — เจ้าของร้านเลือกทางเบา (2) เพราะแก้ปัญหาจริงได้
ครบ (บล็อกก่อนเริ่มงานถ้ายอดไม่พอ ไม่ต้องรอไปเจอตอนออกบิล) โดยไม่ต้องรื้อโครงสร้างบิล/ledger ที่ทดสอบและใช้
งานจริงอยู่แล้ว

ตัดสินใจ:
1. **`paymentMethod`/`memberPackageId` ตัดสินใจตอนเปลี่ยนสถานะเป็น `IN_SERVICE` (เริ่มงาน) แทน `COMPLETED`
   (จบงาน)** — `updateAppointmentItemStatusSchema` (packages/contracts/src/booking.ts) ย้าย `.refine()` ที่
   บังคับ `paymentMethod` มาที่ `IN_SERVICE` และเพิ่ม `.refine()` ใหม่บังคับ `memberPackageId` เมื่อ
   `paymentMethod === "PACKAGE"` — `COMPLETED` ไม่ต้องการ/ไม่รับ `paymentMethod` อีกต่อไป (แค่ปิด
   `completedAt`)
2. **`ServiceJob` schema เพิ่ม `memberPackageId String?` (+ FK ไป `MemberPackage`) เป็นฟิลด์ additive ล้วน ๆ**
   (migration `servicejob_payment_decided_at_start`: เพิ่มคอลัมน์ nullable + index + FK เท่านั้น ไม่มี breaking
   change) — บันทึกว่า "จะตัดคอร์สใบไหน" ตั้งแต่ตอนเริ่มงาน ไม่ใช่แค่ตอน checkout อีกต่อไป
3. **`AppointmentItemController.startServiceJob()` ตรวจสิทธิ์แบบ read-only ก่อนสร้าง `ServiceJob` เมื่อ
   `paymentMethod === "PACKAGE"`** — ชุดตรวจเดียวกับที่ `BillController.checkout()` ใช้ตอนตัดยอดจริงเป๊ะ
   (ความเป็นเจ้าของคอร์ส/สมาชิกตรงกับที่จองนัด/ประเภทบริการตรงกัน/`validateUse()` จาก
   `packages/core/member-package-ledger` เช็คยอดคงเหลือ+วันหมดอายุ) แต่ **ไม่ล็อกแถว
   (`memberPackageService.lock`) และไม่สร้าง `memberPackageLedgerEntry` ตัดยอดจริงที่จุดนี้เด็ดขาด** — ถ้า
   ตรวจไม่ผ่าน throw `UnprocessableEntityException` ก่อนสร้างแถว `ServiceJob` เพื่อให้ทั้ง
   `$transaction` (รวม `appointmentItem.update` ที่ทำไปก่อนหน้าในทรานแซกชันเดียวกัน) rollback สะอาด ๆ —
   สถานะนัดจะไม่ขยับไป `IN_SERVICE` เลยถ้าเช็คไม่ผ่าน (ทดสอบแล้วจริงว่า rollback ทำงานถูกต้อง ไม่ใช่แค่สมมติ
   ตามพฤติกรรมปกติของ Prisma `$transaction` — ดู service-job-payment-at-start.e2e-spec.ts)
4. **`BillController.checkout()` ไม่รับ `memberPackageId` จาก client อีกต่อไป** — อ่านจาก
   `ServiceJob.memberPackageId` ที่ล็อกไว้ตั้งแต่ตอนเริ่มงานแทน (`checkoutServiceJobLineSchema` คง field
   `memberPackageId` ไว้เฉย ๆ เป็น optional ที่ handler ไม่อ่านแล้ว เพื่อไม่ต้อง breaking-change ฝั่ง client ที่
   อาจยังส่งมาอยู่ — ไม่ลบ field ออกจาก schema ทันที) มีเช็คป้องกันไว้เผื่อแถวเก่าก่อน migration นี้ที่
   `paymentMethod === PACKAGE` แต่ `memberPackageId` เป็น null (throw error แทน crash)
5. **ตัวธุรกรรมตัดยอดจริง (`Bill`/`BillLine`/`memberPackageLedgerEntry.create`/`memberPackageService.lock`)
   ไม่เปลี่ยนที่เกิดเลย — ยังอยู่ที่ `checkout()` เหมือนเดิมทุกประการ** ตรวจสิทธิ์ที่ทำตอนเริ่มงานเป็นแค่
   pre-check เพื่อกันปัญหาก่อนเริ่มบริการ ส่วน checkout ยัง re-validate + ล็อกแถว + ตัดยอดจริงอย่างเป็นอิสระ
   (defense-in-depth ตั้งใจ ไม่ใช่ความซ้ำซ้อนที่ไม่มีประโยชน์ — ยอดคงเหลืออาจเปลี่ยนไปจากตอนเริ่มงานถึงตอน
   checkout ได้จริง เช่นมีนัดอื่นของสมาชิกคนเดียวกันตัดคอร์สใบเดียวกันไปพร้อมกันระหว่างนั้น)

ผลกระทบ: หน้าเว็บ Lane Board (`appointment-detail-sheet.tsx`) ย้าย UI เลือกแหล่งชำระ+คอร์สมาที่ปุ่ม "เริ่มงาน"
แทน "จบงาน" ซึ่งกลายเป็นปุ่มยืนยันเฉย ๆ ไม่มีอะไรให้กรอกอีก หน้าบิล/แคชเชียร์ (`billing-page-client.tsx`) ตัด
UI เลือกคอร์สตอน checkout ออก (เหลือแค่แสดงผลอย่างเดียวว่าใบงานนี้จะตัดคอร์สใบไหน อ่านจาก
`ServiceJob.memberPackageId`) เทสต์เก่าทุกจุดที่เคยส่ง `paymentMethod` ตอน `COMPLETED` (booking/bill/
cashier-shift/payroll e2e specs) ต้องย้ายมาส่งตอน `IN_SERVICE` แทน — แก้แล้วทุกไฟล์ที่พบจากการ grep
`paymentMethod` ทั่ว `apps/api/src/**/test/*.e2e-spec.ts`

---

## ADR-047: ปรับปรุง UI/UX ฝั่ง frontend — เปลี่ยนสีหลักจากเขียวศิลาดลเป็นทีล/ปิโตรเลียม + ปรับกระดานเมนูซ้ายให้จัดกลุ่ม/ใส่ไอคอน/ย่อได้/ใช้บนมือถือได้
วันที่: 2026-08-28
Task ที่เกี่ยวข้อง: ไม่มีใน docs/PLAN.md (นอกขอบเขต Task เดิม — เจ้าของร้านขอปรับปรุงหน้าตาเพิ่มเติมนอกรอบ)

บริบท: เจ้าของร้านขอให้ปรับดีไซน์หน้าบ้านให้ "สวยงามน่าใช้ โทนสีสบายตาอ่านง่าย modern minimal premium
เน้นใช้งานบน Tablet/mobile/desktop" ทำ mockup เทียบให้ดูก่อน (ไม่แตะโค้ดจริง) 2 รอบจนได้ทิศทางที่ต้องการ
แล้วขอให้เปลี่ยนสีหลักจากเขียวศิลาดลเดิมเป็นโทนทีล/ปิโตรเลียม (น้ำเงินอมเขียว) โดยยืนยันให้คง indigo/brass/
rose (สีรอง+สถานะที่ผูกกับ Lane Board ตาม §3) ไว้เหมือนเดิมทั้งหมด

ตัดสินใจ:
1. **เปลี่ยนค่า hex ของ `--celadon`/`--celadon-hover`/`--celadon-tint`/`--celadon-solid` ทั้ง 2 ธีม คงชื่อ
   ตัวแปรเดิมไว้ทั้งหมด** (ไม่ rename เป็น `--teal`) เพื่อไม่ต้องแก้ทุก component ที่อ้างอิง `bg-celadon-*`/
   `text-celadon-*` ทั่วระบบ — เปลี่ยนแค่ที่เดียวใน `packages/ui/src/tokens.css` ไหลไปทั้ง 13+ หน้าอัตโนมัติ
   ผ่าน Tailwind theme mapping (`tailwind-theme.css`)
   - Light: `#42806F`→`#0E6E74`, hover `#376D5F`→`#0A5860`, tint `#E3EFEA`→`#E2F0F0`, solid `#376D5F`→`#0A5860`
   - Dark: `#63AB94`→`#4FB8BE`, hover `#7ABDA6`→`#72CBCF`, tint `#1B3630`→`#113436`
   - เช็คคอนทราสต์ WCAG AA ทุกคู่ที่ใช้จริงก่อนเลือกค่า (ตามวินัยเดียวกับ ADR-003) — ผ่านหมดและมีระยะ
     ปลอดภัยเยอะกว่าเดิม: celadon บนพื้นขาว 6.00:1, celadon-hover บนพื้นขาว 8.15:1, ตัวอักษรขาวบน
     celadon-solid 8.15:1 (ทั้ง 2 ธีมเพราะเป็นค่าคงที่), โหมดมืด celadon บนพื้น surface 6.86:1,
     celadon-hover บนพื้น surface มืด 8.57:1, celadon-hover บน celadon-tint มืด 7.12:1
   - indigo/brass/rose (และ tint/solid ของแต่ละสี) **ไม่แตะเลย** — สีสถานะ 7 ค่าใน §3 ยังผูกกับ Lane Board
     เหมือนเดิมทุกประการ
2. **ปรับกระดานเมนูซ้าย (`Sidebar`) ให้จัดกลุ่ม 3 หมวด (ปฏิบัติการ/ข้อมูลร้าน/จัดการร้าน) + ใส่ไอคอนทุกเมนู +
   ย่อเหลือแถบไอคอนได้ (จำค่าไว้ใน localStorage คีย์ `lotus-desk-sidebar-collapsed` แพทเทิร์นเดียวกับ
   `ThemeToggle`)** — `NavItem` (`nav-items.tsx`, เปลี่ยนนามสกุลจาก `.ts` เพราะต้องมี JSX ของไอคอน) เพิ่ม
   ฟิลด์ `group`/`icon` ต่อรายการ ไม่เปลี่ยน `href`/`label`/`require` เดิมแม้แต่รายการเดียว
3. **`AppShell` เพิ่มลิ้นชักเมนูสำหรับมือถือ (fixed + slide-in + backdrop, ปุ่มแฮมเบอร์เกอร์ในแถบบน)** — ก่อน
   หน้านี้ sidebar เป็น `hidden ... md:block` ล้วน ๆ คือ **ต่ำกว่า `md` (768px) กดเมนูไม่ได้เลยสักเมนู** เป็นช่อง
   โหว่จริงที่พบตอนทำ mockup ไม่ใช่แค่เรื่องความสวยงาม
4. **เพิ่ม command palette (Cmd/Ctrl+K)** ที่ปุ่มค้นหาในแถบบน — ตามที่ `docs/DESIGN.md §5` ระบุไว้อยู่แล้วว่า
   ต้องมีช่องค้นหาสากล `Cmd/Ctrl+K` แต่ไม่เคยมี UI จริงจนถึงตอนนี้ ขอบเขตรอบนี้ทำแค่ "ไปที่หน้า" จากรายการ
   เมนูที่มีสิทธิ์เห็นจริง (กรอง `hasPermission` เหมือน sidebar) **ไม่ใส่ผลค้นหาสมาชิก/บิล/คอร์ส** เพราะต้องต่อ
   API ค้นหาข้ามโมดูลที่ยังไม่มี ถือเป็นงานเพิ่มขอบเขตคนละก้อน เปิดไว้เป็นตัวเลือกในอนาคตเฉย ๆ

ขอบเขตที่ไม่ทำรอบนี้ (เห็นใน mockup แต่ตัดออกเพราะต้องมีข้อมูลจริงรองรับ ไม่ใช่แค่ตกแต่ง):
- **สปาร์กไลน์/เดลต้าเทียบเมื่อวานบนการ์ด KPI แดชบอร์ด** — ต้องดึง `reportsApi.dailySummary()` ย้อนหลัง
  7 วันมาคำนวณเทรนด์จริง เป็นงาน data-fetching เพิ่ม ไม่ใช่แค่ styling ตัดสินใจแยกเป็นงานคนละรอบ
- **ป๊อปโอเวอร์แจ้งเตือน (กระดิ่งบนแถบบน)** — ระบบยังไม่มี notification backend จริง ใส่ UI เปล่าที่โชว์ข้อมูล
  ปลอมจะทำให้เข้าใจผิดว่าเป็นฟีเจอร์จริง จึงไม่ใส่ในโค้ดจริง (มีแค่ใน mockup เพื่อสาธิตทิศทางเท่านั้น)
- **Branch switcher แบบ dropdown ใหม่** — ของเดิม (`BranchSwitcher`, `<Select>`) ยังทำงานถูกต้องตามที่มีอยู่
  (ระบบยังรองรับหลายสาขาต่อผู้ใช้จริงถ้ามีมากกว่า 1 สาขา) ไม่ต้องเปลี่ยนเป็น popover ก็ได้ประโยชน์เท่าเดิม

ผลกระทบ: `packages/ui/src/tokens.css`, `docs/DESIGN.md §1-2` (เปลี่ยนสีหลัก), `packages/ui/src/app-shell/
sidebar.tsx` + `app-shell.tsx` (เพิ่ม prop ใหม่ทั้งคู่ แบบ backward-compatible — ของเดิมที่เรียกไม่ส่ง prop ใหม่
ยังทำงานได้), `apps/web/src/app/(app)/nav-items.ts`→`.tsx`, `authenticated-shell.tsx`, ไฟล์ใหม่ `nav-icons.tsx`
และ `command-palette.tsx` ไม่มีการแก้ schema/API/business logic ใด ๆ ทั้งสิ้น เป็นงาน UI ล้วน
