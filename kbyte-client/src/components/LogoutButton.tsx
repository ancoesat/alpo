"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";

// Small fixed-position control, rendered globally from layout.tsx so it
// shows up on every page (not just the mobile nav, which is hidden on
// desktop) — hides itself on /login since there's nothing to log out of yet.
export default function LogoutButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // The desktop (/) has its own logout in the start menu.
  if (pathname === "/login" || pathname === "/") return null;

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <>
    <Link
      href="/"
      title="Masaüstü"
      className="fixed top-4 right-15 z-40 flex items-center justify-center h-9 w-9 rounded-full bg-[#121212] border border-[#1e1e1e] text-gray-500 hover:text-sky-400 hover:border-sky-900 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5v10.5H3.75zM9 19.5h6M12 15.75v3.75" />
      </svg>
    </Link>
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title="Çıkış Yap"
      className="fixed top-4 right-4 z-40 flex items-center justify-center h-9 w-9 rounded-full bg-[#121212] border border-[#1e1e1e] text-gray-500 hover:text-red-400 hover:border-red-900 transition-colors disabled:opacity-50"
    >
      <LogoutIcon />
    </button>
    </>
  );
}
