# Proje Takip — Eksik Fiyat / Miktar Verisi

Syteline Excel import'unda (2026-09-25, `src/scripts/proje-takip-import.ts`) sayıya çevrilemediği için **boş bırakılan** hücreler.
Kayıtlar DB'ye eklendi; yalnız aşağıdaki alanlar boş. Doğru değerler Syteline'dan kontrol edilip elle girilmeli.

**Toplam: 75 hücre** — `birimFiyat`: 70, `minimumSipMiktari`: 3, `prototipFiyati`: 2

## Neden boş?

- **Tarihe dönüşmüş fiyatlar** (`birimFiyat`, `prototipFiyati`): Excel ondalık fiyatı tarih sanmış. Ör. `17.08` → 17 Ağustos 2026, `2.79` → Şubat 1979. Kabaca tahmin edilebilir ama `16.1` ile `16.01` aynı tarihe dönüştüğü için kesin değer geri çıkarılamaz — tahminle yazılmadı.
- **Sayı olmayan metin** (`minimumSipMiktari`): `20+35`, `'-`, `TBD`.

## Liste

| projeNo | Boş alan | Excel sütunu | Excel satırı | Not |
|---|---|---|---|---|
| PRJ-2021-00001 | `birimFiyat` | Brm Fiyat | 20 | Excel'de tarihe dönüşmüş: 2026-07-20 |
| PRJ-2021-00002 | `birimFiyat` | Brm Fiyat | 49 | Excel'de tarihe dönüşmüş: 2037-06-01 |
| PRJ-2021-00004 | `minimumSipMiktari` | Minimum Sip Miktarı | 65 | Excel'deki metin: `20+35` |
| PRJ-2021-00005 | `birimFiyat` | Brm Fiyat | 79 | Excel'de tarihe dönüşmüş: 2026-02-10 |
| PRJ-2021-00007 | `birimFiyat` | Brm Fiyat | 139 | Excel'de tarihe dönüşmüş: 2026-03-10 |
| PRJ-2021-00008 | `birimFiyat` | Brm Fiyat | 152 | Excel'de tarihe dönüşmüş: 2026-09-13 |
| PRJ-2021-00009 | `birimFiyat` | Brm Fiyat | 163 | Excel'de tarihe dönüşmüş: 2026-02-03 |
| PRJ-2021-00010 | `birimFiyat` | Brm Fiyat | 186 | Excel'de tarihe dönüşmüş: 2025-09-01 |
| PRJ-2021-00012 | `birimFiyat` | Brm Fiyat | 209 | Excel'de tarihe dönüşmüş: 2026-08-24 |
| PRJ-2021-00013 | `birimFiyat` | Brm Fiyat | 216 | Excel'de tarihe dönüşmüş: 1958-05-01 |
| PRJ-2021-00014 | `birimFiyat` | Brm Fiyat | 247 | Excel'de tarihe dönüşmüş: 2026-09-06 |
| PRJ-2021-00016 | `birimFiyat` | Brm Fiyat | 257 | Excel'de tarihe dönüşmüş: 1953-01-01 |
| PRJ-2021-00024 | `birimFiyat` | Brm Fiyat | 354 | Excel'de tarihe dönüşmüş: 2026-03-13 |
| PRJ-2021-00025 | `birimFiyat` | Brm Fiyat | 355 | Excel'de tarihe dönüşmüş: 2026-08-24 |
| PRJ-2021-00026 | `birimFiyat` | Brm Fiyat | 360 | Excel'de tarihe dönüşmüş: 2026-07-12 |
| PRJ-2021-00027 | `birimFiyat` | Brm Fiyat | 369 | Excel'de tarihe dönüşmüş: 2026-08-07 |
| PRJ-2021-00029 | `birimFiyat` | Brm Fiyat | 411 | Excel'de tarihe dönüşmüş: 2026-09-15 |
| PRJ-2021-00030 | `birimFiyat` | Brm Fiyat | 428 | Excel'de tarihe dönüşmüş: 1995-01-01 |
| PRJ-2021-00031 | `birimFiyat` | Brm Fiyat | 448 | Excel'de tarihe dönüşmüş: 2014-03-01 |
| PRJ-2021-00033 | `birimFiyat` | Brm Fiyat | 482 | Excel'de tarihe dönüşmüş: 1981-09-01 |
| PRJ-2021-00035 | `birimFiyat` | Brm Fiyat | 510 | Excel'de tarihe dönüşmüş: 2026-01-16 |
| PRJ-2021-00037 | `birimFiyat` | Brm Fiyat | 523 | Excel'de tarihe dönüşmüş: 2026-06-15 |
| PRJ-2021-00039 | `birimFiyat` | Brm Fiyat | 533 | Excel'de tarihe dönüşmüş: 2026-03-12 |
| PRJ-2021-00041 | `minimumSipMiktari` | Minimum Sip Miktarı | 552 | Excel'deki metin: `TBD` |
| PRJ-2021-00042 | `birimFiyat` | Brm Fiyat | 597 | Excel'de tarihe dönüşmüş: 2026-01-16 |
| PRJ-2021-00043 | `birimFiyat` | Brm Fiyat | 609 | Excel'de tarihe dönüşmüş: 2026-07-12 |
| PRJ-2021-00044 | `birimFiyat` | Brm Fiyat | 612 | Excel'de tarihe dönüşmüş: 2026-07-14 |
| PRJ-2022-00002 | `birimFiyat` | Brm Fiyat | 45 | Excel'de tarihe dönüşmüş: 2026-09-18 |
| PRJ-2022-00003 | `birimFiyat` | Brm Fiyat | 90 | Excel'de tarihe dönüşmüş: 2026-12-07 |
| PRJ-2022-00006 | `birimFiyat` | Brm Fiyat | 180 | Excel'de tarihe dönüşmüş: 2026-08-23 |
| PRJ-2022-00008 | `birimFiyat` | Brm Fiyat | 203 | Excel'de tarihe dönüşmüş: 2026-05-20 |
| PRJ-2022-00012 | `birimFiyat` | Brm Fiyat | 267 | Excel'de tarihe dönüşmüş: 2026-07-03 |
| PRJ-2022-00014 | `birimFiyat` | Brm Fiyat | 312 | Excel'de tarihe dönüşmüş: 2045-01-01 |
| PRJ-2022-00016 | `birimFiyat` | Brm Fiyat | 399 | Excel'de tarihe dönüşmüş: 2026-09-21 |
| PRJ-2022-00018 | `birimFiyat` | Brm Fiyat | 445 | Excel'de tarihe dönüşmüş: 2026-09-10 |
| PRJ-2022-00020 | `birimFiyat` | Brm Fiyat | 492 | Excel'de tarihe dönüşmüş: 2014-03-01 |
| PRJ-2022-00021 | `birimFiyat` | Brm Fiyat | 529 | Excel'de tarihe dönüşmüş: 2026-05-20 |
| PRJ-2023-00002 | `birimFiyat` | Brm Fiyat | 6 | Excel'de tarihe dönüşmüş: 2026-08-17 |
| PRJ-2023-00003 | `birimFiyat` | Brm Fiyat | 103 | Excel'de tarihe dönüşmüş: 2026-04-03 |
| PRJ-2023-00006 | `birimFiyat` | Brm Fiyat | 166 | Excel'de tarihe dönüşmüş: 1952-02-01 |
| PRJ-2023-00011 | `birimFiyat` | Brm Fiyat | 232 | Excel'de tarihe dönüşmüş: 2027-10-01 |
| PRJ-2023-00012 | `birimFiyat` | Brm Fiyat | 270 | Excel'de tarihe dönüşmüş: 1974-05-01 |
| PRJ-2023-00013 | `birimFiyat` | Brm Fiyat | 287 | Excel'de tarihe dönüşmüş: 1966-09-01 |
| PRJ-2023-00015 | `birimFiyat` | Brm Fiyat | 300 | Excel'de tarihe dönüşmüş: 2023-11-01 |
| PRJ-2023-00018 | `birimFiyat` | Brm Fiyat | 401 | Excel'de tarihe dönüşmüş: 2026-08-23 |
| PRJ-2023-00021 | `birimFiyat` | Brm Fiyat | 426 | Excel'de tarihe dönüşmüş: 2026-07-24 |
| PRJ-2023-00028 | `birimFiyat` | Brm Fiyat | 502 | Excel'de tarihe dönüşmüş: 1969-11-01 |
| PRJ-2023-00030 | `birimFiyat` | Brm Fiyat | 551 | Excel'de tarihe dönüşmüş: 1992-06-01 |
| PRJ-2023-00034 | `birimFiyat` | Brm Fiyat | 613 | Excel'de tarihe dönüşmüş: 1992-06-01 |
| PRJ-2024-00002 | `birimFiyat` | Brm Fiyat | 12 | Excel'de tarihe dönüşmüş: 2021-04-01 |
| PRJ-2024-00005 | `birimFiyat` | Brm Fiyat | 44 | Excel'de tarihe dönüşmüş: 1979-02-01 |
| PRJ-2024-00007 | `birimFiyat` | Brm Fiyat | 51 | Excel'de tarihe dönüşmüş: 2026-01-24 |
| PRJ-2024-00010 | `birimFiyat` | Brm Fiyat | 104 | Excel'de tarihe dönüşmüş: 2026-05-26 |
| PRJ-2024-00016 | `birimFiyat` | Brm Fiyat | 237 | Excel'de tarihe dönüşmüş: 2021-04-01 |
| PRJ-2024-00021 | `birimFiyat` | Brm Fiyat | 338 | Excel'de tarihe dönüşmüş: 1952-04-01 |
| PRJ-2024-00022 | `birimFiyat` | Brm Fiyat | 346 | Excel'de tarihe dönüşmüş: 2026-09-04 |
| PRJ-2024-00023 | `birimFiyat` | Brm Fiyat | 373 | Excel'de tarihe dönüşmüş: 2026-09-04 |
| PRJ-2024-00027 | `birimFiyat` | Brm Fiyat | 453 | Excel'de tarihe dönüşmüş: 1952-04-01 |
| PRJ-2024-00030 | `birimFiyat` | Brm Fiyat | 479 | Excel'de tarihe dönüşmüş: 2026-08-05 |
| PRJ-2025-00003 | `birimFiyat` | Brm Fiyat | 54 | Excel'de tarihe dönüşmüş: 2026-05-05 |
| PRJ-2025-00005 | `birimFiyat` | Brm Fiyat | 63 | Excel'de tarihe dönüşmüş: 2026-05-05 |
| PRJ-2025-00010 | `birimFiyat` | Brm Fiyat | 92 | Excel'de tarihe dönüşmüş: 1977-01-01 |
| PRJ-2025-00010 | `prototipFiyati` | Prototif Fiyat | 92 | Excel'de tarihe dönüşmüş: 1977-01-01 |
| PRJ-2025-00016 | `birimFiyat` | Brm Fiyat | 115 | Excel'de tarihe dönüşmüş: 2026-04-16 |
| PRJ-2025-00023 | `minimumSipMiktari` | Minimum Sip Miktarı | 193 | Excel'deki metin: `'-` |
| PRJ-2025-00028 | `birimFiyat` | Brm Fiyat | 276 | Excel'de tarihe dönüşmüş: 2026-02-24 |
| PRJ-2025-00028 | `prototipFiyati` | Prototif Fiyat | 276 | Excel'de tarihe dönüşmüş: 2026-02-24 |
| PRJ-2025-00035 | `birimFiyat` | Brm Fiyat | 349 | Excel'de tarihe dönüşmüş: 2034-02-01 |
| PRJ-2025-00039 | `birimFiyat` | Brm Fiyat | 440 | Excel'de tarihe dönüşmüş: 2026-05-05 |
| PRJ-2025-00041 | `birimFiyat` | Brm Fiyat | 452 | Excel'de tarihe dönüşmüş: 1998-02-01 |
| PRJ-2025-00042 | `birimFiyat` | Brm Fiyat | 465 | Excel'de tarihe dönüşmüş: 1954-04-01 |
| PRJ-2025-00047 | `birimFiyat` | Brm Fiyat | 495 | Excel'de tarihe dönüşmüş: 2034-02-01 |
| PRJ-2025-00052 | `birimFiyat` | Brm Fiyat | 558 | Excel'de tarihe dönüşmüş: 1998-02-01 |
| PRJ-2026-00002 | `birimFiyat` | Brm Fiyat | 61 | Excel'de tarihe dönüşmüş: 2026-08-31 |
| PRJ-2026-00007 | `birimFiyat` | Brm Fiyat | 156 | Excel'de tarihe dönüşmüş: 2026-12-09 |
