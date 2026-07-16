// T.C. Kimlik No doğrulama — resmi algoritma.
// Kurallar: 11 hane, hepsi rakam, ilk hane 0 olamaz,
//   10. hane = ((1+3+5+7+9. haneler toplamı)*7 - (2+4+6+8. haneler toplamı)) mod 10
//   11. hane = (ilk 10 hane toplamı) mod 10

export function validateTcKimlik(tc: string): boolean {
  if (typeof tc !== "string" || !/^\d{11}$/.test(tc)) return false;
  const d = tc.split("").map((c) => Number(c));
  if (d[0] === 0) return false;

  const tekToplam = d[0] + d[2] + d[4] + d[6] + d[8]; // 1,3,5,7,9. haneler
  const ciftToplam = d[1] + d[3] + d[5] + d[7]; // 2,4,6,8. haneler
  const hane10 = ((tekToplam * 7 - ciftToplam) % 10 + 10) % 10;
  if (hane10 !== d[9]) return false;

  const ilk10Toplam = d.slice(0, 10).reduce((a, b) => a + b, 0);
  const hane11 = ilk10Toplam % 10;
  if (hane11 !== d[10]) return false;

  return true;
}
