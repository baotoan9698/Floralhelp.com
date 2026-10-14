"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export default function SessionGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname === "/login") return;
    let alive = true;
    let expiry: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) return;
        const state = await response.json();
        if (!alive) return;
        if (!state.active) { window.location.replace(state.reason && state.reason !== "signed-out" ? `/login?reason=${encodeURIComponent(state.reason)}` : "/login"); return; }
        clearTimeout(expiry);
        if (state.accessUntil) expiry = setTimeout(check, Math.max(100, Math.min(2147483647, Date.parse(state.accessUntil) - Date.now() + 100)));
      } catch { /* Server authorization still protects every operation while offline. */ }
    }
    void check();
    const interval = setInterval(check, 15000);
    window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(interval); clearTimeout(expiry); window.removeEventListener("focus", check); };
  }, [pathname]);
  return null;
}
