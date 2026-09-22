# ILERIHub E-posta Şablonu Standardı

Hub'dan çıkan **her HTML e-posta** ortak yerleşimden (`renderEmail()`) üretilir.
Kurumsal görünüm (beyaz kart, CID logo, modül etiketi, tek buton, dipnot) tek yerde
durur; modüller yalnız alanları verir.

## Kural

1. **Inline HTML yok.** `<table>`/`<div>` ile elde mail gövdesi kurma. HTML'i
   `renderEmail()` üretir (`src/lib/email-templates/layout.ts`).
2. **`sendEmail`'e daima düz metin fallback + logo ver:**
   ```ts
   const { html, text } = renderEmail({ ... })
   await sendEmail([to], subject, text, html, logoAttachments())
   ```
   - `text` → HTML görüntülenemeyen istemciler için (renderEmail otomatik üretir).
   - `logoAttachments()` → CID logosu (`cid:ilerihub-logo`); verilmezse logo kırılır.
3. **Damga.** `renderEmail` çıktısı `<!-- hub-mail-v1 -->` damgası taşır. `sendEmail`
   içindeki bekçi, `html` verilmiş ama damgasız gönderimlerde
   `console.warn("[email] ortak şablon dışı HTML: <çağıran>")` basar.
4. **Kapı.** `scripts/preflight.sh`, `sendEmail(` çağırıp `renderEmail`/`akademiMail`
   (veya bir `email-templates/` şablonu) kullanmayan dosyaları listeler. Şimdilik
   UYARI; liste boşalınca `MODE=error` yapılıp regresyon kapısına çevrilecek.

### İki imza

| Fonksiyon | Döner | Kullanım |
|---|---|---|
| `renderEmail(input)` | `{ html, text }` | **Yeni çağrılar.** HTML + düz metin birlikte. |
| `renderEmailHtml(input)` | `string` | Eski imza; yalnız HTML gerektiren yerler (ör. `akademiMail`). |
| `renderEmailText(input)` | `string` | Yalnız düz metin gerekirse. |

Akademi şablonları `akademiMail()` sarmalayıcısını kullanır → o da `renderEmailHtml`
çağırır (`module: "Akademi"` sabit).

