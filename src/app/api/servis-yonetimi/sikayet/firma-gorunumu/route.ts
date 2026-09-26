import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import type { ServisSikayetDurumu, ServisSikayetKategori, ServisSikayetKaynagi } from '@/generated/prisma'
import { sikayetFiltresiCoz, sikayetFirmaListesiGetir } from '@/lib/servis-yonetimi/sikayet'
import { firmaSiniriniDogrula, FirmaSiniriIhlali } from '@/lib/servis-yonetimi/sikayet-firma-siniri'

export const dynamic = 'force-dynamic'

// MASTER Madde 46/47 — TAŞERON FİRMAYA gidecek çıktıların kaynağı.
//
// 🔴 KVKK: şikâyetçi kimliği bu uçtan ASLA dönmez. Bu bir maskeleme değil —
// sikayetFirmaListesiGetir() şikâyetçi alanlarını prisma select'ine HİÇ
// koymaz, yani veri sunucuya bile gelmez. Maskelenen veri yine sunucudan
// geçer ve bir loga/hata çıktısına düşebilirdi.
//
// İş mantığı burada tekrar edilmez; filtreler ve select sorgu katmanında.

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.sikayet.view')
  if (error) return error

  try {
    const sp = request.nextUrl.searchParams
    const data = await sikayetFirmaListesiGetir(sikayetFiltresiCoz(sp))

    // 🔴 SINIR BEKÇİSİ (fail-closed): sorgu katmanı bir gün yanlışlıkla
    // şikâyetçi seçerse veri firmaya ULAŞMADAN burada durur. Ayıklama YOK —
    // hata görünür olsun ki kaynağı (select) düzeltilsin. 5E'deki dışa
    // aktarım da AYNI bekçiyi kullanacak.
    firmaSiniriniDogrula(data)

    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    if (err instanceof FirmaSiniriIhlali) {
      // Gövde GÖNDERİLMEZ. Ayrıntı yalnız sunucu loguna; yanıt nötr.
      console.error('[firma-siniri] KVKK sızıntısı engellendi:', err.yollar)
      return NextResponse.json(
        { ok: false, message: 'Firma görünümü üretilemedi (veri sınırı ihlali).' },
        { status: 500 },
      )
    }
    console.error('Şikâyet firma görünümü hatası:', err)
    return NextResponse.json({ ok: false, message: 'Firma görünümü alınırken hata oluştu.' }, { status: 500 })
  }
}
