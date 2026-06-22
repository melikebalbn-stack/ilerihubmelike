import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAuditReportPDFBuffer, AuditForPDF } from '@/lib/pdf/audit-report-pdf'
import { requireBgysSorumlu } from '@/lib/permissions/bgys'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireBgysSorumlu — role + email allowlist tek helper
    const { error } = await requireBgysSorumlu()
    if (error) return error

    const { id } = await params

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
