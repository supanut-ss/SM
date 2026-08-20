import { Anuphan, IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";

// บทบาทฟอนต์ตาม docs/DESIGN.md §3.4 — โหลดเฉพาะน้ำหนักที่ใช้จริง
export const fontDisplay = Anuphan({
  subsets: ["thai", "latin"],
  weight: "600",
  variable: "--font-display",
  display: "swap",
});

export const fontBody = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

// ดีไซน์ต้นฉบับระบุน้ำหนัก 450 แต่ IBM Plex Mono มีให้เฉพาะสิบหลักคงที่บน Google Fonts
// เลือก 500 ที่ใกล้เคียงที่สุด (ดู docs/decisions.md ADR-003)
export const fontData = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-data",
  display: "swap",
});

export const fontVariables = `${fontDisplay.variable} ${fontBody.variable} ${fontData.variable}`;
