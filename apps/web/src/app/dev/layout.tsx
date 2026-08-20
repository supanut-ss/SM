import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell, Sidebar, SidebarLink } from "@lotus-desk/ui";
import { DevTopbar } from "./dev-topbar";

const NAV_ITEMS = [
  { href: "/", label: "แดชบอร์ด" },
  { href: "/board", label: "กระดานคิว" },
  { href: "/members", label: "สมาชิก" },
  { href: "/services", label: "บริการ" },
  { href: "/packages", label: "คอร์ส/แพ็กเกจ" },
  { href: "/promotions", label: "โปรโมชั่น" },
  { href: "/staff", label: "พนักงาน" },
  { href: "/payroll", label: "ค่ามือ" },
  { href: "/reports", label: "รายงาน" },
  { href: "/inventory", label: "คลัง" },
  { href: "/settings", label: "ตั้งค่า" },
  { href: "/dev/styleguide", label: "Style Guide", active: true },
];

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      topbar={<DevTopbar />}
      sidebar={
        <Sidebar>
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} as={Link} href={item.href} active={item.active}>
              {item.label}
            </SidebarLink>
          ))}
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
}
