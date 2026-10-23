"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KasaIcon, PortfolioIcon, PlusIcon, BankIcon } from "@/components/icons";

const items = [
  { href: "/kasa",      label: "Kasa",     icon: <KasaIcon /> },
  { href: "/portfolio", label: "Portföy",  icon: <PortfolioIcon /> },
  { href: "/bankalar",  label: "Bankalar", icon: <BankIcon /> },
  { href: "/ekle",      label: "İşlem",    icon: <PlusIcon /> },
];

export default function MobileNav() {
  const pathname = usePathname();
  if (!items.some((item) => item.href === pathname)) return null; // desktop, kalori, login

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[#0a0a0a]/95 backdrop-blur border-t border-[#1e1e1e]">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-wider transition-colors ${
                active ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
