import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Sabaizy — ระบบหลังบ้านร้านสปา นวด เสริมความงาม",
  description: "จัดคิว ปิดบิล ดูแลสมาชิกและคอร์ส ลงเวลาพนักงาน และดูรายงานของร้านในที่เดียว",
};

interface Feature {
  title: string;
  summary: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    title: "กระดานคิว",
    summary: "เห็นคิวทั้งร้านบนหน้าจอเดียว ลากย้ายนัดได้ทันที",
    points: ["คิวหมุนจัดพนักงานให้เป็นธรรม", "จองด่วนลูกค้า walk-in", "จองล่วงหน้าและบันทึกนัดย้อนหลัง"],
  },
  {
    title: "บิลและแคชเชียร์",
    summary: "ปิดบิลได้เร็ว ยอดเงินตรงทุกสตางค์",
    points: ["รับชำระหลายช่องทาง", "ตัดคอร์สของสมาชิกตอนปิดบิล", "ประวัติบิลและยกเลิกบิลตามสิทธิ์"],
  },
  {
    title: "สมาชิก คอร์ส และแพ็กเกจ",
    summary: "รู้ว่าลูกค้าคนไหนเหลือคอร์สกี่ครั้ง หมดอายุเมื่อไหร่",
    points: ["ประวัติการใช้บริการต่อสมาชิก", "ยอดคงเหลือคอร์สตรวจย้อนหลังได้", "เตือนคอร์สใกล้หมดอายุบนหน้าหลัก"],
  },
  {
    title: "บริการ ห้อง และเตียง",
    summary: "ตั้งรายการบริการและห้องให้ตรงกับหน้าร้านจริง",
    points: ["บริการหลายระยะเวลา หลายราคา", "ประเภทห้องและจำนวนเตียง", "ระบบกันจองห้องหรือพนักงานซ้อนกัน"],
  },
  {
    title: "พนักงาน กะงาน และลงเวลา",
    summary: "จัดตารางงานและดูการเข้า-ออกงานโดยไม่ต้องใช้กระดาษ",
    points: ["แม่แบบกะและตารางกะรายสัปดาห์", "วันลาของพนักงาน", "ลงเวลาเข้า-ออกงานหน้าร้าน"],
  },
  {
    title: "ค่ามือและโปรโมชั่น",
    summary: "คำนวณรายได้พนักงานและส่วนลดอย่างโปร่งใส",
    points: ["ค่ามือรายงวด", "โปรโมชั่นพร้อมเครื่องคำนวณส่วนลด"],
  },
  {
    title: "รายงานเจ้าของร้าน",
    summary: "ดูภาพรวมรายได้และผลงานของร้านได้ทุกวัน",
    points: ["รายได้รายวัน", "ส่งออกเป็นไฟล์ Excel"],
  },
  {
    title: "สิทธิ์ตามบทบาทและการตรวจสอบย้อนหลัง",
    summary: "แต่ละคนเห็นและทำได้เฉพาะงานของตัวเอง",
    points: ["เจ้าของร้าน ผู้จัดการ พนักงานต้อนรับ เห็นเมนูไม่เหมือนกัน", "ทุกการแก้ไขมีบันทึกว่าใครทำเมื่อไหร่"],
  },
];

const HIGHLIGHTS = [
  { title: "คิวไม่ชน", text: "ระบบกันการจองซ้อนทั้งพนักงานและห้อง" },
  { title: "เงินตรงทุกสตางค์", text: "เก็บยอดเป็นสตางค์ ไม่มีเศษคลาดเคลื่อน" },
  { title: "ใช้ได้ทุกอุปกรณ์", text: "คอมพิวเตอร์ แท็บเล็ต และมือถือ" },
];

interface Showcase {
  image: string;
  title: string;
  text: string;
  alt: string;
}

const SHOWCASES: Showcase[] = [
  {
    image: "/welcome/01-queue.jpg",
    title: "จัดคิวได้ในไม่กี่แตะ",
    text: "จองด่วนสำหรับลูกค้าที่เดินเข้าร้าน หรือจองล่วงหน้าสำหรับนัดของวันถัดไป เห็นภาพรวมของวันบนกระดานเดียว",
    alt: "หน้ากระดานคิวบนมือถือ มีปุ่มจองด่วนและจองล่วงหน้า",
  },
  {
    image: "/welcome/02-services.jpg",
    title: "ตั้งบริการให้เป็นระเบียบ",
    text: "แยกหมวดบริการ ตั้งชื่อ ระยะเวลา และราคาได้เอง เพิ่มรายการใหม่ได้จากปุ่มเดียว",
    alt: "หน้าจัดการบริการบนมือถือ",
  },
  {
    image: "/welcome/04-staff.jpg",
    title: "ดูแลพนักงานและตารางกะ",
    text: "เพิ่มพนักงาน กำหนดทักษะ และจัดตารางกะรายสัปดาห์ให้ทีมรู้ตรงกัน",
    alt: "หน้าพนักงานบนมือถือ มีปุ่มจัดตารางกะ",
  },
  {
    image: "/welcome/05-billing.jpg",
    title: "ตรวจยอดและออกบิลสบายใจ",
    text: "เปิดรอบกะ เลือกรายการ แล้วรับชำระเงิน ยอดสรุปตรงกับบิลทุกใบ",
    alt: "หน้าบิลและแคชเชียร์บนมือถือ",
  },
];

