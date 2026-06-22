import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTrainingFormPDFBuffer, TrainingForPDF } from '@/lib/pdf/training-form-pdf'
import { requireUser } from '@/lib/auth/require-user'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'QUALITY_MANAGER']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireUser — role + isCreator check (requireBgysSorumlu
    // burada uygulanmaz çünkü role yetersizliğinde isCreator OR'u var)
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const training = await prisma.iso27001Training.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
                jobTitle: true
              }
            }
          },
          orderBy: { assignedAt: 'asc' }
        }
      }
    })

    if (!training) {
      return NextResponse.json({ error: 'Eğitim bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü: admin/IT_MANAGER/QUALITY_MANAGER veya eğitimi oluşturan kişi
    const isAllowed = user.role && ALLOWED_ROLES.includes(user.role)
    const isCreator = training.createdById === user.id

    if (!isAllowed && !isCreator) {
      return NextResponse.json(
        { error: 'Bu eğitimin PDF çıktısını alma yetkiniz yok' },
        { status: 403 }
      )
    }

    // Training verisini PDF formatına dönüştür
    const trainingForPDF: TrainingForPDF = {
      id: training.id,
      trainingNumber: training.trainingNumber,
      title: training.title,
      description: training.description,
      trainingType: training.trainingType,
      duration: training.duration,
      location: training.location,
      trainerName: training.trainerName,
      trainerTitle: training.trainerTitle,
      trainerEmail: training.trainerEmail,
      trainingDate: training.trainingDate.toISOString(),
      controlId: training.controlId,
      status: training.status,
      participants: training.participants.map(p => ({
        id: p.id,
        name: p.name,
        title: p.title,
        department: p.department,
        email: p.email,
        attended: p.attended,
        signedAt: p.signedAt?.toISOString() || null,
      })),
      assignments: training.assignments.map(a => ({
        id: a.id,
        userId: a.userId,
        status: a.status,
        signedAt: a.signedAt?.toISOString() || null,
        completedAt: a.completedAt?.toISOString() || null,
        user: {
          id: a.user.id,
          name: a.user.name || 'Bilinmiyor',
          email: a.user.email,
          department: a.user.department,
          jobTitle: a.user.jobTitle,
        }
      }))
    }

    // PDF oluştur
    const pdfBuffer = generateTrainingFormPDFBuffer(trainingForPDF)

    // Dosya adını oluştur
    const fileName = `Egitim_Katilim_Formu_${training.trainingNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('PDF oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
