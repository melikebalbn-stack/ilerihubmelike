import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api-response'
import { getIsEmriByJob } from '@/lib/syteline/is-emri'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/entegrasyon/syteline/is-emri-ara?job=M002275577
 *
 * İş emri no girilince formun kendini doldurması için SALT OKUMA Syteline sorgusu
 * (ilk kullanıcı: Kalite Uygunsuzluk formu — ürün kodu + iş emri adedi).
 *
 * Auth: yalnız oturum. Diğer /entegrasyon/syteline uçları `entegrasyon.syteline`
 * izni ister; burada o izin ARANMAZ, çünkü bu uç senkron yönetimi değil form
 * yardımcısı — formu dolduran kalite kullanıcısında o izin yok. Dönen alanlar
 * iş emrinin kendi alanları; bağlantı bilgisi ya da credential sızdırmaz.
 *
 * MÜŞTERİ DÖNMEZ: Syteline'da job ile müşteriyi bağlayan alan yok (Melih, 6 Eki 2026) —
 * müşteri adı formda elle seçilir/yazılır.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const job = (req.nextUrl.searchParams.get('job') ?? '').trim()
  if (!job) return apiBadRequest('job parametresi zorunlu')
  if (job.length > 30) return apiBadRequest('job parametresi en çok 30 karakter olabilir')

  try {
    const rows = await getIsEmriByJob(job)
    // Form tek kayıt bekliyor; birden çok suffix varsa en güncel (suffix DESC) ilk sırada.
    const items = rows.map((r) => ({
      job: r.job?.trim() ?? job,
      suffix: r.suffix,
      // Uygunsuzluk formunda mamulUrunKodu alanına yazılır.
      urunKodu: r.item?.trim() ?? null,
      // "İş emri adedi" = qty_released (Melih onayı, 6 Eki 2026).
      adet: r.qty_released,
      tarih: r.job_date,
      durum: r.stat?.trim() ?? null,
      aciklama: r.description?.trim() ?? null,
    }))
    return apiSuccess({ job, bulundu: items.length > 0, items })
  } catch (e) {
    return apiError((e as Error)?.message ?? 'Syteline iş emri sorgusu başarısız', 502)
  }
}
