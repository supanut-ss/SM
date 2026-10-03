import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Sabaizy — ระบบหลังบ้านร้านสปา นวด เสริมความงาม",
  description: "จัดคิว ปิดบิล ดูแลสมาชิกและคอร์ส ลงเวลาพนักงาน และดูรายงานของร้านในที่เดียว",
};

interface Feature {
  title: string;
  summary: string;
}

const FEATURES: Feature[] = [
  { title: "กระดานคิว", summary: "คิวหมุน จองด่วน จองล่วงหน้า และลากย้ายนัดบนหน้าจอเดียว" },
  { title: "บิลและแคชเชียร์", summary: "ปิดบิลเร็ว ตัดคอร์สตอนชำระ ยอดตรงทุกสตางค์" },
  { title: "สมาชิกและคอร์ส", summary: "รู้ยอดคงเหลือและวันหมดอายุของคอร์สแต่ละคน" },
  { title: "บริการและห้อง", summary: "ตั้งบริการ ราคา ห้อง และเตียง พร้อมกันจองซ้อน" },
  { title: "พนักงานและกะงาน", summary: "ตารางกะรายสัปดาห์ วันลา และลงเวลาเข้า-ออกงาน" },
  { title: "ค่ามือและโปรโมชั่น", summary: "คำนวณรายได้พนักงานและส่วนลดอย่างโปร่งใส" },
  { title: "รายงานเจ้าของร้าน", summary: "ดูรายได้รายวัน ส่งออกเป็นไฟล์ Excel" },
  { title: "สิทธิ์และประวัติการแก้ไข", summary: "แต่ละบทบาทเห็นเฉพาะงานของตัวเอง ทุกการแก้ไขมีบันทึก" },
];

const SCREENS = [
  { src: "/welcome/01-queue.jpg", alt: "หน้ากระดานคิว", offset: "mt-8" },
  { src: "/welcome/05-billing.jpg", alt: "หน้าบิลและแคชเชียร์", offset: "" },
  { src: "/welcome/04-staff.jpg", alt: "หน้าพนักงานและตารางกะ", offset: "mt-12" },
];

const ctaPrimary =
  "inline-flex h-12 items-center justify-center rounded-DEFAULT bg-celadon-solid px-7 text-base font-medium text-white transition-colors duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <span className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8" unoptimized />
            <span className="font-display text-lg font-semibold tracking-wide">Sabaizy</span>
          </span>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-DEFAULT border border-paper/30 px-5 text-sm font-medium text-paper transition-colors duration-150 hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-paper/70">
                Spa · Massage · Beauty
              </p>
              <span aria-hidden="true" className="mt-4 block h-px w-12 bg-celadon" />
              <h1 className="text-balance mt-6 font-display text-3xl font-semibold leading-tight md:text-5xl">
                ระบบหลังบ้านที่ทำให้ร้านสปาดูแลลูกค้าได้ดั่งใจ
              </h1>
              <p className="text-pretty mt-4 max-w-md text-base leading-relaxed text-paper/80">
                จัดคิว ปิดบิล ดูแลสมาชิกและคอร์ส จัดตารางพนักงาน และดูรายงาน ครบในที่เดียว
              </p>
              <div className="mt-7">
                <Link href="/login" className={ctaPrimary}>
                  เข้าสู่ระบบเพื่อเริ่มใช้งาน
                </Link>
              </div>
            </div>

            <ul aria-label="ตัวอย่างหน้าจอ" className="mx-auto flex w-full max-w-md items-start justify-center gap-3">
              {SCREENS.map((screen) => (
                <li key={screen.src} className={`w-1/3 ${screen.offset}`}>
                  <Image
                    src={screen.src}
                    alt={screen.alt}
                    width={720}
                    height={1141}
                    className="h-auto w-full rounded-lg shadow-pop"
                    priority
                    unoptimized
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <h2 id="features-heading" className="font-display text-2xl font-semibold">
            ครบทุกงานหน้าร้าน
          </h2>
          <span aria-hidden="true" className="mt-3 block h-px w-12 bg-celadon" />
          <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="border-t border-line pt-4">
                <h3 className="font-display text-base font-semibold">{feature.title}</h3>
                <p className="text-pretty mt-1 text-sm leading-relaxed text-ink-muted">{feature.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-ink-muted">
          <span>Sabaizy — สำหรับพนักงานที่มีบัญชีผู้ใช้ ติดต่อเจ้าของร้านหากยังไม่มีบัญชี</span>
          <Link
            href="/login"
            className="rounded-DEFAULT px-2 py-2 font-medium text-celadon hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </footer>
    </div>
  );
}
