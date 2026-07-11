// İşe alım sınav puanlama mantığı (Faz 1: İK/test; asıl aday akışı Faz 2).
// Yüzde-bazlı: kazanılan / toplam × 100 → geçmePuanı (yüzde) ile karşılaştırılır.

export type SoruDegerlendirme = {
  questionId: string;
  correctOptionIds: string[]; // doğru şık id'leri
  points: number; // sorunun puanı
};

export type CevapGirdi = {
  questionId: string;
  selectedOptionIds: string[];
};

export type CevapSonuc = {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  points: number; // bu sorudan kazanılan
};

// Bir cevap doğru mu: seçilen şık kümesi doğru şık kümesiyle TAM eşleşmeli
// (çoklu seçimde tüm doğrular + hiç yanlış yok).
function tamEslesme(secilen: string[], dogru: string[]): boolean {
  if (secilen.length !== dogru.length) return false;
  const d = new Set(dogru);
  return secilen.every((id) => d.has(id));
}

export function puanla(
  sorular: SoruDegerlendirme[],
  cevaplar: CevapGirdi[],
  gecmePuani: number,
): { cevapSonuclari: CevapSonuc[]; yuzde: number; gecti: boolean } {
  const cevapMap = new Map(cevaplar.map((c) => [c.questionId, c.selectedOptionIds]));
  let kazanilan = 0;
  let toplam = 0;
  const cevapSonuclari: CevapSonuc[] = [];

  for (const s of sorular) {
    toplam += s.points;
    const secilen = cevapMap.get(s.questionId) ?? [];
    const dogru = tamEslesme(secilen, s.correctOptionIds);
    const puan = dogru ? s.points : 0;
    kazanilan += puan;
    cevapSonuclari.push({
      questionId: s.questionId,
      selectedOptionIds: secilen,
      isCorrect: dogru,
      points: puan,
    });
  }

  const yuzde = toplam > 0 ? Math.round((kazanilan / toplam) * 100) : 0;
  return { cevapSonuclari, yuzde, gecti: yuzde >= gecmePuani };
}
