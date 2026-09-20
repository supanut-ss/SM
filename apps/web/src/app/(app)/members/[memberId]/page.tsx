import { MemberDetailPageClient } from "./member-detail-page-client";

export const metadata = { title: "ข้อมูลสมาชิก — Sabaizy" };

// Next.js 15 App Router: params เป็น Promise เสมอสำหรับ dynamic segment (route แรกในระบบนี้ที่เป็น
// dynamic segment จริง — ไม่มีแพทเทิร์นเดิมในโค้ดฐานนี้ให้อ้างอิง ยึดตามคอนเวนชันมาตรฐานของ Next 15)
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return <MemberDetailPageClient memberId={memberId} />;
}
