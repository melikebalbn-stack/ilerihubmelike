import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAllADUsers } from '@/lib/azure-ad'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    let adUsers
    try {
      adUsers = await getAllADUsers()
    } catch (error: any) {
      return NextResponse.json({
        error: 'Azure AD bağlantısı kurulamadı',
        details: error.message || 'Azure AD credentials not configured. Lütfen AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID ve AZURE_AD_CLIENT_SECRET ortam değişkenlerini kontrol edin.',
      }, { status: 503 })
    }

    let synced = 0
    let created = 0
    let skipped = 0

    for (const adUser of adUsers) {
      const email = (adUser.mail || adUser.userPrincipalName || '').toLowerCase().trim()
      if (!email) {
        skipped++
        continue
      }

      try {
        // Try to find existing personnel by Azure AD email
        const existing = await prisma.personnel.findFirst({
          where: { azureAdEmail: email },
        })

        if (existing) {
          // Update existing personnel with AD data
          await prisma.personnel.update({
            where: { id: existing.id },
            data: {
              azureAdId: adUser.id,
              azureAdEmail: email,
              ...(adUser.jobTitle && { gorev: adUser.jobTitle }),
              ...(adUser.department && { bolum: adUser.department }),
              ...(adUser.mobilePhone && { telefon: adUser.mobilePhone }),
            },
          })
          synced++
        } else {
          // Try to match by name or email pattern
          const nameParts = adUser.displayName.split(' ')
          const adSoyad = adUser.displayName

          // Check if a personnel exists with matching name (fuzzy)
          const nameMatch = await prisma.personnel.findFirst({
            where: {
              adSoyad: { equals: adSoyad, mode: 'insensitive' },
              azureAdEmail: null, // Only unlinked records
            },
          })

          if (nameMatch) {
            await prisma.personnel.update({
              where: { id: nameMatch.id },
              data: {
                azureAdId: adUser.id,
                azureAdEmail: email,
                ...(adUser.mobilePhone && { telefon: adUser.mobilePhone }),
              },
            })
            synced++
          } else {
            // Create new personnel record
            // Generate a unique sicilNo for Azure-sourced records
            const lastPersonnel = await prisma.personnel.findFirst({
              where: { sicilNo: { startsWith: 'AZ-' } },
              orderBy: { sicilNo: 'desc' },
            })
            const lastNum = lastPersonnel
              ? parseInt(lastPersonnel.sicilNo.replace('AZ-', '')) || 0
              : 0
            const newSicilNo = `AZ-${String(lastNum + 1).padStart(4, '0')}`

            await prisma.personnel.create({
              data: {
                sicilNo: newSicilNo,
                adSoyad: adUser.displayName,
                cinsiyet: 'MALE', // Default, to be updated manually
                yakaRengi: 'BEYAZ',
                iseGirisTarihi: new Date(),
                gorev: adUser.jobTitle || 'Belirtilmemiş',
                bolum: adUser.department || 'Belirtilmemiş',
                telefon: adUser.mobilePhone || null,
                azureAdId: adUser.id,
                azureAdEmail: email,
                createdBy: session.user.id,
              },
            })
            created++
          }
        }
      } catch (error: any) {
        console.error(`Azure AD sync hatası (${email}):`, error.message)
        skipped++
      }
    }

    return NextResponse.json({
      synced,
      created,
      skipped,
      total: adUsers.length,
    })
  } catch (error) {
    console.error('Azure AD sync hatası:', error)
    return NextResponse.json({ error: 'Azure AD sync sırasında bir hata oluştu' }, { status: 500 })
  }
}
