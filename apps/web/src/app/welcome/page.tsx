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

const ctaClass =
  "inline-flex h-11 items-center justify-center rounded-DEFAULT bg-celadon-solid px-5 text-base font-medium text-white transition-colors duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon focus-visible:ring-offset-2";

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8" unoptimized />
            <span className="font-display text-lg font-semibold">Sabaizy</span>
          </span>
          <Link href="/login" className={ctaClass}>
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h1 className="text-balance font-display text-3xl font-semibold sm:text-4xl">
            ระบบหลังบ้านร้านสปา นวด และเสริมความงาม
          </h1>
          <p className="text-pretty mt-4 max-w-2xl text-base text-ink-muted">
            จัดคิว ปิดบิล ดูแลสมาชิกและคอร์ส จัดตารางพนักงาน และดูรายงาน ครบในที่เดียว
            ใช้ได้ทั้งบนคอมพิวเตอร์ แท็บเล็ต และมือถือ
          </p>
          <div className="mt-6">
            <Link href="/login" className={ctaClass}>
              เข้าสู่ระบบเพื่อเริ่มใช้งาน
            </Link>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mx-auto max-w-5xl px-4 pb-16">
          <h2 id="features-heading" className="font-display text-2xl font-semibold">
            ทำอะไรได้บ้าง
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="rounded-lg border border-line bg-surface p-5">
                <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                <p className="text-pretty mt-1 text-sm text-ink-muted">{feature.summary}</p>
                <ul className="mt-3 grid gap-1.5 text-sm">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden="true" className="text-celadon">
                        •
                      </span>
                      <span className="text-pretty">{point}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-muted">
          Sabaizy — สำหรับพนักงานของร้านที่มีบัญชีผู้ใช้ ติดต่อเจ้าของร้านหากยังไม่มีบัญชี
        </div>
      </footer>
    </div>
  );
}
