import {
  Button,
  Input,
  Label,
  Select,
  StatusBadge,
  APPOINTMENT_STATUSES,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@lotus-desk/ui";

const COLOR_TOKENS: Array<{ name: string; className: string; on?: "light" | "dark" }> = [
  { name: "paper", className: "bg-paper" },
  { name: "surface", className: "bg-surface" },
  { name: "surface-sunk", className: "bg-surface-sunk" },
  { name: "celadon", className: "bg-celadon", on: "dark" },
  { name: "celadon-tint", className: "bg-celadon-tint" },
  { name: "indigo", className: "bg-indigo", on: "dark" },
  { name: "indigo-tint", className: "bg-indigo-tint" },
  { name: "brass", className: "bg-brass", on: "dark" },
  { name: "brass-tint", className: "bg-brass-tint" },
  { name: "rose", className: "bg-rose", on: "dark" },
  { name: "rose-tint", className: "bg-rose-tint" },
];

const SAMPLE_ROWS = [
  { time: "09:00", customer: "คุณสมชาย", service: "นวดไทย 90'", staff: "นก", priceSatang: 90000 },
  { time: "10:30", customer: "คุณมาลี", service: "นวดน้ำมัน 60'", staff: "แอน", priceSatang: 75000 },
  { time: "13:00", customer: "คุณปุ๊ก", service: "นวดเท้า 45'", staff: "ปุ๊ก", priceSatang: 50000 },
];

function formatBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

export default function StyleGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 p-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Style Guide
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Design token, component, และ badge สถานะทั้งหมดของ Lotus Desk — ดู docs/DESIGN.md
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">สี (Color tokens)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {COLOR_TOKENS.map((token) => (
            <div key={token.name} className="overflow-hidden rounded-lg border border-line">
              <div className={`h-16 ${token.className}`} />
              <div className="px-3 py-2 text-xs font-medium text-ink">--{token.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">ตัวอักษร (Typography)</h2>
        <div className="space-y-3 rounded-lg border border-line bg-surface p-6">
          <p className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
            display-lg — ชื่อหน้า
          </p>
          <p className="font-display text-[34px] font-semibold leading-[1.1] tabular-nums text-ink">
            ฿12,450 — kpi
          </p>
          <p className="font-display text-[17px] font-semibold leading-[1.4] text-ink">h2 — หัวข้อรอง</p>
          <p className="text-sm leading-[1.55] text-ink">body — ข้อความปกติที่ใช้ทั่วไป</p>
          <p className="text-sm font-semibold leading-[1.55] text-ink">body-strong — ข้อความเน้น</p>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">label — ป้ายกำกับ</p>
          <p className="font-data text-[13px] tabular-nums text-ink">data — 14:30 · ฿1,250 · #A0912</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">ปุ่ม (Buttons)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">บันทึกการจอง</Button>
          <Button variant="secondary">ยกเลิก</Button>
          <Button variant="ghost">ดูรายละเอียด</Button>
          <Button variant="destructive">ลบรายการ</Button>
          <Button variant="primary" size="sm">
            ปุ่มเล็ก
          </Button>
          <Button variant="primary" size="lg">
            ปุ่มใหญ่
          </Button>
          <Button variant="primary" disabled>
            ปิดใช้งาน
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">ฟอร์ม (Form)</h2>
        <div className="grid max-w-md gap-4 rounded-lg border border-line bg-surface p-6">
          <div className="grid gap-1.5">
            <Label htmlFor="sg-name">ชื่อลูกค้า</Label>
            <Input id="sg-name" placeholder="เช่น คุณสมชาย ใจดี" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sg-branch">สาขา</Label>
            <Select id="sg-branch" defaultValue="main">
              <option value="main">สาขาหลัก</option>
              <option value="north">สาขาเหนือ</option>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">ตาราง (Table)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เวลา</TableHead>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>บริการ</TableHead>
              <TableHead>พนักงาน</TableHead>
              <TableHead className="text-right">ราคา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_ROWS.map((row) => (
              <TableRow key={row.time}>
                <TableCell className="font-data tabular-nums">{row.time}</TableCell>
                <TableCell>{row.customer}</TableCell>
                <TableCell>{row.service}</TableCell>
                <TableCell>{row.staff}</TableCell>
                <TableCell className="text-right font-data tabular-nums">
                  {formatBaht(row.priceSatang)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Badge สถานะ (7 สถานะ)</h2>
        <div className="flex flex-wrap gap-3 rounded-lg border border-line bg-surface p-6">
          {APPOINTMENT_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </section>
    </div>
  );
}
