"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

//Test Texti
// YENİ: Varlık veri modeli
interface AssetOption {
  id: number;
  ticker: string;
  name: string;
  assetCategory: string;
}

interface BankOption {
  id: number;
  name: string;
  brandColor: string;
}

// Formdaki seçim -> backend'e gidecek tip + banka gerekip gerekmediği.
// Backend tipleri: 0 Gelir, 1 Gider, 2 Yatırım, 3 Kart Harcaması.
const ENTRY_MODES = {
  expense:     { label: "Gider",                  type: 1, needsBank: false },
  income:      { label: "Gelir",                  type: 0, needsBank: false },
  investment:  { label: "Yatırım",                type: 2, needsBank: false },
  cardPayment: { label: "Kredi Kartı Ödemesi",    type: 1, needsBank: true  },
  cardExpense: { label: "Kredi Kartı Harcaması",  type: 3, needsBank: true  },
} as const;

type EntryMode = keyof typeof ENTRY_MODES;

export default function AddTransaction() {
  const router = useRouter();
  const apiBaseUrl = "/api/backend"; // same-origin proxy, keeps the API key server-side
  const currentDate = new Date().toISOString().split('T')[0];

  // YENİ: Varlıkları ve yüklenme durumunu tutacak state'ler
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [entryMode, setEntryMode] = useState<EntryMode>("expense");

  const [formData, setFormData] = useState({
    transactionDate: currentDate,
    type: 1, // 0: Gelir, 1: Gider, 2: Yatırım, 3: Kart Harcaması
    amountTRY: "",
    description: "",
    // Varsayılan değer ilk veri çekildiğinde dinamik olarak atanacak
    assetType: "",
    unitPrice: "", 
    quantity: "", 
    direction: "Buy" as "Buy" | "Sell",
    bankAccountId: "",
  });

  const [status, setStatus] = useState("");

  // YENİ: Sayfa yüklendiğinde veritabanından varlık listesini çeken otonom motor
  useEffect(() => {
    const fetchAssets = async () => {
      setAssetsLoading(true);
      try {
        const baseUrl = apiBaseUrl.replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/api/Dashboard/assets`);
        if (res.ok) {
          const data: AssetOption[] = await res.json();
          setAssets(data);
          // Eğer veritabanında varlık varsa, formu ilk varlığın Ticker'ı ile başlat
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, assetType: data[0].ticker }));
          }
        } else {
          console.error("Assets fetch failed:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Varlıklar çekilemedi:", err);
      } finally {
        setAssetsLoading(false);
      }
    };
    fetchAssets();

    const fetchBanks = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/Banks`);
        if (res.ok) {
          const data: BankOption[] = await res.json();
          setBanks(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, bankAccountId: String(data[0].id) }));
          }
        }
      } catch (err) {
        console.error("Bankalar çekilemedi:", err);
      }
    };
    fetchBanks();
  }, [apiBaseUrl]);

  // Tür değişince backend tipini de senkron tut
  const handleModeChange = (mode: EntryMode) => {
    setEntryMode(mode);
    setFormData(prev => ({ ...prev, type: ENTRY_MODES[mode].type }));
  };

  // Dinamik Hesaplama Motoru (Toplam > Birim fiyat > adet)
  const handleAmountChange = (val: string) => {
    const t = parseFloat(val);
    const p = parseFloat(formData.unitPrice);
    
    if (formData.type === 2) {
      if (!isNaN(t) && !isNaN(p) && p !== 0) {
        setFormData({ ...formData, amountTRY: val, quantity: (t / p).toFixed(2) });
      } else {
        setFormData({ ...formData, amountTRY: val });
      }
    } else {
      setFormData({ ...formData, amountTRY: val });
    }
  };

  const handlePriceChange = (val: string) => {
    const p = parseFloat(val);
    const t = parseFloat(formData.amountTRY);
    
    if (!isNaN(p) && !isNaN(t) && p !== 0) {
      setFormData({ ...formData, unitPrice: val, quantity: (t / p).toFixed(2) });
    } else {
      setFormData({ ...formData, unitPrice: val });
    }
  };

  const handleQuantityChange = (val: string) => {
    const q = parseFloat(val);
    const p = parseFloat(formData.unitPrice);
    
    if (!isNaN(q) && !isNaN(p)) {
      setFormData({ ...formData, quantity: val, amountTRY: (q * p).toFixed(2) });
    } else {
      setFormData({ ...formData, quantity: val });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Kayıt işleniyor...");

    // Açıklamaya hala [TICKER] prefix ekliyoruz — UI'da okunabilirlik için
    const finalDescription = entryMode === "investment"
      ? `[${formData.assetType}] ${formData.description}` 
      : formData.description;
    
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour12: false }); 
    const finalDateTime = `${formData.transactionDate}T${currentTime}`;

    // Yatırımda AssetId'yi tespit et
    const selectedAsset = entryMode === "investment"
      ? assets.find(a => a.ticker === formData.assetType) 
      : null;

    const mode = ENTRY_MODES[entryMode];

    const payload = {
      transactionDate: finalDateTime, 
      type: mode.type,
      amountTRY: parseFloat(formData.amountTRY.toString()),
      description: finalDescription,
      assetId: selectedAsset?.id ?? null,
      quantity: entryMode === "investment" && formData.quantity ? parseFloat(formData.quantity.toString()) : null,
      // Birim fiyat elle girilir — canlı kur motoru bu formu ASLA ezmez.
      unitPrice: entryMode === "investment" && formData.unitPrice ? parseFloat(formData.unitPrice.toString()) : null,
      direction: entryMode === "investment" ? (formData.direction === "Sell" ? 1 : 0) : null,
      bankAccountId: mode.needsBank && formData.bankAccountId ? Number(formData.bankAccountId) : null,
    };

    const response = await fetch(`${apiBaseUrl}/api/Transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      setStatus("Başarılı! Kasa güncellendi.");
      setTimeout(() => router.push("/kasa"), 800); 
    } else {
      setStatus("Hata: Kayıt kasaya yazılamadı.");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 font-mono text-gray-400 flex justify-center items-start pt-12 pb-24 md:pb-8">
      <div className="w-full max-w-md bg-[#121212] p-6 rounded-lg border-t-4 border-[#10B981] shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-[#10B981] tracking-widest uppercase text-xl font-bold">İşlem Enjeksiyonu</h2>
          <Link href="/kasa" className="text-gray-500 hover:text-white transition-colors text-sm">İptal / Geri</Link>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Tarih ve Tür */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 mb-2 font-bold tracking-wider">TARİH</label>
              <input type="date" required className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white rounded p-3 outline-none focus:border-[#10B981]"
                value={formData.transactionDate} onChange={(e) => setFormData({...formData, transactionDate: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-2 font-bold tracking-wider">TÜR</label>
              <select className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white rounded p-3 outline-none focus:border-[#10B981]"
                value={entryMode} onChange={(e) => handleModeChange(e.target.value as EntryMode)}>
                {(Object.keys(ENTRY_MODES) as EntryMode[]).map((mode) => (
                  <option key={mode} value={mode}>{ENTRY_MODES[mode].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Kart işlemlerinde banka seçimi */}
          {ENTRY_MODES[entryMode].needsBank && (
            <div className="bg-[#151013] p-4 rounded border border-amber-900/30 space-y-2">
              <label className="block text-[10px] text-amber-500 mb-2 font-bold tracking-wider">BANKA / KART</label>
              <select
                className="w-full bg-[#121212] border border-[#1e1e1e] text-amber-300 rounded p-2 outline-none focus:border-amber-500"
                value={formData.bankAccountId}
                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
              >
                {banks.length === 0 ? (
                  <option value="">Banka bulunamadı!</option>
                ) : (
                  banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))
                )}
              </select>
              <p className="text-[10px] text-gray-500 leading-relaxed pt-1">
                {entryMode === "cardPayment"
                  ? "Nakit çıkışıdır: Gider'e yazılır, kartın borcunu düşürür."
                  : "Nakit çıkışı değildir: Gider'e yazılmaz, kartın borcunu ve Edinilen Borç'u artırır."}
              </p>
            </div>
          )}

          {/* Sadece Yatırım Seçildiğinde Devreye Giren Akıllı Panel */}
          {entryMode === "investment" && (
            <div className="bg-[#0f1512] p-4 rounded border border-emerald-900/30 space-y-4">
              <div>
                <label className="block text-[10px] text-emerald-500 mb-2 font-bold tracking-wider">İŞLEM YÖNÜ</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, direction: "Buy" })}
                    className={`py-2 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                      formData.direction === "Buy"
                        ? "bg-emerald-900/30 border-emerald-500 text-emerald-400"
                        : "bg-[#121212] border-[#1e1e1e] text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Alış
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, direction: "Sell" })}
                    className={`py-2 rounded text-xs font-bold uppercase tracking-wider border transition-colors ${
                      formData.direction === "Sell"
                        ? "bg-red-900/30 border-red-500 text-red-400"
                        : "bg-[#121212] border-[#1e1e1e] text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Satış
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-emerald-500 mb-2 font-bold tracking-wider">VARLIK TÜRÜ</label>
                <select className="w-full bg-[#121212] border border-[#1e1e1e] text-emerald-400 rounded p-2 outline-none focus:border-emerald-500"
                  value={formData.assetType} onChange={(e) => setFormData({...formData, assetType: e.target.value})}>
                  
                  {/* YENİ: Dinamik Varlık Listesi */}
                  {assetsLoading ? (
                    <option value="">Kasa senkronize ediliyor...</option>
                  ) : assets.length === 0 ? (
                    <option value="">Veritabanında varlık bulunamadı!</option>
                  ) : (
                    assets.map((asset) => (
                      <option key={asset.id} value={asset.ticker}>
                        {asset.name} ({asset.ticker})
                      </option>
                    ))
                  )}

                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-emerald-500 mb-2 font-bold tracking-wider">BİRİM FİYAT (TRY)</label>
                  <input type="number" step="0.0001" required className="w-full bg-[#121212] border border-[#1e1e1e] text-white rounded p-2 outline-none focus:border-emerald-500 placeholder-gray-700"
                    placeholder="Örn: 55.01" value={formData.unitPrice} onChange={(e) => handlePriceChange(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-emerald-500 mb-2 font-bold tracking-wider">ALINAN ADET / MİKTAR</label>
                  <input type="number" step="0.0001" required className="w-full bg-[#121212] border border-[#1e1e1e] text-white rounded p-2 outline-none focus:border-emerald-500 placeholder-gray-700"
                    placeholder="Örn: 8.75" value={formData.quantity} onChange={(e) => handleQuantityChange(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Toplam Tutar */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-2 font-bold tracking-wider">
              {entryMode === "investment"
                ? (formData.direction === "Sell" ? "TOPLAM SATIŞ TUTARI (TRY)" : "TOPLAM İŞLEM MALİYETİ (TRY)")
                : "TOPLAM TUTAR (TRY)"}
            </label>
            <input type="number" step="0.01" required className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white rounded p-3 outline-none focus:border-[#10B981] placeholder-gray-700"
              placeholder="Kasadan çıkan/giren net rakam" value={formData.amountTRY} onChange={(e) => handleAmountChange(e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-2 font-bold tracking-wider">KISA AÇIKLAMA</label>
            <input type="text" required className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white rounded p-3 outline-none focus:border-[#10B981] placeholder-gray-700"
              placeholder="Örn: Düzenli alım..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          <button type="submit" disabled={status === "Kayıt işleniyor..."} 
            className="w-full py-4 mt-4 bg-[#1e1e1e] text-[#10B981] border border-[#1e1e1e] hover:border-[#10B981] hover:bg-emerald-900/10 font-bold rounded tracking-widest uppercase transition-colors disabled:opacity-50">
            Sisteme İşle
          </button>
          
          {status && <div className="text-center text-xs font-bold text-gray-400 mt-4 tracking-wider">{status}</div>}
        </form>
      </div>
    </main>
  );
}