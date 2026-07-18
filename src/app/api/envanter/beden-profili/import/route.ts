import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { executeBedenProfilImport, validateBedenProfilImport } from '@/lib/envanter/beden-profili-import'

// xlsx (SheetJS) Edge runtime'da çalışmaz — Node runtime zorunlu.
export const runtime = 'nodejs'

const MAX_DOSYA_BOYUTU = 10 * 1024 * 1024
const IZINLI_UZANTILAR = ['.xlsx']

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const user = session.user

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, message: 'Geçersiz form verisi.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: 'Dosya bulunamadı.' }, { status: 400 })
  }

  const dosyaAdi = file.name.toLowerCase()
  if (!IZINLI_UZANTILAR.some((uzanti) => dosyaAdi.endsWith(uzanti))) {
    return NextResponse.json(
      { ok: false, message: 'Sadece .xlsx dosyaları kabul edilir.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_DOSYA_BOYUTU) {
    return NextResponse.json(
      { ok: false, message: "Dosya 10MB'dan büyük olamaz." },
      { status: 400 },
    )
  }

  const mode = formData.get('mode') === 'execute' ? 'execute' : 'validate'
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    if (mode === 'validate') {
      const sonuc = await validateBedenProfilImport(buffer)
      return NextResponse.json({ ok: true, data: sonuc })
    }

    const sonuc = await executeBedenProfilImport(buffer, user.id)
    return NextResponse.json({
      ok: true,
      message: `İçeri aktarım tamamlandı — ${sonuc.guncellenen} kayıt güncellendi, ${sonuc.atlanan} satır atlandı.`,
      data: sonuc,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'İçeri aktarım başarısız oldu.' },
      { status: 400 },
    )
  }
}
