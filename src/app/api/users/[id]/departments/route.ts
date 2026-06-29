import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/users/[id]/departments — PR-FAZ2A
 * Kullanıcının "Görünür Bölümler" (gorunurBolumler) listesini günceller.
 * Yetki: admin.roles.manage (kullanıcı-rol ekranıyla aynı — SUPER_ADMIN).
 * Body: { gorunurBolumler: string[] } — DepartmentDefinition.name ile doğrulanır. Boş = tüm bölümler.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireUser()
  if (error) return error

  if (!session.user.permissions?.includes('admin.roles.manage')) {
    return NextResponse.json(
      { error: 'Görünür bölüm yönetimi için yetkiniz yok' },
      { status: 403 },
    )
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { gorunurBolumler?: unknown }

  if (!Array.isArray(body.gorunurBolumler)) {
    return NextResponse.json({ error: 'Geçersiz gorunurBolumler formatı' }, { status: 400 })
  }
  const incoming = [...new Set(
    body.gorunurBolumler.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean),
  )]

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!targetUser) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
  }

  // Geçerli bölüm adlarıyla doğrula (yalnız tanımlı DepartmentDefinition kabul)
  if (incoming.length > 0) {
    const validNames = new Set(
      (await prisma.departmentDefinition.findMany({ select: { name: true } })).map((d) => d.name),
    )
    const invalid = incoming.filter((b) => !validNames.has(b))
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Geçersiz bölüm(ler): ${invalid.join(', ')}` }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { gorunurBolumler: incoming },
    select: { id: true, gorunurBolumler: true },
  })

  return NextResponse.json({ ok: true, gorunurBolumler: updated.gorunurBolumler })
}
