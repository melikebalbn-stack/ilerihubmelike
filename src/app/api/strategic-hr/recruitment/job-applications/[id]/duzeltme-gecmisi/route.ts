import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { kullaniciAdi } from '@/lib/recruitment/bekleyen'

export const dynamic = 'force-dynamic'

// GET — Başvuru DÜZELTME geçmişi (kim, ne zaman, hangi alan, eski → yeni).
//
// Kaynak: PermissionAuditLog (targetType='JOB_APPLICATION'). YENİ TABLO AÇILMADI —
// bu tablo Y3'ten beri var ve `action + targetType + details(Json)` alanlarıyla RBAC
// dışı alanlar için de kullanılmak üzere tasarlanmış (bkz. audit-log.ts başlığı).
// Yazma tarafı: PATCH /api/strategic-hr/recruitment/job-applications/[id].
//
// Middleware /api/* KAPSAMAZ → route içi guard zorunlu.
// Yetki: recruitment.admin — YAZAN uçla AYNI kitle. Atanan müdür bu geçmişi GÖREMEZ:
// eski/yeni değerler arasında ona kapalı alanlar (ev adresi, doğum tarihi, maaş
// beklentisi) bulunabilir; detay ucundaki MANAGER_SELECT kısıtı burada da korunmalı.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!session.user.permissions?.includes('recruitment.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params

  const kayitlar = await prisma.permissionAuditLog.findMany({
    where: { targetType: 'JOB_APPLICATION', targetId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      createdAt: true,
      details: true,
      actor: {
        select: { id: true, name: true, firstName: true, lastName: true, email: true },
      },
    },
  })

  // details serbest JSON — şekli garanti değil. Ekran her satırda `degisiklikler`
  // dizisini bekliyor; yoksa boş dizi döndürülür (eski/bozuk kayıt sayfayı kırmasın).
  const gecmis = kayitlar.map((k) => {
    const d = k.details as { degisiklikler?: unknown } | null
    const degisiklikler = Array.isArray(d?.degisiklikler) ? d.degisiklikler : []
    return {
      id: k.id,
      action: k.action,
      createdAt: k.createdAt,
      degistiren: kullaniciAdi(k.actor ?? undefined),
      degisiklikler,
    }
  })

  return NextResponse.json({ gecmis })
}
