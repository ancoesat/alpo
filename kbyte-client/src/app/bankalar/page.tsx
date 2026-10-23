"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EditIcon, TrashIcon, PlusIcon } from "@/components/icons";

interface BankAccount {
  id: number;
  name: string;
  cardLimit: number;
  debt: number;
  minimumPayment: number;      // borçtan türetilir (%20)
  remainingLimit: number;      // limit - borç
  statementDayOfMonth: number | null;
  brandColor: string;
  interestRate: number | null; // sabit, banka bazında — şimdilik bilgi amaçlı
}

const DEFAULT_NEW_BANK_COLOR = "#6B7280";

// Asgari ödeme oranı — backend'deki BankAccount.MinimumPaymentRate ile aynı olmalı
const MINIMUM_PAYMENT_RATE = 0.20;

// Son ödeme, hesap kesiminden 10 gün sonrasıdır.
const DAYS_AFTER_STATEMENT = 10;

// Ayın kaçı olduğunu o ayın uzunluğuna göre kırp: 31'i seçilmişse Şubat'ta 28/29 olur.
function statementDateIn(year: number, monthIndex: number, day: number) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDayOfMonth));
}

// Sıradaki son ödeme tarihi.
// Önce bir önceki hesap kesiminin son ödemesine bakar: henüz geçmediyse o gösterilir
// (ayın 3'ünde kesildiyse 13'üne kadar ödenecek olan borç hâlâ duruyordur).
// Geçtiyse, bir sonraki hesap kesimine + 10 gün.
function nextDueDate(day: number, today = new Date()): Date {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const thisMonthStatement = statementDateIn(today.getFullYear(), today.getMonth(), day);

  // En son gerçekleşmiş hesap kesimi
  const lastStatement = thisMonthStatement <= startOfToday
    ? thisMonthStatement
    : statementDateIn(today.getFullYear(), today.getMonth() - 1, day);

  const dueFromLast = addDays(lastStatement, DAYS_AFTER_STATEMENT);
  if (dueFromLast >= startOfToday) return dueFromLast;

  // O ödeme de geçmişse sıradaki hesap kesimine bak
  const nextStatement = thisMonthStatement > startOfToday
    ? thisMonthStatement
    : statementDateIn(today.getFullYear(), today.getMonth() + 1, day);

  return addDays(nextStatement, DAYS_AFTER_STATEMENT);
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

const daysUntil = (d: Date) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - start.getTime()) / 86400000);
};

