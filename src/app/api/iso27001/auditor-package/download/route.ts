import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import archiver from 'archiver'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

// Label maps
const riskLevelLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
}

const riskTreatmentLabels: Record<string, string> = {
  AVOID: 'Kaçınma',
  MITIGATE: 'Azaltma',
  TRANSFER: 'Transfer',
  ACCEPT: 'Kabul',
}

const riskStatusLabels: Record<string, string> = {
  OPEN: 'Açık',
  IN_TREATMENT: 'İşleniyor',
  CLOSED: 'Kapatıldı',
  MONITORING: 'İzleniyor',
}

const controlStatusLabels: Record<string, string> = {
  NOT_APPLICABLE: 'Uygulanmaz',
  NOT_IMPLEMENTED: 'Uygulanmadı',
  PARTIALLY: 'Kısmen',
  IMPLEMENTED: 'Uygulandı',
  EFFECTIVE: 'Etkin',
}

const controlCategoryLabels: Record<string, string> = {
  ORGANIZATIONAL: 'Organizasyonel',
  PEOPLE: 'İnsan',
  PHYSICAL: 'Fiziksel',
  TECHNOLOGICAL: 'Teknolojik',
}

const auditTypeLabels: Record<string, string> = {
  INTERNAL: 'İç Denetim',
  EXTERNAL: 'Dış Denetim',
  SURVEILLANCE: 'Gözetim',
  CERTIFICATION: 'Belgelendirme',
  SUPPLIER: 'Tedarikçi',
}

const auditStatusLabels: Record<string, string> = {
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

const findingTypeLabels: Record<string, string> = {
  MAJOR: 'Majör',
  MINOR: 'Minör',
  OBSERVATION: 'Gözlem',
  OPPORTUNITY: 'İyileştirme Fırsatı',
}

const findingStatusLabels: Record<string, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'Devam Ediyor',
  CLOSED: 'Kapatıldı',
  VERIFIED: 'Doğrulandı',
}

const incidentCategoryLabels: Record<string, string> = {
  CYBER_ATTACK: 'Siber Saldırı',
  UNAUTHORIZED_ACCESS: 'Yetkisiz Erişim',
  DATA_BREACH: 'Veri İhlali',
  SYSTEM_FAILURE: 'Sistem Arızası',
  PHYSICAL_SECURITY: 'Fiziksel Güvenlik',
  HUMAN_ERROR: 'İnsan Hatası',
  POLICY_VIOLATION: 'Politika İhlali',
  SUPPLIER_RELATED: 'Tedarikçi Kaynaklı',
}

const incidentSeverityLabels: Record<string, string> = {
  CRITICAL: 'Kritik',
  HIGH: 'Yüksek',
  MEDIUM: 'Orta',
  LOW: 'Düşük',
}

const incidentStatusLabels: Record<string, string> = {
  OPEN: 'Açık',
  INVESTIGATING: 'İnceleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapatıldı',
  ON_HOLD: 'Beklemede',
}

const trainingTypeLabels: Record<string, string> = {
  AWARENESS: 'Farkındalık',
  INDUCTION: 'Oryantasyon',
  MANDATORY: 'Zorunlu',
  SPECIALIZED: 'Uzmanlık',
  REFRESHER: 'Tazeleme',
}

const trainingStatusLabels: Record<string, string> = {
  DRAFT: 'Taslak',
  PLANNED: 'Planlandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

const reviewStatusLabels: Record<string, string> = {
  DRAFT: 'Taslak',
  COMPLETED: 'Tamamlandı',
  APPROVED: 'Onaylandı',
}

const assetCategoryLabels: Record<string, string> = {
  INFORMATION: 'Bilgi',
  SOFTWARE: 'Yazılım',
  HARDWARE: 'Donanım',
  NETWORK: 'Ağ',
  PERSONNEL: 'İnsan Kaynağı',
  PHYSICAL: 'Fiziksel',
  SERVICE: 'Hizmet',
  INTANGIBLE: 'Soyut',
}

const assetStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  UNDER_MAINTENANCE: 'Bakımda',
  DISPOSED: 'Elden Çıkarıldı',
  LOST: 'Kayıp',
}

