import type { SVGProps } from "react";

/**
 * ไอคอนเมนูซ้าย (T-ADR-047) — เส้นเรียบ stroke 1.8, viewBox 24 ทั้งหมดเพื่อสเกลเท่ากันทุกไอคอน
 * ไม่ใช้ไลบรารีไอคอนภายนอกเพราะ CLAUDE.md ห้ามเพิ่ม dependency ใหม่โดยไม่ถาม — เซตนี้เล็กพอเขียนเองได้
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </svg>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M8 4.5v-1M16 4.5v-1" />
    </svg>
  );
}

export function MemberIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15.5 8a3 3 0 1 1 3.8 2.9M20.5 19c0-2.6-1.7-4.6-4-5.2" />
    </svg>
  );
}

export function ServiceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="8" height="8" rx="1.5" />
      <rect x="12.5" y="3.5" width="8" height="8" rx="1.5" />
      <rect x="3.5" y="12.5" width="8" height="8" rx="1.5" />
      <rect x="12.5" y="12.5" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  );
}

export function PromotionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m11 3 8 8-8.5 8.5a1.5 1.5 0 0 1-2.1 0L3 15a1.5 1.5 0 0 1 0-2.1L11 3Z" />
      <circle cx="14.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BillingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9.5 10h5M9.5 13.5h5M9.5 17h3" />
    </svg>
  );
}

export function StaffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function RoomIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 11h17M3.5 11V8a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 10.5 8v3M3.5 11v7.5M20.5 11V9a1.5 1.5 0 0 0-1.5-1.5h-4A1.5 1.5 0 0 0 13.5 9v2M20.5 11v7.5" />
    </svg>
  );
}

export function PayrollIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M9.5 15c0 1 1 1.7 2.5 1.7s2.5-.7 2.5-1.8c0-2.4-5-1.1-5-3.5 0-1.1 1-1.8 2.5-1.8s2.5.6 2.5 1.6" />
    </svg>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </svg>
  );
}

export function InventoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 10h17M3.5 15h17M8 4v16" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.5 12a7.5 7.5 0 0 0-.14-1.44l2-1.5-2-3.46-2.3.9a7.6 7.6 0 0 0-2.5-1.44L14 2.5h-4l-.56 2.56a7.6 7.6 0 0 0-2.5 1.44l-2.3-.9-2 3.46 2 1.5a7.7 7.7 0 0 0 0 2.88l-2 1.5 2 3.46 2.3-.9c.74.62 1.58 1.1 2.5 1.44L10 21.5h4l.56-2.56a7.6 7.6 0 0 0 2.5-1.44l2.3.9 2-3.46-2-1.5c.1-.47.14-.95.14-1.44Z" />
    </svg>
  );
}