export default function BanksPage() {
  const apiBaseUrl = "/api/backend"; // same-origin proxy, keeps the API key server-side

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  // Kalan limit ve asgari, kart limiti + borçtan otomatik hesaplanır.
  const [form, setForm] = useState({
    name: "",
    brandColor: DEFAULT_NEW_BANK_COLOR,
    cardLimit: "",
    debt: "",
    statementDayOfMonth: "",
    interestRate: "",
  });

  const loadBanks = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/Banks`);
      if (!res.ok) throw new Error("Banks fetch failed");
      const data: BankAccount[] = await res.json();
      setBanks(data);
    } catch (err) {
      console.error("Banka verisi çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBanks();
  }, [loadBanks]);

  const openEditor = (bank: BankAccount) => {
    setEditing(bank);
    setIsCreating(false);
    setMessage("");
    setForm({
      name: bank.name,
      brandColor: bank.brandColor || DEFAULT_NEW_BANK_COLOR,
      cardLimit: String(bank.cardLimit ?? 0),
      debt: String(bank.debt ?? 0),
      statementDayOfMonth: bank.statementDayOfMonth != null ? String(bank.statementDayOfMonth) : "",
      interestRate: bank.interestRate != null ? String(bank.interestRate) : "",
    });
  };

  const openCreator = () => {
    setEditing(null);
    setIsCreating(true);
    setMessage("");
    setForm({
      name: "",
      brandColor: DEFAULT_NEW_BANK_COLOR,
      cardLimit: "",
      debt: "",
      statementDayOfMonth: "",
      interestRate: "",
    });
  };

  const closeEditor = () => {
    setEditing(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editing && !isCreating) return;
    if (!form.name.trim()) {
      setMessage("Banka adı zorunludur.");
      return;
    }
    setSaving(true);
    setMessage("");

    const payload = {
      name: form.name.trim(),
      brandColor: form.brandColor,
      cardLimit: Number.parseFloat(form.cardLimit) || 0,
      debt: Number.parseFloat(form.debt) || 0,
      statementDayOfMonth:
        form.statementDayOfMonth.trim() === "" ? null : Number.parseInt(form.statementDayOfMonth, 10),
      interestRate: form.interestRate.trim() === "" ? null : Number.parseFloat(form.interestRate),
    };

    try {
      const res = isCreating
        ? await fetch(`${apiBaseUrl}/api/Banks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`${apiBaseUrl}/api/Banks/${editing!.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const body = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(body?.message ?? "Kaydedildi.");
        await loadBanks();
        setTimeout(() => closeEditor(), 600);
      } else {
        setMessage(body?.message ?? "Kaydetme başarısız oldu.");
      }
    } catch (err) {
      console.error("Banka kaydedilemedi:", err);
      setMessage("Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bank: BankAccount) => {
    if (!window.confirm(`${bank.name} silinsin mi? Bu işlem geri alınamaz.`)) return;

    setDeletingId(bank.id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/Banks/${bank.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        await loadBanks();
      } else {
        alert(body?.message ?? "Silme başarısız oldu.");
      }
    } catch (err) {
      console.error("Banka silinemedi:", err);
      alert("Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setDeletingId(null);
    }
  };

  // Modal açıkken kullanıcı yazdıkça güncellenen türetilmiş değerler
  const previewLimitNum = Number.parseFloat(form.cardLimit) || 0;
  const previewDebtNum = Number.parseFloat(form.debt) || 0;
  const previewRemaining = Math.max(0, previewLimitNum - previewDebtNum);
  const previewMinimum = Math.round(previewDebtNum * MINIMUM_PAYMENT_RATE * 100) / 100;
  const previewDayNum = Number.parseInt(form.statementDayOfMonth, 10);
  const previewDue =
    Number.isFinite(previewDayNum) && previewDayNum >= 1 && previewDayNum <= 31
      ? nextDueDate(previewDayNum)
      : null;

  const totalDebt = banks.reduce((sum, b) => sum + (Number(b.debt) || 0), 0);
  const totalMinimum = banks.reduce((sum, b) => sum + (Number(b.minimumPayment) || 0), 0);
  const totalLimit = banks.reduce((sum, b) => sum + (Number(b.cardLimit) || 0), 0);
  const utilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] p-8 font-mono text-gray-600">Banka kayıtları okunuyor...</div>;
  }

  return (
    <>
      <main className="min-h-screen bg-[#0a0a0a] p-4 md:p-6 lg:p-8 xl:p-10 font-mono text-gray-400 max-w-screen-2xl w-full mx-auto pb-24 md:pb-8">
        <header className="mb-8 lg:mb-10 border-b border-[#1e1e1e] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-200 tracking-wider">KBYTE</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Da Workspace / Bankalar</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <Link href="/kasa" className="text-gray-500 hover:text-white transition-colors text-sm uppercase tracking-wider">DASHBOARD</Link>
            <Link href="/portfolio" className="text-gray-500 hover:text-white transition-colors text-sm uppercase tracking-wider">PORTFÖY</Link>
            <button
              type="button"
              onClick={openCreator}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider bg-emerald-600 text-zinc-950 font-bold px-3 py-2 rounded hover:bg-emerald-500 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Yeni Banka
            </button>
          </div>
        </header>

        {/* ÜST ÖZET */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-red-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Toplam Borç</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-amber-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Toplam Asgari</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{totalMinimum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-blue-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Toplam Limit</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{totalLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-gray-400">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Kullanım Oranı</h2>
            <p className={`text-2xl font-bold mt-2 ${utilization >= 50 ? 'text-red-400' : 'text-white'}`}>
              {utilization.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* BANKA KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {banks.length === 0 ? (
            <p className="p-6 text-center text-gray-600 text-sm col-span-full">Kayıtlı banka bulunamadı.</p>
          ) : (
            banks.map((bank) => {
              const bankUtil = bank.cardLimit > 0 ? (bank.debt / bank.cardLimit) * 100 : 0;
              const dueDate = bank.statementDayOfMonth ? nextDueDate(bank.statementDayOfMonth) : null;
              const dueInDays = dueDate ? daysUntil(dueDate) : null;
              const dueSoon = dueInDays !== null && dueInDays <= 7;

              return (
                <div
                  key={bank.id}
                  className="bg-[#121212] rounded border border-[#1e1e1e] p-5 relative overflow-hidden hover:border-[#2a2a2a] transition-colors"
                >
                  {/* Marka rengi şeridi */}
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ background: bank.brandColor }}></div>

                  <div className="flex justify-between items-start mb-4 pl-2">
                    <div>
                      <h3 className="text-base font-bold tracking-wider uppercase" style={{ color: bank.brandColor }}>
                        {bank.name}
                      </h3>
                      {bank.statementDayOfMonth && (
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                          Hesap Kesimi: Ayın {bank.statementDayOfMonth}&apos;i
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditor(bank)}
                        title="Düzenle"
                        className="text-gray-600 hover:text-emerald-400 transition-colors p-1.5 rounded border border-[#262626] hover:border-emerald-900"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(bank)}
                        disabled={deletingId === bank.id}
                        title="Sil"
                        className="text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded border border-[#262626] hover:border-red-900 disabled:opacity-40"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 pl-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Borç</span>
                      <span className="text-lg font-bold text-gray-100">
                        {Number(bank.debt).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Asgari</span>
                      <span className="text-sm text-amber-400">
                        {Number(bank.minimumPayment).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Kalan Limit</span>
                      <span className="text-sm text-gray-300">
                        {Number(bank.remainingLimit).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">Kart Limiti</span>
                      <span className="text-sm text-gray-400">
                        {Number(bank.cardLimit).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </span>
                    </div>

                    {bank.interestRate != null && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Faiz (Aylık)</span>
                        <span className="text-sm text-gray-400">
                          %{Number(bank.interestRate).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {dueDate && (
                      <div className={`flex justify-between items-center mt-3 px-2.5 py-2 rounded border ${
                        dueSoon
                          ? 'bg-red-950/30 border-red-900/60'
                          : 'bg-[#0a0a0a] border-[#1e1e1e]'
                      }`}>
                        <span className={`text-[10px] uppercase tracking-widest ${dueSoon ? 'text-red-400' : 'text-gray-500'}`}>
                          Son Ödeme
                        </span>
                        <span className={`text-xs font-bold ${dueSoon ? 'text-red-300' : 'text-gray-300'}`}>
                          {formatDate(dueDate)}
                          <span className={`ml-2 font-normal ${dueSoon ? 'text-red-400' : 'text-gray-600'}`}>
                            ({dueInDays} gün)
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Kullanım çubuğu */}
                    <div className="pt-2">
                      <div className="h-1.5 w-full bg-[#0a0a0a] rounded-full overflow-hidden border border-[#1e1e1e]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(bankUtil, 100)}%`,
                            background: bank.brandColor,
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[9px] text-gray-600 uppercase tracking-widest">Kullanım</span>
                        <span className="text-[9px] text-gray-500 font-bold">{bankUtil.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest">
          Bu sayfa kasa ve portföy hesaplarına dahil değildir.
        </p>
      </main>

      {/* DÜZENLEME / YENİ BANKA MODALI */}
      {(editing || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl text-zinc-200">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-mono font-semibold" style={{ color: form.brandColor }}>
                {isCreating ? "YENİ BANKA" : `${(editing?.name ?? "").toUpperCase()} — ELLE DÜZENLE`}
              </h3>
              <button
                type="button"
                onClick={closeEditor}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-mono px-2 py-1 bg-zinc-900 rounded"
              >
                [Kapat]
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">BANKA ADI</label>
                  <input
                    type="text" value={form.name}
                    placeholder="ör. Ziraat"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">RENK</label>
                  <input
                    type="color" value={form.brandColor}
                    onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                    className="h-[38px] w-14 bg-zinc-900 border border-zinc-700 rounded cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">KART LİMİTİ (TRY)</label>
                <input
                  type="number" step="any" value={form.cardLimit}
                  onChange={(e) => setForm({ ...form, cardLimit: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">BORÇ (TRY)</label>
                <input
                  type="number" step="any" value={form.debt}
                  onChange={(e) => setForm({ ...form, debt: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Türetilen alanlar — elle girilmez, yukarıdaki ikisinden hesaplanır */}
              <div className="grid grid-cols-2 gap-3 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
                <div>
                  <span className="block text-[10px] text-zinc-500 mb-1 font-bold tracking-wider">KALAN LİMİT</span>
                  <span className="font-mono text-sm text-zinc-300 tabular-nums">
                    {previewRemaining.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-500 mb-1 font-bold tracking-wider">
                    ASGARİ ÖDEME (%{Math.round(MINIMUM_PAYMENT_RATE * 100)})
                  </span>
                  <span className="font-mono text-sm text-amber-400 tabular-nums">
                    {previewMinimum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
                <p className="col-span-2 text-[10px] text-zinc-600 leading-relaxed">
                  Bu iki değer otomatik hesaplanır ve kaydedilir.
                </p>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">HESAP KESİM GÜNÜ (1-31)</label>
                <input
                  type="number" min="1" max="31" step="1" value={form.statementDayOfMonth}
                  placeholder="3"
                  onChange={(e) => setForm({ ...form, statementDayOfMonth: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
                {previewDue && (
                  <p className="text-[10px] text-zinc-500 mt-1.5">
                    Sıradaki son ödeme: <span className="text-zinc-300">{formatDate(previewDue)}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold tracking-wider">FAİZ ORANI (AYLIK, %) — İSTEĞE BAĞLI</label>
                <input
                  type="number" step="any" min="0" value={form.interestRate}
                  placeholder="ör. 4.25"
                  onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-zinc-600 mt-1.5">
                  Şimdilik sadece bilgi amaçlı gösterilir, borca otomatik işlenmez.
                </p>
              </div>
            </div>

            {message && (
              <p className="mt-4 text-center text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 py-1.5 rounded">
                {message}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={closeEditor}
                className="px-4 py-2 rounded text-xs font-mono text-zinc-400 hover:bg-zinc-900 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded text-xs font-mono bg-emerald-600 text-zinc-950 font-bold hover:bg-emerald-500 transition-all disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
