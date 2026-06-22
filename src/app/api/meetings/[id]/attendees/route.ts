import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// POST - Katılımcı ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { id: meetingId } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Toplantı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const {
      userId,
      userEmail,
      userName, // LDAP'dan gelen kullanıcı adı
      userDepartment, // LDAP'dan gelen departman
      userJobTitle, // LDAP'dan gelen ünvan
      externalName,
      externalEmail,
      externalCompany,
      externalTitle,
      role = 'PARTICIPANT'
    } = body

    // Dahili veya harici katılımcı olmalı
    if (!userId && !userEmail && !externalName) {
      return NextResponse.json(
        { error: 'Kullanıcı veya misafir bilgisi gerekli' },
        { status: 400 }
      )
    }

    // Email'den database ID'ye çevir
    let resolvedUserId: string | null = null
    let fallbackName: string | null = null // DB'de yoksa LDAP adını sakla
    let fallbackDepartment: string | null = null // DB'de yoksa LDAP departmanını sakla
    let fallbackTitle: string | null = null // DB'de yoksa LDAP ünvanını sakla

    const normalizedUserEmail = typeof userEmail === 'string'
      ? userEmail.toLowerCase()
      : null

    if (normalizedUserEmail) {
      const user = await prisma.user.findUnique({
        where: { email: normalizedUserEmail },
        select: { id: true }
      })
      resolvedUserId = user?.id || null

      // Kullanıcı DB'de yoksa LDAP bilgilerini fallback olarak kullan
      if (!resolvedUserId) {
        if (userName) fallbackName = userName
        if (userDepartment) fallbackDepartment = userDepartment
        if (userJobTitle) fallbackTitle = userJobTitle
      }
    } else if (userId) {
      resolvedUserId = userId
    }

    // Dahili kullanıcı zaten ekli mi kontrol et
    if (resolvedUserId) {
      const existing = await prisma.meetingAttendee.findUnique({
        where: {
          meetingId_userId: {
            meetingId,
            userId: resolvedUserId
          }
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Bu kullanıcı zaten katılımcı listesinde' },
          { status: 400 }
        )
      }
    }

    const attendee = await prisma.meetingAttendee.create({
      data: {
        meetingId,
        userId: resolvedUserId,
        // DB'de olmayan LDAP kullanıcıları için bilgilerini external alanlara kaydet
        externalName: externalName || fallbackName || null,
        externalEmail: externalEmail || (fallbackName ? normalizedUserEmail : null),
        externalCompany: externalCompany || fallbackDepartment || null,
        externalTitle: externalTitle || fallbackTitle || null,
        role,
        inviteStatus: 'PENDING',
        attendanceStatus: 'UNKNOWN'
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, department: true, jobTitle: true }
        }
      }
    })

    return NextResponse.json(attendee, { status: 201 })
  } catch (error) {
    console.error('Katılımcı eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Katılımcı güncelle (katılım durumu vb.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const body = await request.json()
    const {
      attendeeId,
      inviteStatus,
      attendanceStatus,
      absenceReason,
      role,
      arrivalTime,
      departureTime
    } = body

    if (!attendeeId) {
      return NextResponse.json({ error: 'Katılımcı ID gerekli' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (inviteStatus !== undefined) updateData.inviteStatus = inviteStatus
    if (attendanceStatus !== undefined) updateData.attendanceStatus = attendanceStatus
    if (absenceReason !== undefined) updateData.absenceReason = absenceReason
    if (role !== undefined) updateData.role = role
    if (arrivalTime !== undefined) updateData.arrivalTime = arrivalTime ? new Date(arrivalTime) : null
    if (departureTime !== undefined) updateData.departureTime = departureTime ? new Date(departureTime) : null

    const attendee = await prisma.meetingAttendee.update({
      where: { id: attendeeId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, department: true, jobTitle: true }
        }
      }
    })

    return NextResponse.json(attendee)
  } catch (error) {
    console.error('Katılımcı güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Katılımcı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-meetings: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const attendeeId = searchParams.get('attendeeId')

    if (!attendeeId) {
      return NextResponse.json({ error: 'Katılımcı ID gerekli' }, { status: 400 })
    }

    await prisma.meetingAttendee.delete({
      where: { id: attendeeId }
    })

    return NextResponse.json({ message: 'Katılımcı silindi' })
  } catch (error) {
    console.error('Katılımcı silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
