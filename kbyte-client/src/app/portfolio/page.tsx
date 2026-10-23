"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

// Arayüz gerçeğe uyarlandı: currentPrice eklendi.
interface PortfolioAsset {
  id: number;
  asset: string;
  totalQuantity: number;
  totalCostTRY: number;
  averageCost: number;
  currentPrice: number;
  // Backend kronolojik yürüyüşle hesaplar — frontend artık kendi matematiğini yapmaz.
  marketValue: number;
  unrealized: number;
  realized: number;
  isClosed: boolean;
}

interface AssetOption {
  id: number;
  ticker: string;
  name: string;
  assetCategory: string;
  currentPrice?: number;
}

// Koyu zemin (#121212) için doğrulanmış kategorik palet.
// Eski palet iki testten kalıyordu: yeşil/amber fazla açıktı, gri ise
// renk doygunluğu eşiğinin altındaydı (gri gibi okunuyordu).
const COLORS = ["#199e70", "#3987e5", "#c98500", "#d55181", "#9085e9", "#e66767"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTooltipValue = (value: any) => `${Number(value || 0).toLocaleString('tr-TR')} ₺`;

export default function PortfolioPage() {
  const [portfolioData, setPortfolioData] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState("");
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  // Geçici görünürlük filtresi. Veritabanına yazılmaz, sayfa yenilenince sıfırlanır.
  const [hiddenAssets, setHiddenAssets] = useState<string[]>([]);
  const apiBaseUrl = "/api/backend"; // same-origin proxy, keeps the API key server-side

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/Dashboard/investment-portfolio`);
      const data = await res.json();
      setPortfolioData(data);
    } catch (err) {
      console.error("Yatırım kasası ile iletişim koptu:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchAssetPrices = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/Dashboard/assets`);
      if (!res.ok) {
        throw new Error("Assets fetch failed");
      }

      const data: AssetOption[] = await res.json();
      setAssets(data);

      const priceMap: Record<string, string> = {};
      data.forEach((asset) => {
        priceMap[asset.ticker] = String(asset.currentPrice ?? 0);
      });
      setManualPrices(priceMap);
    } catch (err) {
      console.error("Varlık fiyatları yüklenemedi:", err);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (isPriceModalOpen) {
      fetchAssetPrices();
    }
  }, [fetchAssetPrices, isPriceModalOpen]);

  const handlePriceChange = (ticker: string, value: string) => {
    setManualPrices((prev) => ({ ...prev, [ticker]: value }));
  };

  const handleSaveManualPrices = async () => {
    setPriceLoading(true);
    setPriceMessage("");

    try {
      const payload: Record<string, number> = {};
      Object.entries(manualPrices).forEach(([ticker, value]) => {
        payload[ticker] = Number.parseFloat(value) || 0;
      });

      const response = await fetch(`${apiBaseUrl}/api/Dashboard/update-manual-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setPriceMessage("Kurlar başarıyla güncellendi.");
        setTimeout(() => {
          setIsPriceModalOpen(false);
          window.location.reload();
        }, 800);
      } else {
        setPriceMessage("Güncelleme başarısız oldu.");
      }
    } catch (err) {
      console.error("Manuel fiyat kaydı başarısız:", err);
      setPriceMessage("Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setPriceLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this asset?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/Dashboard/delete-asset/${assetId}`, {
        method: "DELETE",
      });

      const body = await res.json().catch(() => null);

      if (res.ok) {
        alert(body?.message ?? "Asset deleted successfully.");
        setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
        setManualPrices((prev) => {
          const next = { ...prev };
          const removedTicker = assets.find((a) => a.id === assetId)?.ticker;
          if (removedTicker) {
            delete next[removedTicker];
          }
          return next;
        });
      } else {
        alert(body?.message ?? "Delete failed.");
      }
    } catch (err) {
      console.error("Asset delete failed:", err);
      alert("Sunucu hatası. Lütfen tekrar deneyin.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Bu işlemi kasadan kalıcı olarak silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/Dashboard/transaction/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadPortfolio();
      } else {
        alert("İşlem silinirken kasada bir hata oluştu.");
      }
    } catch (err) {
      console.error("Silme isteği başarısız:", err);
    }
  };

  const isHidden = (asset: string) => hiddenAssets.includes(asset);

  const toggleAsset = (asset: string) => {
    setActiveSlice(null);   // dilim sayısı değişiyor, seçili index geçersizleşir
    setHiddenAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  };

  // Renk varlığa sabitlenir — gizlemek, satmak veya sıralama değişmesi
  // kalanların rengini DEĞİŞTİRMEZ. Ekrandaki sıra maliyete göre değiştiği
  // ve pozisyon kapanınca maliyet sıfırlandığı için, renk atamasını
  // alfabetik (hiç değişmeyen) bir sıraya bağlıyoruz.
  const colorByAsset: Record<string, string> = {};
  [...portfolioData]
    .sort((a, b) => a.asset.localeCompare(b.asset, "tr"))
    .forEach((item, index) => {
      colorByAsset[item.asset] = COLORS[index % COLORS.length];
    });

  const openPositions = portfolioData.filter((item) => !item.isClosed);
  const visiblePositions = openPositions.filter((item) => !isHidden(item.asset));

  const totalInvestedCash = visiblePositions.reduce((sum, item) => sum + (Number(item.totalCostTRY) || 0), 0);

  // Canlı değer artık backend'in hesapladığı marketValue'dan geliyor
  const totalLiveValue = visiblePositions.reduce((sum, item) => {
    const live = Number(item.marketValue) || 0;
    return sum + (live > 0 ? live : (Number(item.totalCostTRY) || 0));
  }, 0);

  // Realize edilmiş kâr/zarar: kapanmış pozisyonlar dahil, gizlenenler hariç
  const totalRealized = portfolioData
    .filter((item) => !isHidden(item.asset))
    .reduce((sum, item) => sum + (Number(item.realized) || 0), 0);

  const totalUnrealized = totalLiveValue - totalInvestedCash;

  // Grafik için sadeleştirilmiş veri: recharts'a {name, value} ver, tip kavgası olmasın
  const chartData = visiblePositions.map((item) => ({
    name: item.asset,
    value: Number(item.marketValue) || Number(item.totalCostTRY) || 0,
  }));

  // Grafikteki dilimlerin toplamı — yüzde payları buradan hesaplanır
  const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0);

  const totalPnLPercentage = totalInvestedCash > 0 
    ? (((totalLiveValue - totalInvestedCash) / totalInvestedCash) * 100)
    : 0;


  if (loading) return <div className="min-h-screen bg-[#0a0a0a] p-8 font-mono text-gray-600">Yatırım kasası analiz ediliyor...</div>;

  return (
    <>
      <main className="min-h-screen bg-[#0a0a0a] p-4 md:p-6 lg:p-8 xl:p-10 font-mono text-gray-400 max-w-screen-2xl w-full mx-auto pb-24 md:pb-8">
      <header className="mb-8 lg:mb-10 border-b border-[#1e1e1e] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-200 tracking-wider">KBYTE</h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Da Workspace / Portfolio</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <Link href="/kasa" className="text-gray-500 hover:text-white transition-colors text-sm uppercase tracking-wider">DASHBOARD</Link>
          <Link href="/bankalar" className="text-gray-500 hover:text-white transition-colors text-sm uppercase tracking-wider">BANKALAR</Link>
          <Link href="/ekle" className="bg-emerald-600 hover:bg-emerald-500 text-[#0a0a0a] font-bold px-4 py-2 rounded transition-colors text-sm uppercase tracking-wider">+ YENİ İŞLEM</Link>
          <button
            type="button"
            onClick={() => setIsPriceModalOpen(true)}
            className="px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-all text-xs font-mono uppercase tracking-wider"
          >
            ⚙️ Kurlar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-6 lg:mb-10">
        <div className="bg-[#121212] p-6 rounded border border-[#1e1e1e] border-l-4 border-l-blue-500 col-span-1 flex flex-col justify-center space-y-6">
          <div>
            <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Toplam Yatırılan Nakit (Anapara)</h2>
            <p className="text-2xl font-light text-gray-400 mt-1">{totalInvestedCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="border-t border-[#1e1e1e] pt-4">
            <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest flex justify-between items-center">
              Güncel Portföy Değeri
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totalPnLPercentage >= 0 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                {totalPnLPercentage >= 0 ? '+' : ''}{totalPnLPercentage.toFixed(2)}%
              </span>
            </h2>
            <p className="text-4xl font-bold text-gray-100 mt-2 tabular-nums">{totalLiveValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</p>
            <p className={`text-[10px] font-bold tracking-wider mt-1.5 tabular-nums ${totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </p>
          </div>
          <div className="border-t border-[#1e1e1e] pt-4">
            <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Realize Edilmiş Kâr / Zarar</h2>
            <p className={`text-xl font-bold mt-1 ${totalRealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalRealized >= 0 ? '+' : ''}{totalRealized.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </p>
          </div>
        </div>

        <div className="bg-[#121212] p-6 rounded border border-[#1e1e1e] col-span-1 md:col-span-2">
          <div className="flex justify-between items-center mb-4 gap-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Canlı Varlık Dağılımı</h2>
            {hiddenAssets.length > 0 && (
              <span className="text-[10px] text-amber-400 uppercase tracking-widest shrink-0">
                {hiddenAssets.length} varlık gizli
                <button
                  type="button"
                  onClick={() => { setHiddenAssets([]); setActiveSlice(null); }}
                  className="ml-2 underline hover:text-amber-300 transition-colors"
                >
                  tümünü göster
                </button>
              </span>
            )}
          </div>
          {chartData.length === 0 ? (
             <p className="p-6 text-center text-gray-600 text-sm">
               {openPositions.length === 0
                 ? "Grafik için henüz açık pozisyon yok."
                 : "Tüm varlıklar gizlendi."}
             </p>
          ) : (
            <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      nameKey="name"
                      dataKey="value"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={2}
                      stroke="#121212"
                      strokeWidth={2}
                      onMouseEnter={(_, index) => setActiveSlice(index)}
                      onMouseLeave={() => setActiveSlice(null)}
                      isAnimationActive={false}
                  >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={colorByAsset[entry.name]}
                          opacity={activeSlice === null || activeSlice === index ? 1 : 0.3}
                          style={{ transition: "opacity 150ms ease", cursor: "pointer" }}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                      contentStyle={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#d1d5db', fontSize: '12px', borderRadius: '6px', fontFamily: 'var(--font-geist-mono)' }}
                      itemStyle={{ color: '#d1d5db' }}
                      formatter={renderTooltipValue}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Halkanın ortası: toplam. Dilim üzerine gelince o varlığa döner. */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                  {activeSlice !== null && chartData[activeSlice] ? chartData[activeSlice].name : 'Toplam'}
                </span>
                <span className="text-xl font-bold text-gray-100 tabular-nums">
                  {(activeSlice !== null && chartData[activeSlice]
                    ? chartData[activeSlice].value
                    : totalLiveValue
                  ).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </span>
                {activeSlice !== null && chartData[activeSlice] && chartTotal > 0 && (
                  <span className="text-[10px] text-gray-500 tabular-nums mt-0.5">
                    %{((chartData[activeSlice].value / chartTotal) * 100).toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Kendi lejantımız: yakın oranları gözle kıyaslamak yerine rakamla oku */}
            <div className="mt-4 pt-4 border-t border-[#1e1e1e] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {chartData.map((entry, index) => {
                const value = entry.value;
                const share = chartTotal > 0 ? (value / chartTotal) * 100 : 0;

                return (
                  <button
                    key={entry.name}
                    type="button"
                    onMouseEnter={() => setActiveSlice(index)}
                    onMouseLeave={() => setActiveSlice(null)}
                    className={`flex items-center gap-2.5 text-left transition-opacity ${
                      activeSlice === null || activeSlice === index ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorByAsset[entry.name] }}></span>
                    <span className="text-xs text-gray-300 font-bold uppercase tracking-wider truncate">{entry.name}</span>
                    <span className="text-[11px] text-gray-500 tabular-nums ml-auto shrink-0">%{share.toFixed(1)}</span>
                    <span className="text-[11px] text-gray-300 tabular-nums shrink-0 w-24 text-right">
                      {value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                    </span>
                  </button>
                );
              })}
            </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-[#121212] rounded border border-[#1e1e1e] overflow-hidden">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider p-4 bg-[#0a0a0a] border-b border-[#1e1e1e]">Canlı Ledger Analizi</h2>
        <div className="hidden md:grid grid-cols-7 gap-4 p-4 border-b border-[#1e1e1e] bg-[#0a0a0a] text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-2">Varlık & Adet</div>
          <div className="text-right">Ağır. Orta. Maliyet</div>
          <div className="text-right">Güncel Fiyat</div>
          <div className="text-right">Yatırılan Nakit</div>
          <div className="text-right">Güncel Değer & Kâr</div>
          <div className="text-right">İşlem</div>
        </div>
        
        <div className="divide-y divide-[#1e1e1e] max-h-100 overflow-y-auto">
          {portfolioData.length === 0 ? (
            <p className="p-6 text-center text-gray-600 text-sm">Portföy detayı bulunamadı.</p>
          ) : (
            portfolioData.map((item, index) => {
  // Gelen verideki ondalık karmaşasını (virgül/nokta) standartlaştıran koruma
  const rawQuantity = String(item.totalQuantity || "0").replace(',', '.');
  const q = Number(rawQuantity) || 0;
  
  // Güvenlik kalkanı: Miktar astronomikse (örn. Altın hatası) sistemi kilitlenmekten koru
  const isAnomalous = q > 5000 && item.asset.includes("ALTIN");
  const displayQ = isAnomalous ? "Hata: Yüksek Miktar" : q.toLocaleString('tr-TR', { maximumFractionDigits: 4 });

  const cost = Number(item.totalCostTRY) || 0;
  const avg = Number(item.averageCost) || 0;
  const liveP = Number(item.currentPrice) || 0;

  // Hesaplama backend'de yapıldı: ortalama maliyetten çıkış, realize kâr/zarar dahil.
  const liveValue = Number(item.marketValue) || 0;
  const realized = Number(item.realized) || 0;
  const pnlPercent = cost > 0 ? (((liveValue - cost) / cost) * 100) : 0;
  const isProfit = item.isClosed ? realized >= 0 : pnlPercent >= 0;

  return (
    <div key={index} className={`grid grid-cols-2 md:grid-cols-7 gap-2 md:gap-4 p-4 items-center hover:bg-[#1a1a1a] transition-colors text-xs md:text-sm ${item.isClosed || isHidden(item.asset) ? 'opacity-50' : ''}`}>
      
      {/* Varlık İsmi ve Maskelenmiş Adet */}
      <div className="col-span-2 order-1 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: colorByAsset[item.asset] }}></span>
          <span className="text-gray-100 font-bold tracking-wide uppercase truncate">{item.asset}</span>
          {item.isClosed && (
            <span className="text-[9px] text-gray-500 border border-[#262626] px-1.5 py-0.5 rounded uppercase tracking-wider">Kapalı</span>
          )}
          {isHidden(item.asset) && (
            <span className="text-[9px] text-amber-500 border border-amber-900/60 px-1.5 py-0.5 rounded uppercase tracking-wider">Gizli</span>
          )}
        </div>
        <span className={`text-[10px] ml-4 mt-1 ${isAnomalous ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
          {isAnomalous ? displayQ : `${displayQ} Adet`}
        </span>
      </div>
      
      <div className="text-right text-gray-400 font-medium order-2">
          <span className="md:hidden block text-[9px] uppercase text-gray-500 mb-0.5">Ort. Maliyet</span>
          {avg.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
      </div>
      
      <div className="text-right text-blue-400 font-medium order-2 md:order-3">
          <span className="md:hidden block text-[9px] uppercase text-gray-500 mb-0.5">Canlı Fiyat</span>
          {liveP > 0 ? `${liveP.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : 'Bekleniyor'}
      </div>
      
      <div className="text-right text-gray-300 font-medium order-3 md:order-4">
          <span className="md:hidden block text-[9px] uppercase text-gray-500 mb-0.5">Yatırılan</span>
          {cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
      </div>
      
      <div className="text-right flex flex-col items-end order-3 md:order-5">
          <span className="md:hidden block text-[9px] uppercase text-gray-500 mb-0.5">Değer & Kâr</span>
          {item.isClosed ? (
            <>
              <span className="text-gray-500 text-xs">Pozisyon kapandı</span>
              <span className={`text-[10px] font-bold mt-1 ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                Realize: {isProfit ? '+' : ''}{realized.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
            </>
          ) : (
            <>
              <span className={`font-bold tracking-wider ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {liveValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
              <span className={`text-[10px] font-bold mt-1 ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                {realized !== 0 && (
                  <span className="text-gray-500 font-normal"> · realize {realized.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                )}
              </span>
            </>
          )}
      </div>

      {/* Görünürlük anahtarı + Silme */}
      <div className="col-span-2 md:col-span-1 order-4 md:order-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => toggleAsset(item.asset)}
          className={`transition-all p-1.5 rounded border ${
            isHidden(item.asset)
              ? 'text-amber-400 border-amber-900/60 hover:border-amber-700'
              : 'text-gray-500 border-[#262626] hover:text-emerald-400 hover:border-emerald-900'
          }`}
          title={isHidden(item.asset) ? "Toplama ve grafiğe geri ekle" : "Toplamdan ve grafikten geçici olarak çıkar"}
        >
          {isHidden(item.asset) ? <EyeOffIcon /> : <EyeIcon />}
        </button>

        <button 
          onClick={() => handleDelete(item.id)}
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

    {isPriceModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl text-zinc-200">
          <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-mono font-semibold text-emerald-400">MANUEL KUR YÖNETİMİ</h3>
            <button
              type="button"
              onClick={() => setIsPriceModalOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono px-2 py-1 bg-zinc-900 rounded"
            >
              [Kapat]
            </button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {assets.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">Varlık listesi yükleniyor...</p>
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                  <div>
                    <span className="font-mono font-bold text-sm text-zinc-200">{asset.ticker}</span>
                    <span className="block text-[10px] text-zinc-500">{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={manualPrices[asset.ticker] ?? ""}
                      onChange={(e) => handlePriceChange(asset.ticker, e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-right font-mono text-sm text-emerald-400 w-32 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="h-8 w-8 rounded border border-red-900/70 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                      title="Delete asset"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {priceMessage && (
            <p className="mt-4 text-center text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 py-1.5 rounded">
              {priceMessage}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => setIsPriceModalOpen(false)}
              className="px-4 py-2 rounded text-xs font-mono text-zinc-400 hover:bg-zinc-900 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSaveManualPrices}
              disabled={priceLoading}
              className="px-4 py-2 rounded text-xs font-mono bg-emerald-600 text-zinc-950 font-bold hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              {priceLoading ? "Kaydediliyor..." : "Güncelle"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}