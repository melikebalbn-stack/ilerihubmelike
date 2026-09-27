import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { acilisDeneme } from '@/lib/izin/acilis-servis'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/acilis/deneme (multipart: dosya, tarih) — açılış bakiyesi DENEMESİ (izin.admin).
// DB'ye YAZMAZ; rapor slot dışı IZIN_IMPORT_DIR altına (700/600).
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission(['izin.admin', 'izin.bakiye.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await acilisDeneme(await req.formData(), userId)) })
  } catch (e) {
    return izinHata(e, 'Deneme çalıştırılamadı')
  }
}