const classificationLabels: Record<string, string> = {
  PUBLIC: 'Açık',
  INTERNAL: 'Dahili',
  CONFIDENTIAL: 'Gizli',
  RESTRICTED: 'Çok Gizli',
}

const supplierServiceTypeLabels: Record<string, string> = {
  IT_SERVICES: 'BT Hizmetleri',
  CLOUD_SERVICES: 'Bulut Hizmetleri',
  SECURITY_SERVICES: 'Güvenlik Hizmetleri',
  MAINTENANCE: 'Bakım Hizmetleri',
  TELECOM: 'Telekomünikasyon',
  CONSULTING: 'Danışmanlık',
  CLEANING: 'Temizlik',
  SECURITY_PHYSICAL: 'Fiziksel Güvenlik',
  TRANSPORTATION: 'Taşımacılık / Lojistik',
  CATERING: 'Yemek Hizmeti',
  TRAINING: 'Eğitim Hizmeti',
  OTHER: 'Diğer',
}

const supplierGroupLabels: Record<string, string> = {
  A_APPROVED: 'A Grubu (Onaylı)',
  B_CANDIDATE: 'B Grubu (Aday)',
  C_REJECTED: 'C Grubu (Yetersiz)',
  PENDING: 'Beklemede',
}

const supplierStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  SUSPENDED: 'Askıya Alınmış',
  BLACKLISTED: 'Kara Liste',
}

const supplierBGRiskLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
}

// Helper: fileUrl → fiziksel path
function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl) return ''
  const match = fileUrl.match(/\/api\/files\/(.+)/)
  if (match) return path.join(process.cwd(), 'public', decodeURIComponent(match[1]))
  if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
    return path.join(process.cwd(), 'public', fileUrl.replace(/^\//, ''))
  }
  return ''
}

// Helper: Tarihi formatla
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