## `EmailLayoutInput` alanları

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `module` | `EmailModule` | Evet | Üst şerit etiketi: Akademi, Destek, Envanter, Zimmet, Mesai, İnsan Varlıkları, Kalibrasyon, Kalite. |
| `title` | `string` | Evet | Başlık (düz metin, escape'lenir). |
| `subtitle` | `string` | Hayır | Başlık altı gri satır — genelde **tarih / kayıt no** buraya. |
| `preheader` | `string` | Hayır | Inbox önizleme metni (yoksa `title`). |
| `bodyHtml` | `string` | Hayır | Selam + gövde paragrafları. `p()` ile sar; içerik HTML — değişkenleri `esc()`'le. |
| `infoRows` | `{label,value}[]` | Hayır | İnce çizgili "Etiket / Değer" tablosu. `value` HTML (escape çağırana ait), boş `value` satırı atlanır. |
| `afterHtml` | `string` | Hayır | Tablodan sonra, butondan önce HTML. Çok sütunlu liste için `dataTable()`. |
| `cta` | `{label,url}` | Hayır | **Tek** buton; altına otomatik düz fallback bağlantı eklenir. |
| `footnote` | `string` | Hayır | Dipnotun ilk cümlesi (otomatik "otomatik gönderim" cümlesinden önce). |
| `width` | `600 \| 800` | Hayır | Kart genişliği (vars. 600; çok sütunlu liste için 800). |

Yardımcılar (hepsi `layout.ts`'ten): `p()` paragraf, `quote()` alıntı, `dataTable()`
çok sütunlu tablo, `sectionTitle()`, `kpiRow()`, `barRow()`, `esc()` HTML-escape,
`logoAttachments()` CID logo eki.

## Tam örnek

```ts
import { sendEmail } from '@/lib/email'
import { renderEmail, p, esc, logoAttachments } from '@/lib/email-templates/layout'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://hub.ilerigroup.com'

async function rmaSorumluBildir(alici: { email: string; name: string }, kayit: {
  id: string; tip: string; no: number; musteri: string; termin: string
}) {
  const { html, text } = renderEmail({
    module: 'Kalite',
    title: 'RMA/SMA sorumluluğu atandı',
    subtitle: `${kayit.tip} No ${kayit.no}`,
    bodyHtml:
      p(`Merhaba ${esc(alici.name)},`) +
      p('Bir RMA/SMA iade kaydına <strong>sorumlu</strong> olarak atandınız.'),
    infoRows: [
      { label: 'Kayıt', value: `${esc(kayit.tip)} No ${kayit.no}` },
      { label: 'Müşteri', value: esc(kayit.musteri) },
      { label: 'Termin', value: esc(kayit.termin) },
    ],
    afterHtml: p('Kök neden ve aksiyon alanlarını doldurmak için giriş yapabilirsiniz.'),
    cta: { label: 'Kaydı Aç', url: `${BASE_URL}/kalite/rma/${kayit.id}` },
    footnote: 'Ayrıntı için ILERIHub’a giriş yapın.',
  })

  await sendEmail([{ name: alici.name, email: alici.email }], 'RMA sorumluluğu', text, html, logoAttachments())
}
```

Bu çağrı hem stillenmiş HTML hem de şu düz metni üretir:

```
RMA/SMA sorumluluğu atandı
RMA No 42

Merhaba Ahmet,

Bir RMA/SMA iade kaydına sorumlu olarak atandınız.

Kayıt: RMA No 42
Müşteri: Acme A.Ş.
Termin: 30.09.2026

Kök neden ve aksiyon alanlarını doldurmak için giriş yapabilirsiniz.

Kaydı Aç: https://hub.ilerigroup.com/kalite/rma/42

Ayrıntı için ILERIHub'a giriş yapın. Bu e-posta ILERIHub Kalite tarafından otomatik gönderilmiştir.
İleri Group · 2026
```

## Ekran görüntüsü referansı — Akademi sertifika maili

Örnek "canonical" mail: **Akademi sertifika** ("Sertifikanız Hazır").
Kaynak şablon: `src/lib/email-templates/akademi/certificateIssued.ts` →
`akademiMail({ title: "Sertifikanız hazır", subtitle: "<tarih> · Sertifika No: <no>",
bodyHtml, infoRows: [Eğitim, Sertifika No, Geçerlilik], cta: "Sertifikayı Görüntüle",
footnote })`. Yerleşim (yukarıdan aşağıya):

```
┌────────────────────────────────────────────┐
│ [ILERIHub logo]                    AKADEMİ  │  ← logo şeridi + modül etiketi
├────────────────────────────────────────────┤
│ Sertifikanız hazır                          │  ← title
│ 22 Eylül 2026 · Sertifika No: AKD-2026-013  │  ← subtitle
│                                             │
│ Merhaba Ayşe Yılmaz,                        │  ← bodyHtml (p)
│ Tebrikler! "İş Güvenliği" eğitimini         │
│ başarıyla tamamladınız ve sertifikanız      │
│ düzenlendi.                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ Eğitim        İş Güvenliği              │ │  ← infoRows tablosu
│ │ Sertifika No  AKD-2026-013              │ │
│ │ Geçerlilik    22 Eylül 2028             │ │
│ └─────────────────────────────────────────┘ │
│ [ Sertifikayı Görüntüle ]                   │  ← cta (lacivert buton)
│ Buton çalışmıyorsa: hub.ilerigroup.com/...  │  ← otomatik fallback
│ ────────────────────────────────────────── │
│ Sertifikanızı PDF olarak indirebilir...     │  ← footnote
│ Bu e-posta ILERIHub Akademi tarafından...   │
│ İleri Group · 2026                          │
└────────────────────────────────────────────┘
```

Canlı görünümü test için: `POST /api/email/test` (yalnız ADMIN) veya
`NOTIFY_TEST_MODE=true` + `NOTIFY_TEST_EMAIL=<siz>` ile kendinize yönlendirin.
