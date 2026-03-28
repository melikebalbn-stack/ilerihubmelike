import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateAuditReportPDFBuffer, AuditForPDF } from '@/lib/pdf/audit-report-pdf'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'QUALITY_MANAGER']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    const isAllowed = currentUser.role && ALLOWED_ROLES.includes(currentUser.role)
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Bu denetim raporunun PDF çıktısını alma yetkiniz yok' },
        { status: 403 }
      )
    }

    const audit = await prisma.iso27001Audit.findUnique({
      where: { id },
      include: {
        teamMembers: {
          orderBy: { createdAt: 'asc' }
        },
        findings: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!audit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    // Audit verisini PDF formatına dönüştür
    const auditForPDF: AuditForPDF = {
      id: audit.id,
      auditNumber: audit.auditNumber,
      title: audit.title,
      description: audit.description,
      auditType: audit.auditType,
      scope: audit.scope,
      clauses: audit.clauses,
      controls: audit.controls,
      plannedDate: audit.plannedDate.toISOString(),
      startDate: audit.startDate?.toISOString() || null,
      endDate: audit.endDate?.toISOString() || null,
      leadAuditorName: audit.leadAuditorName,
      leadAuditorEmail: audit.leadAuditorEmail,
      auditeeName: audit.auditeeName,
      auditeeEmail: audit.auditeeEmail,
      auditeeDepartment: audit.auditeeDepartment,
      status: audit.status,
      summary: audit.summary,
      conclusion: audit.conclusion,
      teamMembers: audit.teamMembers.map(m => ({
        id: m.id,
        memberId: m.memberId,
        memberName: m.memberName,
        memberEmail: m.memberEmail,
        role: m.role,
      })),
      findings: audit.findings.map(f => ({
        id: f.id,
        findingNumber: f.findingNumber,
        findingType: f.findingType,
        title: f.title,
        description: f.description,
        evidence: f.evidence,
        severity: f.severity,
        status: f.status,
        controlId: f.controlId,
        clause: f.clause,
        correctiveAction: f.correctiveAction,
        responsibleName: f.responsibleName,
        dueDate: f.dueDate?.toISOString() || null,
        completedDate: f.completedDate?.toISOString() || null,
      }))
    }

    // PDF oluştur
    const pdfBuffer = generateAuditReportPDFBuffer(auditForPDF)

    // Dosya adını oluştur
    const fileName = `Ic_Denetim_Raporu_${audit.auditNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Denetim PDF oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