// Helper: Dosya adını güvenli hale getir
function safeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const userRole = (session.user as any).role || 'EMPLOYEE'
    const allowedRoles = ['IT_MANAGER', 'QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    // Tüm verileri topla
    const [
      documents,
      controls,
      risks,
      audits,
      auditPrograms,
      incidents,
      trainings,
      trainingAssignments,
      managementReviews,
      assets,
      evidences,
      suppliers,
    ] = await Promise.all([
      prisma.iso27001Document.findMany({
        include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { documentNumber: 'asc' },
      }),
      prisma.iso27001Control.findMany({
        include: { evidences: true },
        orderBy: { controlId: 'asc' },
      }),
      prisma.iso27001Risk.findMany({ orderBy: { riskNumber: 'asc' } }),
      prisma.iso27001Audit.findMany({
        include: { findings: true, teamMembers: true },
        orderBy: { plannedDate: 'desc' },
      }),
      prisma.iso27001AuditProgram.findMany({
        include: { auditors: true, planItems: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { year: 'desc' },
      }),
      prisma.iso27001Incident.findMany({
        include: { reportedBy: { select: { name: true, email: true } } },
        orderBy: { detectedAt: 'desc' },
      }),
      prisma.iso27001Training.findMany({
        include: { participants: true },
        orderBy: { trainingDate: 'desc' },
      }),
      prisma.iso27001TrainingAssignment.findMany({
        include: {
          user: { select: { name: true, email: true, department: true } },
          training: { select: { title: true, trainingNumber: true } },
        },
        orderBy: { signedAt: 'desc' },
      }),
      prisma.iso27001ManagementReview.findMany({ orderBy: { reviewDate: 'desc' } }),
      prisma.iso27001Asset.findMany({ orderBy: { assetNumber: 'asc' } }),
      prisma.iso27001Evidence.findMany({
        where: { fileUrl: { not: null } },
        include: { control: { select: { controlId: true, title: true } } },
      }),
      prisma.supplier.findMany({
        include: {
          evaluations: {
            orderBy: { evaluationDate: 'desc' },
            take: 1,
            include: {
              criteria: {
                include: { criteria: true },
                orderBy: { criteria: { sortOrder: 'asc' } },
              },
            },
          },
        },
        orderBy: { companyName: 'asc' },
      }),
    ])

    const today = new Date().toISOString().split('T')[0]
    const year = new Date().getFullYear()
    const rootDir = `ILERI-GROUP-ISO27001-Denetci-Paketi-${year}`
    const userName = session.user.name || session.user.email || '-'

    // ZIP oluştur (streaming)
    const archive = archiver('zip', { zlib: { level: 5 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const archiveFinished = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', (err: Error) => reject(err))
    })

    // ==========================================
    // 01-Politika-ve-Prosedurler (fiziksel dosyalar)
    // ==========================================
    const policyDocs = documents.filter(d =>
      ['POLICY', 'PROCEDURE', 'MANDATORY', 'GUIDELINE', 'FORM'].includes(d.category)
    )
    const addedPolicyFiles: string[] = []
    for (const doc of policyDocs) {
      if (doc.fileUrl) {
        const physPath = resolveFileUrl(doc.fileUrl)
        if (physPath && fs.existsSync(physPath)) {
          const ext = path.extname(doc.fileName || physPath)
          const fileName = safeName(doc.title || doc.documentNumber) + ext
          archive.file(physPath, { name: `${rootDir}/01-Politika-ve-Prosedurler/${fileName}` })
          addedPolicyFiles.push(fileName)
        }
      }
    }

    // ==========================================
    // 02-Uygulanabilirlik-Beyani-SoA (Excel)
    // ==========================================
    const soaData = controls.map(c => ({
      'Kontrol No': c.controlId,
      'Başlık': c.titleTr || c.title,
      'Kategori': controlCategoryLabels[c.category] || c.category,
      'Uygulanabilir': c.applicability !== false ? 'Evet' : 'Hayır',
      'Durum': controlStatusLabels[c.status || 'NOT_IMPLEMENTED'] || c.status || '-',
      'Gerekçe': c.justification || '-',
      'Uygulama Notları': c.implementationNotes || '-',
      'Kanıt Sayısı': c.evidences.length,
    }))

    // Özet sheet
    const categories = ['ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL']
    const soaSummary = categories.map(cat => {
      const catControls = controls.filter(c => c.category === cat)
      const applicable = catControls.filter(c => c.applicability !== false)
      return {
        'Kategori': controlCategoryLabels[cat] || cat,
        'Toplam': catControls.length,
        'Uygulanabilir': applicable.length,
        'Uygulanmış': applicable.filter(c => c.status === 'IMPLEMENTED' || c.status === 'EFFECTIVE').length,
        'Kısmen': applicable.filter(c => c.status === 'PARTIALLY').length,
        'Uygulanmamış': applicable.filter(c => c.status === 'NOT_IMPLEMENTED' || !c.status).length,
      }
    })

    const soaWb = XLSX.utils.book_new()
    const soaSheet = XLSX.utils.json_to_sheet(soaData)
    soaSheet['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(soaWb, soaSheet, 'Kontroller')
    const soaSummarySheet = XLSX.utils.json_to_sheet(soaSummary)
    soaSummarySheet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(soaWb, soaSummarySheet, 'Özet')
    const soaBuf = XLSX.write(soaWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(soaBuf, { name: `${rootDir}/02-Uygulanabilirlik-Beyani-SoA/SoA-Uygulanabilirlik-Beyani.xlsx` })

    // ==========================================
    // 03-Risk-Degerlendirme (Excel)
    // ==========================================
    const riskData = risks.map(r => ({
      'Risk No': r.riskNumber,
      'Başlık': r.title,
      'Varlık': r.assetName,
      'Varlık Değeri': r.assetValue,
      'Tehdit': r.threatName,
      'Senaryo': r.scenario,
      'Olasılık': r.likelihood,
      'Etki': r.impact,
      'Skor': r.riskScore,
      'Seviye': riskLevelLabels[r.riskLevel] || r.riskLevel,
      'İşleme': riskTreatmentLabels[r.treatmentOption || ''] || '-',
      'Durum': riskStatusLabels[r.status] || r.status,
      'Sahip': r.ownerName,
    }))
    const riskWb = XLSX.utils.book_new()
    const riskSheet = XLSX.utils.json_to_sheet(riskData)
    riskSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(riskWb, riskSheet, 'Risk Değerlendirme')
    const riskBuf = XLSX.write(riskWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(riskBuf, { name: `${rootDir}/03-Risk-Degerlendirme/Risk-Degerlendirme-Tablosu.xlsx` })

    // ==========================================
    // 04-Ic-Denetim (3 Excel)
    // ==========================================
    // 4a: Denetim Programı
    if (auditPrograms.length > 0) {
      const progWb = XLSX.utils.book_new()
      for (const prog of auditPrograms) {
        const items = prog.planItems.map(item => ({
          'Madde No': item.itemNumber,
          'Denetim Alanı': item.auditArea,
          'Kapsam': item.scope || '-',
          'Planlanan Tarih': item.plannedDate || '-',
          'Baş Denetçi': item.leadAuditorName,
          'Süre': item.duration || '-',
          'Durum': item.status,
        }))
        const sheet = XLSX.utils.json_to_sheet(items)
        sheet['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 14 }]
        XLSX.utils.book_append_sheet(progWb, sheet, `${prog.year}`)
      }
      const progBuf = XLSX.write(progWb, { bookType: 'xlsx', type: 'buffer' })
      archive.append(progBuf, { name: `${rootDir}/04-Ic-Denetim/Denetim-Programi.xlsx` })
    }

    // 4b: Denetim Raporları
    if (audits.length > 0) {
      const auditData = audits.map(a => ({
        'Denetim No': a.auditNumber,
        'Başlık': a.title,
        'Kapsam': a.scope || '-',
        'Tip': auditTypeLabels[a.auditType] || a.auditType,
        'Planlanan Tarih': fmtDate(a.plannedDate),
        'Bitiş Tarihi': fmtDate(a.endDate),
        'Durum': auditStatusLabels[a.status] || a.status,
        'Baş Denetçi': a.leadAuditorName || '-',
        'Bulgu Sayısı': a.findings.length,
      }))
      const auditWb = XLSX.utils.book_new()
      const auditSheet = XLSX.utils.json_to_sheet(auditData)
      auditSheet['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(auditWb, auditSheet, 'Denetim Raporları')
      const auditBuf = XLSX.write(auditWb, { bookType: 'xlsx', type: 'buffer' })
      archive.append(auditBuf, { name: `${rootDir}/04-Ic-Denetim/Denetim-Raporlari.xlsx` })
    }

    // 4c: Bulgu Takip
    const allFindings = audits.flatMap(a =>
      a.findings.map(f => ({
        'Bulgu No': f.findingNumber || '-',
        'Denetim No': a.auditNumber,
        'Tip': findingTypeLabels[f.findingType] || f.findingType,
        'Başlık': f.title,
        'Açıklama': f.description || '-',
        'Şiddet': f.severity || '-',
        'Düzeltici Faaliyet': f.correctiveAction || '-',
        'Sorumlu': f.responsibleName || '-',
        'Vade Tarihi': fmtDate(f.dueDate),
        'Durum': findingStatusLabels[f.status] || f.status,
      }))
    )
    if (allFindings.length > 0) {
      const findWb = XLSX.utils.book_new()
      const findSheet = XLSX.utils.json_to_sheet(allFindings)
      findSheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 25 }, { wch: 35 }, { wch: 10 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(findWb, findSheet, 'Bulgu Takip')
      const findBuf = XLSX.write(findWb, { bookType: 'xlsx', type: 'buffer' })
      archive.append(findBuf, { name: `${rootDir}/04-Ic-Denetim/Bulgu-Takip.xlsx` })
    }

    // ==========================================
    // 05-Olay-Yonetimi (Excel)
    // ==========================================
    const incData = incidents.map(i => ({
      'Olay No': i.incidentNumber,
      'Tarih': fmtDate(i.detectedAt),
      'Başlık': i.title,
      'Kategori': incidentCategoryLabels[i.category] || i.category,
      'Şiddet': incidentSeverityLabels[i.severity] || i.severity,
      'Durum': incidentStatusLabels[i.status] || i.status,
      'Tespit Yöntemi': (i as any).detectionMethod || '-',
      'Raporlayan': i.reportedBy?.name || (i as any).reportedByName || '-',
      'Düzeltici Faaliyet': (i as any).correctiveAction || '-',
      'İlişkili Riskler': ((i as any).relatedRiskIds || []).join(', ') || '-',
      'Çözüm Tarihi': fmtDate(i.resolvedAt),
    }))
    const incWb = XLSX.utils.book_new()
    const incSheet = XLSX.utils.json_to_sheet(incData)
    incSheet['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(incWb, incSheet, 'Olay Kayıtları')
    const incBuf = XLSX.write(incWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(incBuf, { name: `${rootDir}/05-Olay-Yonetimi/Olay-Kayitlari.xlsx` })

    // ==========================================
    // 06-Egitim-Kayitlari (Excel - 3 sheet)
    // ==========================================
    const trnWb = XLSX.utils.book_new()

    // Sheet 1: Eğitimler
    const trnData = trainings.map(t => ({
      'Eğitim No': t.trainingNumber,
      'Başlık': t.title,
      'Tip': trainingTypeLabels[t.trainingType] || t.trainingType,
      'Tarih': fmtDate(t.trainingDate),
      'Eğitmen': t.trainerName || '-',
      'Süre (dk)': t.duration || '-',
      'Katılımcı': t.participants.length,
      'Online': t.isOnline ? 'Evet' : 'Hayır',
      'Durum': trainingStatusLabels[t.status] || t.status,
    }))
    const trnSheet = XLSX.utils.json_to_sheet(trnData)
    trnSheet['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(trnWb, trnSheet, 'Eğitimler')

    // Sheet 2: Yüzyüze Katılım
    const faceToFace = trainings.flatMap(t =>
      t.participants.map(p => ({
        'Eğitim': t.title,
        'Eğitim No': t.trainingNumber,
        'Katılımcı': p.name,
        'Unvan': p.title || '-',
        'Bölüm': p.department || '-',
        'Katıldı': p.attended ? 'Evet' : 'Hayır',
        'İmza Tarihi': fmtDate(p.signedAt),
      }))
    )
    if (faceToFace.length > 0) {
      const ffSheet = XLSX.utils.json_to_sheet(faceToFace)
      ffSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(trnWb, ffSheet, 'Yüzyüze Katılım')
    }

    // Sheet 3: Dijital İmzalar
    const digitalSigs = trainingAssignments
      .filter(a => a.signedAt)
      .map(a => ({
        'Eğitim': a.training.title,
        'Eğitim No': a.training.trainingNumber,
        'Kullanıcı': a.user.name || a.user.email,
        'Bölüm': a.user.department || '-',
        'Tamamlama': fmtDate(a.completedAt),
        'İmza Tarihi': fmtDate(a.signedAt),
      }))
    if (digitalSigs.length > 0) {
      const dsSheet = XLSX.utils.json_to_sheet(digitalSigs)
      dsSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(trnWb, dsSheet, 'Dijital İmzalar')
    }

    const trnBuf = XLSX.write(trnWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(trnBuf, { name: `${rootDir}/06-Egitim-Kayitlari/Egitim-Kayitlari.xlsx` })

    // ==========================================
    // 07-Yonetim-Gozden-Gecirme (Excel)
    // ==========================================
    const mgrData = managementReviews.map(m => ({
      'Toplantı No': m.reviewNumber,
      'Başlık': m.title,
      'Tarih': fmtDate(m.reviewDate),
      'Başkan': m.chairperson,
      'Durum': reviewStatusLabels[m.status] || m.status,
      'Kararlar': m.decisions || '-',
    }))
    const mgrWb = XLSX.utils.book_new()
    const mgrSheet = XLSX.utils.json_to_sheet(mgrData)
    mgrSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(mgrWb, mgrSheet, 'YGG Toplantıları')
    const mgrBuf = XLSX.write(mgrWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(mgrBuf, { name: `${rootDir}/07-Yonetim-Gozden-Gecirme/YGG-Toplanti-Kayitlari.xlsx` })

    // ==========================================
    // 08-Varlik-Envanteri (Excel)
    // ==========================================
    const astData = assets.map(a => ({
      'Varlık No': a.assetNumber,
      'Ad': a.name,
      'Kategori': assetCategoryLabels[a.category] || a.category,
      'Konum': a.location || '-',
      'Bölüm': a.department || '-',
      'Gizlilik': a.confidentiality,
      'Bütünlük': a.integrity,
      'Erişilebilirlik': a.availability,
      'Değer': a.assetValue || '-',
      'Sınıflandırma': classificationLabels[a.classification] || a.classification,
      'Durum': assetStatusLabels[a.status] || a.status,
    }))
    const astWb = XLSX.utils.book_new()
    const astSheet = XLSX.utils.json_to_sheet(astData)
    astSheet['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(astWb, astSheet, 'Varlık Envanteri')
    const astBuf = XLSX.write(astWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(astBuf, { name: `${rootDir}/08-Varlik-Envanteri/Varlik-Envanteri.xlsx` })

    // ==========================================
    // 09-Tedarikci-Degerlendirme
    // ==========================================
    const supData = suppliers.map((s: any) => ({
      'Firma Adı': s.companyName,
      'Hizmet Türü': supplierServiceTypeLabels[s.serviceType] || s.serviceType,
      'Grup': supplierGroupLabels[s.group] || s.group,
      'Durum': supplierStatusLabels[s.status] || s.status,
      'Son Puan': s.lastScore ?? '-',
      'Son Değerlendirme': fmtDate(s.lastEvalDate),
      'NDA': s.hasNDA ? 'Evet' : 'Hayır',
      'Veri Erişimi': s.hasDataAccess ? 'Evet' : 'Hayır',
      'BG Risk': s.bgRiskLevel ? (supplierBGRiskLabels[s.bgRiskLevel] || s.bgRiskLevel) : '-',
      'İlgili Kişi': s.contactPerson || '-',
      'E-posta': s.email || '-',
      'Telefon': s.phone || '-',
    }))
    const supWb = XLSX.utils.book_new()
    const supSheet = XLSX.utils.json_to_sheet(supData)
    supSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(supWb, supSheet, 'Tedarikçi Listesi')

    // Değerlendirme detay sheet
    const evalData: any[] = []
    suppliers.forEach((s: any) => {
      if (s.evaluations && s.evaluations.length > 0) {
        const ev = s.evaluations[0]
        const row: any = {
          'Firma Adı': s.companyName,
          'Değerlendirme No': ev.evaluationNo,
          'Tarih': fmtDate(ev.evaluationDate),
          'Dönem': ev.period || '-',
        }
        if (ev.criteria) {
          ev.criteria.forEach((cs: any) => {
            row[cs.criteria.code + ': ' + cs.criteria.name] = cs.score
          })
        }
        row['Toplam Puan'] = ev.totalScore
        row['Grup'] = supplierGroupLabels[ev.resultGroup] || ev.resultGroup
        row['Değerlendiren'] = ev.evaluatorName
        evalData.push(row)
      }
    })
    if (evalData.length > 0) {
      const evalSheet = XLSX.utils.json_to_sheet(evalData)
      XLSX.utils.book_append_sheet(supWb, evalSheet, 'Değerlendirmeler')
    }

    const supBuf = XLSX.write(supWb, { bookType: 'xlsx', type: 'buffer' })
    archive.append(supBuf, { name: `${rootDir}/09-Tedarikci-Degerlendirme/Tedarikci-Degerlendirme.xlsx` })

    // ==========================================
    // 10-Kanitlar (fiziksel dosyalar)
    // ==========================================
    const addedEvidenceFiles: string[] = []
    for (const ev of evidences) {
      if (ev.fileUrl) {
        const physPath = resolveFileUrl(ev.fileUrl)
        if (physPath && fs.existsSync(physPath)) {
          const ext = path.extname(ev.fileName || physPath)
          const prefix = ev.control ? `${ev.control.controlId}_` : ''
          const fileName = safeName(prefix + (ev.title || ev.fileName || 'kanit')) + ext
          archive.file(physPath, { name: `${rootDir}/10-Kanitlar/${fileName}` })
          addedEvidenceFiles.push(fileName)
        }
      }
    }

    // ==========================================
    // 00-ICINDEKILER.txt
    // ==========================================
    const tocLines: string[] = [
      'İLERİ GROUP - ISO 27001 DENETÇİ PAKETİ',
      '=========================================',
      `Oluşturma Tarihi: ${fmtDate(new Date())}`,
      `Oluşturan: ${userName}`,
      `Standart: ISO/IEC 27001:2022`,
      '',
      'DOSYA LİSTESİ:',
      '================',
      '',
      '01-Politika-ve-Prosedurler/',
    ]
    if (addedPolicyFiles.length > 0) {
      addedPolicyFiles.forEach(f => tocLines.push(`  - ${f}`))
    } else {
      tocLines.push('  (Dosya yok)')
    }
    tocLines.push('')
    tocLines.push('02-Uygulanabilirlik-Beyani-SoA/')
    tocLines.push(`  - SoA-Uygulanabilirlik-Beyani.xlsx (${controls.length} kontrol)`)
    tocLines.push('')
    tocLines.push('03-Risk-Degerlendirme/')
    tocLines.push(`  - Risk-Degerlendirme-Tablosu.xlsx (${risks.length} risk)`)
    tocLines.push('')
    tocLines.push('04-Ic-Denetim/')
    if (auditPrograms.length > 0) tocLines.push(`  - Denetim-Programi.xlsx (${auditPrograms.length} program)`)
    if (audits.length > 0) tocLines.push(`  - Denetim-Raporlari.xlsx (${audits.length} denetim)`)
    if (allFindings.length > 0) tocLines.push(`  - Bulgu-Takip.xlsx (${allFindings.length} bulgu)`)
    if (auditPrograms.length === 0 && audits.length === 0) tocLines.push('  (Dosya yok)')
    tocLines.push('')
    tocLines.push('05-Olay-Yonetimi/')
    tocLines.push(`  - Olay-Kayitlari.xlsx (${incidents.length} olay)`)
    tocLines.push('')
    tocLines.push('06-Egitim-Kayitlari/')
    tocLines.push(`  - Egitim-Kayitlari.xlsx (${trainings.length} eğitim, ${faceToFace.length} yüzyüze, ${digitalSigs.length} dijital imza)`)
    tocLines.push('')
    tocLines.push('07-Yonetim-Gozden-Gecirme/')
    tocLines.push(`  - YGG-Toplanti-Kayitlari.xlsx (${managementReviews.length} toplantı)`)
    tocLines.push('')
    tocLines.push('08-Varlik-Envanteri/')
    tocLines.push(`  - Varlik-Envanteri.xlsx (${assets.length} varlık)`)
    tocLines.push('')
    tocLines.push('09-Tedarikci-Degerlendirme/')
    tocLines.push(`  - Tedarikci-Degerlendirme.xlsx (${suppliers.length} tedarikçi)`)
    tocLines.push('')
    tocLines.push('10-Kanitlar/')
    if (addedEvidenceFiles.length > 0) {
      addedEvidenceFiles.forEach(f => tocLines.push(`  - ${f}`))
    } else {
      tocLines.push('  (Dosya yok)')
    }

    archive.append(tocLines.join('\n'), { name: `${rootDir}/00-ICINDEKILER.txt` })

    // ZIP'i sonlandır
    archive.finalize()

    const zipBuffer = await archiveFinished

    const fileName = `ILERI-GROUP-ISO27001-Denetci-Paketi-${today}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Denetçi paketi ZIP oluşturulurken hata:', error)
    return NextResponse.json(
      { error: 'Denetçi paketi oluşturulamadı' },
      { status: 500 }
    )
  }
}
