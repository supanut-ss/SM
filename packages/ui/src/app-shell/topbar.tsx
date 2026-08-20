import type { ReactNode } from "react";

export function Topbar({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-center justify-between gap-4">{children}</div>;
}
