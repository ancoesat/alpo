"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/components/icons";

interface MonthPreview {
  month: string;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  totalIncurredDebt: number;
  netBalance: number;
  rowCount: number;
}

interface RowError {
  lineNumber: number;
  message: string;
}

interface ImportPreview {
  totalRows: number;
  incomeRows: number;
  expenseRows: number;
  investmentRows: number;
  cardExpenseRows: number;
  months: MonthPreview[];
  unknownTickers: string[];
  unknownBanks: string[];
  errors: RowError[];
  warnings: string[];
  canCommit: boolean;
}

interface AssetOption {
  id: number;
  ticker: string;
  name: string;
}

interface AssetAnswer {
  ticker: string;
  mapToAssetId: string; // "" = yeni varlık yarat
  name: string;
  category: string;
  currentPrice: string;
}

interface ImportResult {
  batchId: number;
  importedRows: number;
  createdAssets: number;
  message: string;
}

const CATEGORIES = ["Döviz", "Fon", "Emtia", "Hisse", "Nakit", "Diğer"];

const tr = (n: number) =>
  Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportExportMenu({ onImported }: { onImported?: () => void }) {
  const apiBaseUrl = "/api/backend"; // same-origin proxy, keeps the API key server-side

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<null | "import" | "export">(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- import state ---
  const [step, setStep] = useState<"file" | "preview" | "questions" | "done">("file");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [answers, setAnswers] = useState<AssetAnswer[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // --- export state ---
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  // Menü dışına tıklayınca kapat
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const resetImport = () => {
    setStep("file");
    setCsv("");
    setFileName("");
    setPreview(null);
    setAnswers([]);
    setResult(null);
    setError("");
  };

  const closeModal = () => {
    setMode(null);
    resetImport();
  };

  // ---------- EXPORT ----------
  const handleExport = async (what: "transactions" | "assets") => {
    setBusy(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (what === "transactions") {
        if (exportFrom) params.set("from", `${exportFrom}T00:00:00`);
        if (exportTo) params.set("to", `${exportTo}T23:59:59`);
      }

      const qs = params.toString();
      const res = await fetch(`${apiBaseUrl}/api/Export/${what}${qs ? `?${qs}` : ""}`);

      if (!res.ok) {
        setError("Dışa aktarma başarısız oldu.");
        return;
      }

      const blob = await res.blob();

      // Dosya adını Content-Disposition'dan oku, yoksa varsayılan ver
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const name = match ? decodeURIComponent(match[1]) : `kbyte-${what}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      closeModal();
    } catch (err) {
      console.error("Export hatası:", err);
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  };

  // ---------- IMPORT ----------
  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setError("");
    await runAnalyze(text, file.name);
  };

  const runAnalyze = async (csvText: string, name: string) => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/Import/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, fileName: name }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.message ?? "Dosya analiz edilemedi.");
        return;
      }

      const data = body as ImportPreview;
      setPreview(data);

      setAnswers(
        (data.unknownTickers ?? []).map((ticker) => ({
          ticker,
          mapToAssetId: "",
          name: ticker,
          category: "Döviz",
          currentPrice: "0",
        }))
      );

      // "Mevcut varlığa eşle" seçeneği için varlık listesi
      if ((data.unknownTickers ?? []).length > 0) {
        try {
          const aRes = await fetch(`${apiBaseUrl}/api/Dashboard/assets`);
          if (aRes.ok) setAssets(await aRes.json());
        } catch {
          /* liste gelmezse sadece "yeni yarat" seçeneği kalır */
        }
      }

      setStep("preview");
    } catch (err) {
      console.error("Analyze hatası:", err);
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/Import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv,
          fileName,
          newAssets: answers.map((a) => ({
            ticker: a.ticker,
            mapToAssetId: a.mapToAssetId === "" ? null : Number(a.mapToAssetId),
            name: a.name,
            category: a.category,
            currentPrice: Number.parseFloat(a.currentPrice) || 0,
          })),
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.message ?? "İçe aktarma başarısız oldu.");
        return;
      }

      setResult(body as ImportResult);
      setStep("done");
      onImported?.();
    } catch (err) {
      console.error("Commit hatası:", err);
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const undoBatch = async () => {
    if (!result) return;
    if (!window.confirm("Bu içe aktarmayla gelen tüm işlemler silinecek. Emin misiniz?")) return;

    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/Import/batch/${result.batchId}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);

      if (res.ok) {
        onImported?.();
        closeModal();
      } else {
        setError(body?.message ?? "Geri alma başarısız oldu.");
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const updateAnswer = (ticker: string, patch: Partial<AssetAnswer>) => {
    setAnswers((prev) => prev.map((a) => (a.ticker === ticker ? { ...a, ...patch } : a)));
  };

  const needsQuestions = (preview?.unknownTickers?.length ?? 0) > 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title="İçe / Dışa Aktar"
        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-gray-300 px-3 py-2 rounded transition-colors flex items-center"
      >
        <DownloadIcon />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode("import"); setMenuOpen(false); resetImport(); }}
            className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-zinc-900 hover:text-emerald-400 transition-colors"
          >
            İçe Aktar
          </button>
          <button
            type="button"
            onClick={() => { setMode("export"); setMenuOpen(false); setError(""); }}
            className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gray-300 hover:bg-zinc-900 hover:text-emerald-400 transition-colors border-t border-zinc-900"
          >
            Dışa Aktar
          </button>
        </div>
      )}

      {/* ---------- EXPORT MODAL ---------- */}
      {mode === "export" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl text-zinc-200">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-mono font-semibold text-emerald-400">DIŞA AKTAR</h3>
              <button type="button" onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 text-xs font-mono px-2 py-1 bg-zinc-900 rounded">[Kapat]</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">BAŞLANGIÇ</label>
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">BİTİŞ</label>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mb-5">Boş bırakırsan tüm kayıtlar aktarılır.</p>

            {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => handleExport("transactions")} disabled={busy}
                className="w-full py-2.5 rounded text-xs font-mono bg-emerald-600 text-zinc-950 font-bold hover:bg-emerald-500 transition-all disabled:opacity-50">
                {busy ? "Hazırlanıyor..." : "İşlemleri İndir (CSV)"}
              </button>
              <button type="button" onClick={() => handleExport("assets")} disabled={busy}
                className="w-full py-2.5 rounded text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 transition-all disabled:opacity-50">
                Varlık Listesini İndir (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- IMPORT MODAL ---------- */}
      {mode === "import" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-xl p-6 shadow-2xl text-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-mono font-semibold text-emerald-400">
                İÇE AKTAR
                <span className="text-zinc-600 ml-2">
                  {step === "file" && "1/3 · Dosya"}
                  {step === "preview" && "2/3 · Önizleme"}
                  {step === "questions" && "3/3 · Sorular"}
                  {step === "done" && "Tamamlandı"}
                </span>
              </h3>
              <button type="button" onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 text-xs font-mono px-2 py-1 bg-zinc-900 rounded">[Kapat]</button>
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-4 bg-red-950/30 border border-red-900/50 p-2.5 rounded">{error}</p>
            )}

            {/* ADIM 1 — DOSYA */}
            {step === "file" && (
              <div>
                <label className="block border-2 border-dashed border-zinc-800 rounded-lg p-10 text-center cursor-pointer hover:border-emerald-800 transition-colors">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                  <span className="text-xs text-zinc-400 font-mono block mb-1">
                    {busy ? "Analiz ediliyor..." : "CSV dosyası seç"}
                  </span>
                  <span className="text-[10px] text-zinc-600">Hiçbir şey kaydedilmez — önce önizleme göreceksin.</span>
                </label>
              </div>
            )}

            {/* ADIM 2 — ÖNİZLEME */}
            {step === "preview" && preview && (
              <div className="space-y-5">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Gelir", value: preview.incomeRows },
                    { label: "Gider", value: preview.expenseRows },
                    { label: "Yatırım", value: preview.investmentRows },
                    { label: "Kart", value: preview.cardExpenseRows },
                  ].map((s) => (
                    <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded p-2.5">
                      <div className="text-lg font-bold text-zinc-100">{s.value}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-widest">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                    Aylık Toplamlar — kendi tablonla karşılaştır
                  </h4>
                  <div className="overflow-x-auto border border-zinc-800 rounded">
                    <table className="w-full text-[11px] font-mono">
                      <thead className="bg-zinc-900 text-zinc-500">
                        <tr>
                          <th className="text-left p-2">Ay</th>
                          <th className="text-right p-2">Gelir</th>
                          <th className="text-right p-2">Gider</th>
                          <th className="text-right p-2">Yatırım</th>
                          <th className="text-right p-2">Kasa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {preview.months.map((m) => (
                          <tr key={m.month}>
                            <td className="p-2 text-zinc-300">{m.month}</td>
                            <td className="p-2 text-right text-emerald-400">{tr(m.totalIncome)}</td>
                            <td className="p-2 text-right text-red-400">{tr(m.totalExpense)}</td>
                            <td className="p-2 text-right text-blue-400">{tr(m.totalInvestment)}</td>
                            <td className="p-2 text-right text-zinc-100 font-bold">{tr(m.netBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {preview.errors.length > 0 && (
                  <div className="bg-red-950/30 border border-red-900/50 rounded p-3">
                    <h4 className="text-[10px] text-red-400 uppercase tracking-widest mb-2">Hatalar — düzeltilmeden aktarılamaz</h4>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {preview.errors.map((e, i) => (
                        <li key={i} className="text-[11px] text-red-300 font-mono">Satır {e.lineNumber}: {e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded p-3">
                    <h4 className="text-[10px] text-amber-400 uppercase tracking-widest mb-2">Uyarılar</h4>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {preview.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] text-amber-300/80 font-mono">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.unknownBanks.length > 0 && (
                  <p className="text-[11px] text-amber-400">
                    Tanınmayan banka: {preview.unknownBanks.join(", ")} — bu satırlar bankasız aktarılır.
                  </p>
                )}

                <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
                  <button type="button" onClick={resetImport} className="px-4 py-2 rounded text-xs font-mono text-zinc-400 hover:bg-zinc-900 transition-colors">
                    Başka dosya
                  </button>
                  <button
                    type="button"
                    disabled={!preview.canCommit || busy}
                    onClick={() => (needsQuestions ? setStep("questions") : runCommit())}
                    className="px-5 py-2 rounded text-xs font-mono bg-emerald-600 text-zinc-950 font-bold hover:bg-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {needsQuestions ? `Devam (${preview.unknownTickers.length} soru)` : `${preview.totalRows} işlemi aktar`}
                  </button>
                </div>
              </div>
            )}

            {/* ADIM 3 — SORULAR */}
            {step === "questions" && (
              <div className="space-y-4">
                <p className="text-[11px] text-zinc-500">
                  Bu varlıklar veritabanında yok. Her biri için ya yeni kayıt oluştur ya da mevcut bir varlığa eşle.
                </p>

                {answers.map((a) => (
                  <div key={a.ticker} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-emerald-400">{a.ticker}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">NE YAPILSIN?</label>
                      <select
                        value={a.mapToAssetId}
                        onChange={(e) => updateAnswer(a.ticker, { mapToAssetId: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Yeni varlık oluştur</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            Mevcut varlığa eşle: {asset.ticker} — {asset.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {a.mapToAssetId === "" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">İSİM</label>
                          <input type="text" value={a.name} onChange={(e) => updateAnswer(a.ticker, { name: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">KATEGORİ</label>
                          <select value={a.category} onChange={(e) => updateAnswer(a.ticker, { category: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500">
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">GÜNCEL FİYAT (TRY)</label>
                          <input type="number" step="any" value={a.currentPrice}
                            onChange={(e) => updateAnswer(a.ticker, { currentPrice: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 font-mono text-xs text-emerald-400 text-right focus:outline-none focus:border-emerald-500" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
                  <button type="button" onClick={() => setStep("preview")} className="px-4 py-2 rounded text-xs font-mono text-zinc-400 hover:bg-zinc-900 transition-colors">
                    Geri
                  </button>
                  <button type="button" onClick={runCommit} disabled={busy}
                    className="px-5 py-2 rounded text-xs font-mono bg-emerald-600 text-zinc-950 font-bold hover:bg-emerald-500 transition-all disabled:opacity-50">
                    {busy ? "Aktarılıyor..." : `${preview?.totalRows ?? 0} işlemi aktar`}
                  </button>
                </div>
              </div>
            )}

            {/* ADIM 4 — SONUÇ */}
            {step === "done" && result && (
              <div className="space-y-5">
                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded p-4 text-center">
                  <p className="text-sm text-emerald-400 font-mono font-bold">{result.message}</p>
                  {result.createdAssets > 0 && (
                    <p className="text-[11px] text-emerald-300/70 mt-1">{result.createdAssets} yeni varlık oluşturuldu.</p>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
                  <button type="button" onClick={undoBatch} disabled={busy}
                    className="px-4 py-2 rounded text-xs font-mono text-red-400 border border-red-900/50 hover:bg-red-950/30 transition-colors disabled:opacity-50">
                    İçe aktarmayı geri al
                  </button>
                  <button type="button" onClick={closeModal}
                    className="px-5 py-2 rounded text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 transition-all">
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
