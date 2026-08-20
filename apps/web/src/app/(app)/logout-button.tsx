"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@lotus-desk/ui";
import { authApi } from "../../lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      router.push("/login");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "กำลังออก..." : "ออกจากระบบ"}
    </Button>
  );
}
