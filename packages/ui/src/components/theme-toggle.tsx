"use client";

import { useSyncExternalStore } from "react";
import { Button } from "./button";

type Theme = "light" | "dark";

const STORAGE_KEY = "lotus-desk-theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  // ฝั่ง server ไม่รู้ค่าจริง — THEME_INIT_SCRIPT ตั้งค่า attribute ก่อน hydrate แล้ว
  // useSyncExternalStore จะ sync ให้ถูกทันทีหลัง mount (อาจกระพริบแค่ label ปุ่มเฟรมเดียว)
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={next === "dark" ? "สลับเป็นโหมดมืด" : "สลับเป็นโหมดสว่าง"}
      onClick={() => applyTheme(next)}
    >
      {theme === "dark" ? "โหมดมืด" : "โหมดสว่าง"}
    </Button>
  );
}

/** วาง script นี้ไว้ก่อน hydrate (ใน <head>) กันหน้าจอกระพริบธีมผิดตอนโหลด */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;
