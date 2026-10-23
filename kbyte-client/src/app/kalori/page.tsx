"use client";

import { useState, useEffect } from "react";

// --- BÖLÜM 1: TİP GÜVENLİĞİ VE MOTOR ---
type Gender = "male" | "female";

interface UserStats {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  bodyFatPct: number; // Yeni: Vücut Yağ Oranı
}

interface DailyData {
  caloriesConsumed: number;
  activeCaloriesBurned: number;
}

// --- BÖLÜM 2: TERMODİNAMİK İNFAZ FONKSİYONU (SOFT CAP ENTEGRELİ) ---
function calculateFatLoss(stats: UserStats, daily: DailyData) {
  let bmr = (10 * stats.weightKg) + (6.25 * stats.heightCm) - (5 * stats.age);
  bmr += stats.gender === "male" ? 5 : -161;

  const baseTdee = bmr * 1.2;
  const tdee = baseTdee + daily.activeCaloriesBurned;
  const netDeficit = tdee - daily.caloriesConsumed;

  // BİYOLOJİK SOFT CAP KALKANI (Alpert Limiti)
  const totalFatMassKg = stats.weightKg * (stats.bodyFatPct / 100);
  const maxFatEnergyPerDay = totalFatMassKg * 68; // kg başına 68 kcal

  let finalDeficitForFat = netDeficit;
  let muscleLossWarning = false;

  // Eğer kalori açığı, yağın verebileceği maksimum enerjiyi aşarsa cap koyuyoruz
  if (netDeficit > maxFatEnergyPerDay) {
    finalDeficitForFat = maxFatEnergyPerDay;
    muscleLossWarning = true; // Kas yıkımı riski
  }

  // 1 gr Yağ = 7.7 kcal
  const fatGramChanged = parseFloat((Math.abs(finalDeficitForFat) / 7.7).toFixed(1));

  return {
    netDeficit: Math.round(netDeficit),
    fatGramChanged,
    isLoss: netDeficit > 0,
    muscleLossWarning,
    maxFatEnergyPerDay: Math.round(maxFatEnergyPerDay)
  };
}

// --- BÖLÜM 3: KULLANICI ARAYÜZÜ (UI) ---
export default function KaloriHesapla() {
  const [stats, setStats] = useState<UserStats>({
    weightKg: 75,
    heightCm: 180,
    age: 25,
    gender: "male",
    bodyFatPct: 15, // Varsayılan %15
  });

  const [daily, setDaily] = useState<DailyData>({
    caloriesConsumed: 0,
    activeCaloriesBurned: 0,
  });

  const [result, setResult] = useState<{ deficit: number; fat: number; isLoss: boolean; muscleLossWarning: boolean; maxEnergy: number } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedStats = localStorage.getItem("userStats");
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, []);

  const handleStatChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newStats = { ...stats, [name]: name === "gender" ? value : Number(value) };
    setStats(newStats);
    localStorage.setItem("userStats", JSON.stringify(newStats));
  };

  const handleDailyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDaily({ ...daily, [name]: Number(value) });
  };

  const handleCalculate = () => {
    const calc = calculateFatLoss(stats, daily);
    setResult({
      deficit: calc.netDeficit,
      fat: calc.fatGramChanged,
      isLoss: calc.isLoss,
      muscleLossWarning: calc.muscleLossWarning,
      maxEnergy: calc.maxFatEnergyPerDay
    });
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-300 p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-md space-y-8">
        
        <div className="text-center border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-bold text-white">Termodinamik Yağ Yakım Analizörü</h1>
          <p className="text-sm text-zinc-500 mt-2">Günlük aktivite ve biyolojik limit bazlı net gramaj hesabı</p>
        </div>

        {/* BÖLÜM 1: BAZAL PARAMETRELER */}
        <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Sabit Parametreler</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1">Boy (cm)</label>
              <input type="number" name="heightCm" value={stats.heightCm || ""} onChange={handleStatChange} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs mb-1">Kilo (kg)</label>
              <input type="number" name="weightKg" value={stats.weightKg || ""} onChange={handleStatChange} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs mb-1">Yaş</label>
              <input type="number" name="age" value={stats.age || ""} onChange={handleStatChange} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs mb-1">Cinsiyet</label>
              <select name="gender" value={stats.gender} onChange={handleStatChange} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500">
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs mb-1 text-emerald-400">Tahmini Yağ Oranı (%) - Biyolojik Limit İçin</label>
              <input type="number" name="bodyFatPct" value={stats.bodyFatPct || ""} onChange={handleStatChange} placeholder="Örn: 15" className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
          </div>
        </div>

        {/* BÖLÜM 2: GÜNLÜK VERİ AKIŞI */}
        <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">24 Saatlik Döngü</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-1">Tüketilen Toplam Kalori (Yemek)</label>
              <input type="number" name="caloriesConsumed" value={daily.caloriesConsumed || ""} onChange={handleDailyChange} placeholder="Örn: 2100" className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs mb-1">Aktivite ile Yakılan Kalori (Akıllı Saat)</label>
              <input type="number" name="activeCaloriesBurned" value={daily.activeCaloriesBurned || ""} onChange={handleDailyChange} placeholder="Örn: 600" className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-zinc-500" />
            </div>
          </div>
        </div>

        {/* İNFAZ BUTONU */}
        <button onClick={handleCalculate} className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-3 px-4 rounded-lg transition-colors duration-200">
          HESAPLA VE İNFAZ ET
        </button>

        {/* BÖLÜM 3: SONUÇ RAPORU */}
        {result && (
          <div className={`p-6 rounded-xl border text-center ${result.isLoss ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-rose-950/30 border-rose-900/50'}`}>
            <p className="text-sm text-zinc-400 mb-2">Net Kalori Durumu: {result.deficit} kcal</p>
            <h3 className={`text-2xl font-bold ${result.isLoss ? 'text-emerald-500' : 'text-rose-500'}`}>
              {result.isLoss ? `BUGÜN YAKILAN NET YAĞ:` : `BUGÜN DEPOLANAN YAĞ:`}
              <span className="block text-4xl mt-2">{result.fat} GRAM</span>
            </h3>
            
            {/* KAS YIKIMI UYARISI */}
            {result.muscleLossWarning && (
              <div className="mt-4 p-3 bg-amber-950/50 border border-amber-900/50 rounded-lg text-amber-500 text-sm">
                <strong>⚠️ DİKKAT: BİYOLOJİK LİMİT AŞILDI</strong>
                <p className="mt-1">
                  Vücudunuzun günlük maksimum yağ transfer kapasitesi <b>{result.maxEnergy} kcal</b>. 
                  Bunun üzerindeki kalori açığı kas kaybına (katabolizma) yol açar. Gramaj hesabı maksimum limite göre yapılmıştır.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}