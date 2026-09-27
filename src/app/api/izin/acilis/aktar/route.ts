import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { acilisAktar } from '@/lib/izin/acilis-servis'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/acilis/aktar (multipart: dosya, tarih, denemeSha256, onay=AKTAR) — GERÇEK aktarım
// (izin.bakiye.admin). Aynı dosyanın denemesi şart; eşik kapısı; tek transaction; geçiş tarihini yazar.
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('izin.bakiye.admin')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await acilisAktar(await req.formData(), userId)) })
  } catch (e) {
    return izinHata(e, 'Aktarım yapılamadı')
  }
}
