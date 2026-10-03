import { NextResponse } from 'next/server'
import { BagliKayitHatasi } from './bagimlilik'

// Pasifleştirme uçlarının ORTAK yardımcıları (A4).
//
// İstek gövdesi OPSİYONELDİR: eski istemciler gövdesiz POST atar → onay yok.
// Yalnız `{ "onay": true }` onay sayılır (truthy string/sayı sayılmaz).
export async function onayBayragiOku(request: Request, alan = 'onay'): Promise<boolean> {
  try {
    const govde = (await request.json()) as Record<string, unknown> | null
    return govde?.[alan] === true
  } catch {
    return false
  }
}

/**
 * Bağlı AKTİF kayıt varsa 409 + `kod: 'BAGLI_KAYIT_VAR'` + bağımlılık listesi
 * (istemci onay diyaloğu gösterir); diğer hatalarda mevcut davranış (400).
 */
export function pasiflestirHataYaniti(err: unknown, varsayilanMesaj: string): NextResponse {
  if (err instanceof BagliKayitHatasi) {
    return NextResponse.json(
      {
        ok: false,
        kod: 'BAGLI_KAYIT_VAR',
        message: err.message,
        bagimliliklar: err.bagimliliklar,
        zincirleme: err.zincirleme,
        notlar: err.notlar,
      },
      { status: 409 },
    )
  }
  const message = err instanceof Error ? err.message : varsayilanMesaj
  return NextResponse.json({ ok: false, message }, { status: 400 })
}
