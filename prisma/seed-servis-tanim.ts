/**
 * ============================================================================
 * SERVİS TANIM PAKETİ — yerleşke · firma · güzergâh · durak · araç · sefer dilimi
 * ============================================================================
 *
 * Prod'da bu tablolar BOŞ. Göç script'i (--apply) tanım verisi YARATMAZ,
 * yalnız `kod`/`plaka` ile arar; bu paket o boşluğu doldurur.
 *
 * 🔴 ŞOFÖR EKLENMEDİ — kişisel veri, git'e girmez (Elif kararı, 2026-09-29).
 * Güzergâh→araç ANA varsayılan ataması da BOŞ — bkz. servis-tanim-verisi.ts
 * GUZERGAH_ARAC_ANA_ATAMA yorumu (liste ayrıca gelecek, gelene kadar yazılmaz).
 *
 * 🔴 BOOTSTRAP-ONLY + IDEMPOTENT (emsal: prisma/seed-permissions.ts)
 * Her kayıt `kod` ile aranır: VARSA DOKUNULMAZ, yoksa oluşturulur.
 * İki kez koşarsa zarar vermez, mevcut kaydın adını/alanını EZMEZ.
 * Satır SİLMEZ — kodda karşılığı kalmayan kayıt uyarı olarak listelenir.
 *
 * 🔴 DURAK KODU tek kaynaktan: src/lib/servis-yonetimi/servis-durak-kodu.ts
 * Göç script'i de aynı fonksiyonu kullanır (Melih'in kuralı, bkz. o dosyanın
 * birleştirme notu).
 *
 * 🔴 YERLEŞKE PARAMETRE — yer tutucu GÖMÜLMEDİ. Verilmezse script DURUR
 * (dry-run dahil; ServisGuzergah.yerleskeId NOT NULL). Melih gerçek adı
 * İdari İşler'den alıyor.
 *   npx tsx prisma/seed-servis-tanim.ts \
 *     --db=<veritabani> \
 *     --yerleske-kod=<kod> --yerleske-ad="<ad>"
 *
 * 🔴 FİRMA VE ARAÇ YAZILMAZ. --firma-ad KALDIRILDI. Araç verisi (ARACLAR)
 * gerçek firma adı gelene kadar BOŞ; boşken ne araç ne firma sorgusu/yazımı
 * yapılır. Araç/firma adında "PLACEHOLDER" geçen veri DB'ye dokunmadan
 * hata verir.
 *
 * 🔴 TEK PLAN, İKİ MOD: dry-run ve apply AYNI planla() planını kullanır
 * (src/lib/servis-yonetimi/servis-tanim-seed-mantigi.ts). Plan, apply'da
 * oluşacak HER satırı varlık türüne göre sayar (yerleşke, firma, güzergâh,
 * durak, bağ, araç, sefer dilimi). Apply gerçek create sayısını plana
 * karşı doğrular; fark varsa hata verir.
 *
 * 🔴 --apply OLMADAN HİÇBİR ŞEY YAZMAZ (göç script'iyle aynı desen).
 *
 * KAYNAK: veri iki katmanlı (bkz. servis-tanim-verisi.ts):
 *   1. dev DB'den okunan yerleşmiş tanım verisi — 9 güzergâh, 106 durak
 *   2. İdari İşler eşleme tablosundan gelen yeni duraklar → toplam 138
 * 🔴 Yeni durakların SIRASI GERÇEK DEĞİL: güzergâhtaki fiziksel sırası
 * bilinmediği için mevcut max'tan devam ettirildi. Atama ve kapasite
 * sıradan bağımsız olduğu için FAZ 1+2 çekirdeği etkilenmiyor; yalnız
 * ekrandaki görünüm sırası yanlış. TODO(elif).
 *
 * 🔴 AÇIK 6 MADDE — İdari İşler'e soruldu, cevap BEKLENİYOR.
 * Aşağıda `TODO(idari-isler)` ile işaretli. Hiçbirine varsayılan
 * UYDURULMADI; cevap gelene kadar o satırlar bu dosyada YOK.
 *   1. GÜL PASTANESİ (2 kişi) ve KARAKOL (1) — cevapsız
 *   2. ŞEKERPINAR — sayfa 1 iki ad, sayfa 2 "tek durak" çelişkisi (5 kişi)
 *   3. MEZBAHANE — "FARKLI AD" yazılmış, anlaşılmadı (2 kişi)
 *   4. AKSE üçlüsü — kanonik ad hangisi (3 kişi)
 *   5. ERİŞ kümesi — 5 metin kaç durak (5 kişi)
 *   6. GÜNSAŞ FIRIN — ad teyidi (1 kişi)
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'
import {
  calistir,
  hataKodlariniKur,
  type Baglanti,
} from '../src/lib/servis-yonetimi/servis-tanim-seed-calistir'
import type { TanimPrisma } from '../src/lib/servis-yonetimi/servis-tanim-seed-mantigi'

export * from '../src/lib/servis-yonetimi/servis-tanim-verisi'

// ----------------------------------------------------------------------------
// GİRİŞ NOKTASI — akış servis-tanim-seed-calistir.ts'te (test edilebilir).
//
// 🔴 ÇIKIŞ KODU: calistir() 0 ya da 1 döner; süreç o kodla çıkar. Prod komut
// zinciri `&&` ile ilerlediği için hata ASLA 0 dönmemeli. Disconnect akışın
// finally'sinde yapılır ve asıl hatayı yutmaz. Yakalanmamış hata / unhandled
// rejection de 1 ile biter. Hata stderr'e, başarı çıktısı stdout'a gider.
// ----------------------------------------------------------------------------

function gercekBaglan(): Baglanti {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  return {
    prisma: prisma as unknown as TanimPrisma,
    aktifVeritabani: async () => {
      const [{ current_database: ad }] = await prisma.$queryRaw<{ current_database: string }[]>`
        SELECT current_database()
      `
      return ad
    },
    kapat: async () => {
      await prisma.$disconnect()
      await pool.end()
    },
  }
}

hataKodlariniKur(process, console.error)
calistir(process.argv.slice(2), { baglan: gercekBaglan, log: console.log, err: console.error }).then(
  (kod) => process.exit(kod),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
