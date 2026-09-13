"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function TimezoneCookie() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie
      .split("; ")
      .find((part) => part.startsWith("tz="))
      ?.slice(3);
    if (current && decodeURIComponent(current) === timeZone) return;
    document.cookie = `tz=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
