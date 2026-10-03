import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { transferServisPersonelAtama } from '@/lib/servis-yonetimi/service'
import { AtamaDilimHatasi } from '@/lib/servis-yonetimi/kapasite-asim'
import { atamaDilimHataYaniti } from '@/lib/servis-yonetimi/atama-dilim-http'
import type { ServisPersonelAtamaTransferForm } from '@/lib/servis-yonetimi/validation'

// Transfer = eski atamayı kapatma (servis.passive) + yeni atama açma
// (servis.create) TEK işlemde. requirePermission(['a','b']) OR anlamına
// geldiği için (bkz. require-permission.ts) burada İKİSİ de AYRI AYRI
// zorunlu tutuluyor — sadece birine sahip kullanıcı transfer yapamaz.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pasifCheck = await requirePermission('servis.passive')
  if (pasifCheck.error) return pasifCheck.error
  const createCheck = await requirePermission('servis.create')
  if (createCheck.error) return createCheck.error

  try {
    const { id } = await params
    const body = (await request.json()) as ServisPersonelAtamaTransferForm
    const data = await transferServisPersonelAtama(id, body, createCheck.userId)
    return NextResponse.json({ ok: true, message: 'Personel yeni servise transfer edildi.', data })
  } catch (err) {
    // Kapasite aşımı onayı gerekli → 409 (istemci uyarıyı gösterip asimOnayi:true ile yeniden gönderir)
    if (err instanceof AtamaDilimHatasi) return atamaDilimHataYaniti(err, 'Transfer gerçekleştirilemedi.')
    const message = err instanceof Error ? err.message : 'Transfer gerçekleştirilemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
