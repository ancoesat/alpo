// src/services/LivePriceEngine.ts

/**
 * Teknik Mentor Notu: Bu servis şu an için bir 'Mock' (Taklit) motorudur.
 * Matematiksel doğruluğu test etmek için sahte ama mantıklı güncel fiyatlar döner.
 * Mimari oturduğunda buraya gerçek bir finans API'si (örn. CollectAPI) entegre edilecektir.
 */
export const getLivePrice = (assetCode: string): number => {

    const marketPrices: Record<string, number> = {
        "ALTIN (gr.)": 2750.50, 
        "EUR": 38.45,
        "USD": 35.10,
        "TP2": 0.065,
        "PPZ": 0.015,
        "D&N CASE": 5000.00 // Özel varlıklar için manuel değerleme
    };

   
    return marketPrices[assetCode] || 0;
};