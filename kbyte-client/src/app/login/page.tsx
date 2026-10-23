"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Google sign-in comes back here with ?error=... when it fails.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "google") setError("Bu Google hesabıyla giriş yapılamaz.");
    if (code === "google-off") setError("Google ile giriş henüz ayarlanmadı.");
  }, []);

  // "Raining dollar signs" background — a small canvas animation, Matrix-rain
  // style but with $ characters, in the site's existing emerald accent color.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    const fontSize = 84; // bigger, so the $ shapes actually read as dollar signs
    const fallSpeed = 0.25 / 3; // fraction of a row per frame -> much slower descent
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -40);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      // Translucent fill instead of a hard clear -> soft fading trails.
      ctx.fillStyle = "rgba(10, 10, 10, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const isBright = Math.random() > 0.95;
        ctx.fillStyle = isBright ? "#6ee7b7" : "#10b981"; // emerald-300 / emerald-500
        ctx.fillText("$", i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }
        drops[i] += fallSpeed;
      }

      animationFrameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, remember }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Giriş başarısız.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center font-mono">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm mx-4 rounded-lg border border-[#1e1e1e] bg-[#121212]/95 backdrop-blur-sm p-6 shadow-2xl border-t-4 border-t-[#10B981]"
      >
        <h1 className="text-xl font-bold text-gray-200 tracking-wider mb-1">KBYTE KASA</h1>
        <p className="text-xs text-gray-500 mb-6">Devam etmek için şifreni gir.</p>

        <label className="block text-[10px] text-gray-500 mb-2 font-bold tracking-wider" htmlFor="password">
          ŞİFRE
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white rounded p-3 outline-none focus:border-[#10B981] placeholder-gray-700 mb-4"
          placeholder="••••••••"
        />

        <label className="flex items-center gap-2 text-xs text-gray-400 mb-6 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-[#1e1e1e] bg-[#0a0a0a] accent-emerald-500"
          />
          Keep me logged in for 30 days
        </label>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full py-3 bg-[#1e1e1e] text-[#10B981] border border-[#1e1e1e] hover:border-[#10B981] hover:bg-emerald-900/10 font-bold rounded tracking-widest uppercase transition-colors disabled:opacity-50"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <a
          href="/api/auth/google"
          className="mt-3 block w-full py-3 text-center bg-white text-gray-800 font-bold rounded tracking-wider hover:bg-gray-200 transition-colors"
        >
          Google ile giriş yap
        </a>
      </form>
    </div>
  );
}
