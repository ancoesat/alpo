"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link"; // Başka sayfalara yönlendirme için
import { PortfolioIcon, BankIcon } from "@/components/icons";
import ImportExportMenu from "@/components/ImportExportMenu";

interface TransactionItem {
  id: number;
  transactionDate: string;
  type: number;
  amountTRY: number;
  description: string;
  quantity: number | null;
  assetTicker?: string;  // Backend'den FK ile güvenli gelir
  bankName?: string | null;
}

// YENİ: Kur Motoru arayüz sözleşmesi
interface LiveRate {
  asset: string;
  currentPrice: number;
}

export default function Home() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const apiBaseUrl = "/api/backend"; // same-origin proxy, keeps the API key server-side

  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    totalInvestment: number;
    totalIncurredDebt: number;
    netBalance: number;
    transactions: TransactionItem[];
  }>({
    totalIncome: 0, totalExpense: 0, totalInvestment: 0, totalIncurredDebt: 0, netBalance: 0,
    transactions: []
  });

  // YENİ: Kur Motoru State'i
  const [liveRates, setLiveRates] = useState<LiveRate[]>([]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/Dashboard/monthly-summary?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error("Kasa ile iletişim koptu:", err);
    }
  }, [apiBaseUrl, selectedYear, selectedMonth]);

  // YENİ: Canlı Kurları Çekme Fonksiyonu
  const fetchLiveRates = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/Dashboard/live-rates`);
      if (res.ok) {
        const data = await res.json();
        setLiveRates(data);
      }
    } catch (err) {
      console.error("Kur motoru iletişim hatası:", err);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummary();
  }, [loadSummary]);

  // YENİ: Kurları sayfa ilk yüklendiğinde bir kez çeker (Aylık filtrelemeden etkilenmez)
  useEffect(() => {
    fetchLiveRates();
  }, [fetchLiveRates]);

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Bu işlemi kasadan kalıcı olarak silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/Dashboard/transaction/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadSummary();
      } else {
        alert("İşlem silinirken kasada bir hata oluştu.");
      }
    } catch (err) {
      console.error("Silme isteği başarısız:", err);
    }
  };

  const getTypeColor = (type: number) => {
    if (type === 0) return "text-emerald-400";
    if (type === 1) return "text-red-500";
    if (type === 3) return "text-amber-400";   // Kart harcaması — nakit çıkışı değil
    return "text-blue-400";
  };

  return (
    <>
      <main className="min-h-screen bg-[#0a0a0a] p-4 md:p-6 lg:p-8 xl:p-10 font-mono text-gray-400 pb-24 md:pb-8 max-w-screen-2xl w-full mx-auto">
        <header className="mb-8 lg:mb-10 border-b border-[#1e1e1e] pb-4 flex flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-200 tracking-wider">KBYTE</h1>
            <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">Da Workspace / Dashboard</p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <div className="flex gap-2">
              <Link href="/portfolio" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-2 rounded transition-colors duration-300 text-xs md:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <PortfolioIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Portefeuille</span>
              </Link>

              <Link href="/bankalar" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-gray-300 font-bold px-3 py-2 rounded transition-colors duration-300 text-xs md:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <BankIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Bankalar</span>
              </Link>

              <Link href="/ekle" className="bg-emerald-600 hover:bg-emerald-500 text-[#0a0a0a] font-bold px-3 py-2 rounded transition-colors duration-300 text-xs md:text-sm uppercase tracking-wider flex items-center gap-1">
                <span className="sm:hidden">+</span>
                <span className="hidden sm:inline">+ YENİ İŞLEM</span>
              </Link>

              <ImportExportMenu onImported={loadSummary} />
            </div>

            <div className="flex gap-2 ml-auto sm:ml-0">
              <select className="bg-[#121212] border border-[#1e1e1e] text-gray-300 text-xs md:text-sm rounded outline-none p-2" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{i+1}. Ay</option>))}
              </select>

              <select className="bg-[#121212] border border-[#1e1e1e] text-gray-300 text-xs md:text-sm rounded outline-none p-2" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                <option value={2025}>2025</option><option value={2026}>2026</option><option value={2027}>2027</option>
              </select>
            </div>
          </div>
        </header>

        {/* MALI DURUM KARTLARI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-emerald-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Gelir</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{summary.totalIncome.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-red-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Gider</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{summary.totalExpense.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-blue-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Yatırım</h2>
            <p className="text-2xl font-light text-gray-200 mt-2">{summary.totalInvestment.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-gray-400">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Likit Kasa</h2>
            <p className="text-2xl font-bold text-white mt-2">{summary.netBalance.toLocaleString('tr-TR')} ₺</p>
          </div>
          <div className="bg-[#121212] p-4 md:p-6 rounded border border-[#1e1e1e] border-t-2 border-t-amber-500">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Edinilen Borç</h2>
            <p className="text-2xl font-light text-amber-400 mt-2">{(summary.totalIncurredDebt ?? 0).toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>

        {/* YENİ: CANLI PİYASA MOTORU WIDGET */}
        <div className="bg-[#121212] rounded border border-[#1e1e1e] p-5 md:p-6 mb-6 lg:mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
          
          <div className="flex justify-between items-center mb-5 border-b border-[#1e1e1e] pb-3">
            <h2 className="text-xs md:text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Canlı Kur Motoru
            </h2>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest hidden md:block">Otonom Veri Hattı</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {liveRates.length === 0 ? (
              <p className="text-xs text-gray-600 col-span-full font-mono animate-pulse">Piyasa verisi senkronize ediliyor...</p>
            ) : (
              liveRates.map((rate, index) => (
                <div key={index} className="bg-[#0a0a0a] border border-[#1e1e1e] p-3 md:p-4 rounded flex flex-col justify-center items-center hover:border-[#2a2a2a] transition-all group">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 group-hover:text-gray-400 transition-colors">
                    {rate.asset}
                  </span>
                  <span className="text-sm md:text-lg font-light text-gray-200">
                    {Number(rate.currentPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* İşlem Listesi (Ledger Görünümü) */}
        <div className="bg-[#121212] rounded border border-[#1e1e1e] overflow-hidden">
          <div className="hidden md:grid grid-cols-5 gap-4 p-4 border-b border-[#1e1e1e] bg-[#0a0a0a] text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div>Tarih</div>
            <div className="col-span-2">Açıklama</div>
            <div className="text-right">Tutar</div>
            <div className="text-right">İşlem</div>
          </div>
          
          <div className="divide-y divide-[#1e1e1e] max-h-125 overflow-y-auto">
            {summary.transactions.length === 0 ? (
              <p className="p-6 text-center text-gray-600 text-sm">Bu ay için kayıt bulunamadı.</p>
            ) : (
              summary.transactions.map((t) => {
                const assetBadge = t.assetTicker ?? null;  // FK üzerinden güvenli, string parse yok

                return (
                  <div key={t.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 p-4 items-center hover:bg-[#1a1a1a] transition-colors text-sm border-b border-[#1e1e1e] last:border-0">
                    <div className="text-gray-500 font-medium tracking-wide order-2 md:order-1">
                      {new Date(t.transactionDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="col-span-2 text-gray-300 flex flex-wrap items-center gap-3 order-1 md:order-2">
                      {assetBadge && (
                        <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded border border-emerald-800/50 text-xs font-bold tracking-wider uppercase">
                          {assetBadge}
                        </span>
                      )}
                      <span>{t.description}</span>

                      {t.bankName && (
                        <span className="bg-zinc-900 text-zinc-400 px-2.5 py-1 rounded border border-zinc-700 text-[10px] font-bold tracking-wider uppercase">
                          {t.type === 3 ? "KART" : "ÖDEME"} · {t.bankName}
                        </span>
                      )}

                      {t.type === 2 && t.quantity && (
                        <span className="text-xs text-blue-400 bg-blue-950 px-2.5 py-1 rounded border border-blue-900/50 font-medium">
                          {t.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Adet
                        </span>
                      )}
                    </div>

                    <div className={`text-right font-bold tracking-wider ${getTypeColor(t.type)} order-2 md:order-3`}>
                      {t.type === 1 ? "-" : ""}{t.amountTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </div>

                    <div className="text-right col-span-2 md:col-span-1 order-3 md:order-4">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition-all text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-[#262626] hover:border-red-900"
                        title="İşlemi Kasadan Sil"
                      >
                        SİL
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </>
  );
}