const ctaPrimary =
  "inline-flex h-12 items-center justify-center rounded-DEFAULT bg-celadon-solid px-7 text-base font-medium text-white transition-colors duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const navLink =
  "rounded-DEFAULT px-2 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon";

function GoldRule() {
  return <span aria-hidden="true" className="block h-px w-12 bg-celadon" />;
}

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8" unoptimized />
            <span className="font-display text-lg font-semibold tracking-wide">Sabaizy</span>
          </span>
          <nav aria-label="เมนูหน้าแรก" className="hidden items-center gap-2 md:flex">
            <a href="#showcase" className={navLink}>
              ตัวอย่างหน้าจอ
            </a>
            <a href="#features" className={navLink}>
              ฟีเจอร์
            </a>
          </nav>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-DEFAULT border border-celadon px-5 text-sm font-medium text-celadon transition-colors duration-150 hover:bg-celadon-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-2"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-paper/70">
                Spa · Massage · Beauty
              </p>
              <div className="mt-5">
                <GoldRule />
              </div>
              <h1 className="text-balance mt-6 font-display text-4xl font-semibold leading-tight md:text-5xl">
                ระบบหลังบ้านที่ทำให้ร้านสปาของคุณดูแลลูกค้าได้ดั่งใจ
              </h1>
              <p className="text-pretty mt-5 max-w-lg text-base leading-relaxed text-paper/80">
                จัดคิว ปิดบิล ดูแลสมาชิกและคอร์ส จัดตารางพนักงาน และดูรายงาน ครบในที่เดียว
                ใช้งานง่ายสำหรับพนักงานต้อนรับ ผู้จัดการ และเจ้าของร้าน
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/login" className={ctaPrimary}>
                  เข้าสู่ระบบเพื่อเริ่มใช้งาน
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-12 items-center rounded-DEFAULT px-3 text-base text-paper/80 underline-offset-4 hover:text-paper hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon"
                >
                  ดูฟีเจอร์ทั้งหมด
                </a>
              </div>
            </div>
            <div className="mx-auto w-full max-w-xs md:max-w-sm">
              <Image
                src="/welcome/01-queue.jpg"
                alt="หน้ากระดานคิวของ Sabaizy บนมือถือ"
                width={720}
                height={1279}
                className="h-auto w-full rounded-lg shadow-pop"
                priority
                unoptimized
              />
            </div>
          </div>
        </section>

        <section aria-label="จุดเด่นของระบบ" className="border-b border-line bg-surface">
          <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="text-center md:text-left">
                <p className="font-display text-lg font-semibold text-celadon">{item.title}</p>
                <p className="text-pretty mt-1 text-sm text-ink-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="showcase" aria-labelledby="showcase-heading" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 md:py-24">
          <GoldRule />
          <h2 id="showcase-heading" className="text-balance mt-4 font-display text-3xl font-semibold">
            ตัวอย่างหน้าจอการใช้งานจริง
          </h2>
          <p className="text-pretty mt-3 max-w-2xl text-base text-ink-muted">
            ออกแบบให้พนักงานหน้าร้านใช้ได้ทันทีบนมือถือ ปุ่มใหญ่ ข้อความภาษาไทย อ่านง่าย
          </p>
          <ul className="mt-12 grid gap-16">
            {SHOWCASES.map((item, index) => (
              <li
                key={item.title}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-16"
              >
                <div className={index % 2 === 1 ? "md:order-2" : undefined}>
                  <p className="font-display text-sm font-semibold tracking-widest text-celadon">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="text-balance mt-2 font-display text-2xl font-semibold">{item.title}</h3>
                  <p className="text-pretty mt-3 max-w-md text-base leading-relaxed text-ink-muted">{item.text}</p>
                </div>
                <div className="mx-auto w-full max-w-xs">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={720}
                    height={1279}
                    className="h-auto w-full rounded-lg border border-line shadow-pop"
                    unoptimized
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-16 border-t border-line bg-surface-sunk">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <GoldRule />
            <h2 id="features-heading" className="mt-4 font-display text-3xl font-semibold">
              ฟีเจอร์ทั้งหมด
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, index) => (
                <li key={feature.title} className="flex flex-col rounded-lg border border-line bg-surface p-6">
                  <span className="font-display text-sm font-semibold tracking-widest text-celadon">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-balance mt-3 font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="text-pretty mt-2 text-sm text-ink-muted">{feature.summary}</p>
                  <ul className="mt-4 grid gap-2 border-t border-line pt-4 text-sm">
                    {feature.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="text-celadon">
                          ◆
                        </span>
                        <span className="text-pretty">{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-ink text-paper">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-balance font-display text-3xl font-semibold">พร้อมเริ่มใช้งานแล้วหรือยัง</h2>
            <p className="text-pretty mt-3 text-base text-paper/80">
              เข้าสู่ระบบด้วยบัญชีของร้านเพื่อเริ่มจัดคิวและปิดบิลได้ทันที
            </p>
            <div className="mt-8">
              <Link href="/login" className={ctaPrimary}>
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-muted">
          Sabaizy — สำหรับพนักงานของร้านที่มีบัญชีผู้ใช้ ติดต่อเจ้าของร้านหากยังไม่มีบัญชี
        </div>
      </footer>
    </div>
  );
}
