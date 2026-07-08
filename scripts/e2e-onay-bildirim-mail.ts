/**
 * E2E: onay-bekliyor bildirim mailini GERÇEK SMTP ile ateşler (yeni şablon + sendEmail).
 * Konu "[TEST]" ön-ekli — gerçek alıcı test olduğunu anlar.
 *
 * Kullanım:
 *   npx tsx scripts/e2e-onay-bildirim-mail.ts <alici@email> [--vardiya]
 */
import * as dotenv from 'dotenv'
dotenv.config()

import { sendEmail } from '../src/lib/email'
import {
  approvalPendingSubject,
  buildApprovalPendingMailText,
  buildApprovalPendingMailHtml,
} from '../src/lib/email-templates/overtime-approval-pending'
import { ileriHubUrl } from '../src/lib/email-templates/akademi/_base'

const to = process.argv[2]
const isVardiya = process.argv.includes('--vardiya')

if (!to || !to.includes('@')) {
  console.error('Kullanım: npx tsx scripts/e2e-onay-bildirim-mail.ts <alici@email> [--vardiya]')
  process.exit(1)
}

async function main() {
  const input = {
    formNo: isVardiya ? 'VRD-2026-TEST' : 'OT-2026-TEST',
    olusturan: 'E2E Test (ILERIHub)',
    tarihStr: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
    personelSayisi: 3,
    link: ileriHubUrl('/forms/overtime/e2e-test'),
    isVardiya,
    role: 'Genel Müdür Yardımcısı',
  }
  const subject = `[TEST] ${approvalPendingSubject(input.formNo, isVardiya)}`
  console.log(`Gönderiliyor → ${to} | konu: ${subject}`)
  const res = await sendEmail(
    [{ email: to, name: to }],
    subject,
    buildApprovalPendingMailText(input),
    buildApprovalPendingMailHtml(input)
  )
  console.log('sendEmail sonucu:', JSON.stringify(res))
  if (!res.success) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
