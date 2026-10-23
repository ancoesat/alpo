"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// XP-style wallpaper drawn with CSS gradients only: no image to download.
const wallpaper = [
  "radial-gradient(ellipse 140% 55% at 25% 108%, #2f7a14 0, #5aa832 58%, transparent 59%)",
  "radial-gradient(ellipse 120% 45% at 90% 112%, #2a6e12 0, #4f9a2b 58%, transparent 59%)",
  "radial-gradient(ellipse 18% 6% at 22% 20%, rgba(255,255,255,.85), transparent)",
  "radial-gradient(ellipse 26% 7% at 72% 14%, rgba(255,255,255,.7), transparent)",
  "radial-gradient(ellipse 14% 5% at 52% 30%, rgba(255,255,255,.55), transparent)",
  "linear-gradient(#1f5fc8, #5d9ee8 55%, #b3d6f6)",
].join(",");

const xpFont = { fontFamily: "Tahoma, Verdana, Segoe UI, sans-serif" };

function KbyteIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#0a0a0a" stroke="#10B981" strokeWidth="2.5" />
      <text x="24" y="33" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="24" fill="#10B981">K</text>
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#fff4e6" stroke="#f97316" strokeWidth="2.5" />
      <path d="M24 10c2 7-7 10-7 19a7 7 0 0014 0c0-4-2-7-3-8 0 3-1.5 5-3 5 0-5 2-9-1-16z" fill="#f97316" />
    </svg>
  );
}

const apps = [
  { href: "/kasa", label: "KBYTE", icon: <KbyteIcon /> },
  { href: "/kalori", label: "Kalori Ölçer", icon: <FlameIcon /> },
];

export default function Desktop() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: wallpaper, ...xpFont }}>
      <div className="flex gap-4 p-4" onClick={() => setMenuOpen(false)}>
        {apps.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className="flex w-24 flex-col items-center gap-1 rounded p-2 text-center text-[13px] text-white hover:bg-[#316ac5]/40 focus:bg-[#316ac5]/60 outline-none"
            style={{ textShadow: "1px 1px 2px #000" }}
          >
            {app.icon}
            <span>{app.label}</span>
          </Link>
        ))}
      </div>

      {menuOpen && (
        <div className="absolute bottom-10 left-0 w-64 overflow-hidden rounded-tr-lg border border-[#0831d9] bg-white shadow-2xl">
          <div className="bg-gradient-to-b from-[#1868ce] to-[#0e4fb5] px-3 py-3 font-bold text-white">Kullanıcı</div>
          {[
            ...apps.map((app) => ({ label: app.label, action: () => router.push(app.href) })),
            { label: "Şifre Değiştir", action: () => setPasswordOpen(true) },
            { label: "Çıkış Yap", action: logout },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                item.action();
              }}
              className="block w-full px-4 py-2 text-left text-[13px] text-gray-800 hover:bg-[#316ac5] hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-between bg-gradient-to-b from-[#3168d5] via-[#245edb] to-[#1941a5]">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="h-full rounded-r-xl bg-gradient-to-b from-[#3c9a3c] to-[#2c7d2c] px-5 text-lg font-bold italic text-white hover:brightness-110"
          style={{ textShadow: "1px 1px 1px #000" }}
        >
          başlat
        </button>
        <div className="flex h-full items-center border-l border-[#0f3e9a] bg-[#0f8ff0]/60 px-4 text-[13px] text-white">{time}</div>
      </div>

      {passwordOpen && <PasswordWindow onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function PasswordWindow({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) {
      setMessage({ ok: false, text: "Yeni şifreler aynı değil." });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setLoading(false);
    setMessage({ ok: Boolean(res?.ok), text: data?.message ?? "Sunucuya ulaşılamadı." });
    if (res?.ok) {
      setCurrent("");
      setNext("");
      setRepeat("");
    }
  };

  const field = "w-full border border-[#7f9db9] bg-white px-2 py-1 text-[13px] text-black outline-none";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20 px-4">
      <form onSubmit={submit} className="w-full max-w-xs overflow-hidden rounded-t-lg border-2 border-[#0831d9] bg-[#ece9d8] shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-b from-[#0a5ce6] to-[#0841b8] px-2 py-1 text-[13px] font-bold text-white">
          <span>Şifre Değiştir</span>
          <button type="button" onClick={onClose} aria-label="Kapat" className="h-5 w-5 rounded-sm border border-white bg-[#e2582b] text-xs leading-none">
            ✕
          </button>
        </div>
        <div className="space-y-2 p-4 text-[13px] text-black">
          <label className="block">
            Mevcut şifre
            <input type="password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} className={field} />
          </label>
          <label className="block">
            Yeni şifre (en az 8 karakter)
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={field} />
          </label>
          <label className="block">
            Yeni şifre tekrar
            <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={field} />
          </label>
          {message && <p className={message.ok ? "text-green-700" : "text-red-700"}>{message.text}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" disabled={loading || !current || !next} className="min-w-20 rounded border border-[#003c74] bg-white px-3 py-1 hover:bg-[#fff5d6] disabled:opacity-50">
              Tamam
            </button>
            <button type="button" onClick={onClose} className="min-w-20 rounded border border-[#003c74] bg-white px-3 py-1 hover:bg-[#fff5d6]">
              İptal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
