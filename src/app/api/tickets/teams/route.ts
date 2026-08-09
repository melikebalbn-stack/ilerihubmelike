import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { validateMembersInput, serializeMembers, parseMembers, type TeamMember } from '@/lib/tickets/team-members'

/**
 * IT Takımları (TicketTeam) — Faz 1: yalnız veri + CRUD.
 * Ticket akışı (havuz ataması, görünürlük, kapatma yetkisi, bildirim) FAZ 2-4.
 *
 * HAVUZ MODELİ: ticket takıma düşer, üyelerden biri devralana kadar havuzda kalır.
 * Bu dosya o akışı UYGULAMAZ; yalnız takım/üye verisini yönetir.
 *
 * Yetki: okuma oturum sahibi herkes (kategori formu takım seçebilsin diye),
 * yazma ADMIN/SUPER_ADMIN — kategori CRUD'u ile aynı desen.
 */

/**
 * members[] e-postalarını User tablosuyla eşler.
 * - Bulunamayan e-posta → hata (yanlış yazım sessizce kaydedilmesin)
 * - name boş bırakılmışsa User.name'den doldurulur
 */
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

// GET - Takım listesi (members parse edilmiş, bağlı kategori/ticket sayılarıyla)
export async function GET(_request: NextRequest) {
  try {
    const { error } = await requireUser()
    if (error) return error

    const teams = await prisma.ticketTeam.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { tickets: true, categories: true } },
      },
    })

    // members Text → tip güvenli dizi (istemci JSON.parse ile uğraşmasın)
    return NextResponse.json(
      teams.map((t) => ({ ...t, members: parseMembers(t.members) })),
    )
  } catch (error) {
    console.error('Takım listesi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Takım oluştur (Admin only)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, leadEmail, members } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Takım adı zorunludur' }, { status: 400 })
    }

    const parsed = validateMembersInput(members)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const resolved = await resolveMembers(parsed.members)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })

    // leadEmail verilmişse üyelerden biri olmalı (lider takımın dışından olamaz)
    const normalizedLead =
      typeof leadEmail === 'string' && leadEmail.trim() !== '' ? leadEmail.toLowerCase().trim() : null
    if (normalizedLead && !resolved.members.some((m) => m.email === normalizedLead)) {
      return NextResponse.json({ error: 'Ekip lideri üyeler arasında olmalıdır' }, { status: 400 })
    }

    const team = await prisma.ticketTeam.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        leadEmail: normalizedLead,
        leadName: normalizedLead
          ? resolved.members.find((m) => m.email === normalizedLead)?.name ?? null
          : null,
        members: serializeMembers(resolved.members),
      },
    })

    return NextResponse.json({ ...team, members: parseMembers(team.members) }, { status: 201 })
  } catch (error) {
    // name @unique → aynı adla ikinci takım
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Bu adda bir takım zaten var' }, { status: 400 })
    }
    console.error('Takım oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
