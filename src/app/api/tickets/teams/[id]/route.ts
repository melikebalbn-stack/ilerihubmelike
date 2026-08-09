import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { validateMembersInput, serializeMembers, parseMembers, type TeamMember } from '@/lib/tickets/team-members'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** POST ile aynı doğrulama (bkz. ../route.ts) — üye e-postaları User'da var mı, aktif mi. */
async function resolveMembers(
  members: TeamMember[],
): Promise<{ ok: true; members: TeamMember[] } | { ok: false; error: string }> {
  if (members.length === 0) return { ok: true, members: [] }

  const emails = members.map((m) => m.email)
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, name: true, isActive: true },
  })
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))

  const eksik = emails.filter((e) => !byEmail.has(e))
  if (eksik.length > 0) {
    return { ok: false, error: `Kullanıcı bulunamadı: ${eksik.join(', ')}` }
  }
  const pasif = emails.filter((e) => byEmail.get(e)?.isActive === false)
  if (pasif.length > 0) {
    return { ok: false, error: `Pasif kullanıcı takıma eklenemez: ${pasif.join(', ')}` }
  }

  return {
    ok: true,
    members: members.map((m) => ({
      email: m.email,
      name: m.name || byEmail.get(m.email)?.name || m.email,
    })),
  }
}

// PUT - Takım güncelle (ad/açıklama/lider/üye ekle-çıkar). Admin only.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.ticketTeam.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Takım bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, leadEmail, members, isActive } = body

    // KISMİ güncelleme: yalnız gönderilen alanlar yazılır.
    const data: Record<string, unknown> = {}

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Takım adı boş olamaz' }, { status: 400 })
      }
      data.name = name.trim()
    }
    if (description !== undefined) data.description = description?.trim() || null
    if (isActive !== undefined) data.isActive = isActive === true

    // Lider kontrolü, GÜNCEL üye listesine göre yapılmalı: members bu istekte
    // değişiyorsa yeni listeye, değişmiyorsa DB'deki mevcut listeye bakılır.
    let effectiveMembers: TeamMember[] = parseMembers(existing.members)

    if (members !== undefined) {
      const parsed = validateMembersInput(members)
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

      const resolved = await resolveMembers(parsed.members)
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })

      effectiveMembers = resolved.members
      data.members = serializeMembers(resolved.members)
    }

    if (leadEmail !== undefined) {
      const normalizedLead =
        typeof leadEmail === 'string' && leadEmail.trim() !== '' ? leadEmail.toLowerCase().trim() : null
      if (normalizedLead && !effectiveMembers.some((m) => m.email === normalizedLead)) {
        return NextResponse.json({ error: 'Ekip lideri üyeler arasında olmalıdır' }, { status: 400 })
      }
      data.leadEmail = normalizedLead
      data.leadName = normalizedLead
        ? effectiveMembers.find((m) => m.email === normalizedLead)?.name ?? null
        : null
    } else if (members !== undefined && existing.leadEmail) {
      // Üye listesi değişti ve mevcut lider listeden çıkarıldıysa liderliği düşür
      // (aksi halde takımda olmayan biri lider olarak kalırdı).
      const halaUye = effectiveMembers.some((m) => m.email === existing.leadEmail)
      if (!halaUye) {
        data.leadEmail = null
        data.leadName = null
      }
    }

    const team = await prisma.ticketTeam.update({ where: { id }, data })

    return NextResponse.json({ ...team, members: parseMembers(team.members) })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Bu adda bir takım zaten var' }, { status: 400 })
    }
    console.error('Takım güncelleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// DELETE - Takım sil (Admin only). Bağlı kayıt varsa ENGELLE.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.ticketTeam.findUnique({
      where: { id },
      include: { _count: { select: { tickets: true, categories: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Takım bulunamadı' }, { status: 404 })
    }

    // Kategori bağı: FK NOT NULL değil ama sessiz kopma istemiyoruz — önce
    // kategoriden kaldırılsın. Ticket bağı: FK ON DELETE SET NULL olduğu için
    // silme geçmiş ticket'ların takım bilgisini sessizce siler → engelle.
    const bagli: string[] = []
    if (existing._count.categories > 0) bagli.push(`${existing._count.categories} kategori`)
    if (existing._count.tickets > 0) bagli.push(`${existing._count.tickets} ticket`)

    if (bagli.length > 0) {
      return NextResponse.json(
        {
          error:
            `Bu takıma bağlı ${bagli.join(' ve ')} var. Silmek yerine pasife almayı ` +
            `düşünün (isActive=false) veya önce bağları kaldırın.`,
        },
        { status: 400 },
      )
    }

    await prisma.ticketTeam.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Takım silme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
