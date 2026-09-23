/**
 * Tuval "görsel" öğesi için logo/görsel yükleme.
 * Mevcut desen: akademi sertifika logosu ucu (api/akademi/admin/certificate-templates/upload-logo) —
 * public/uploads altına rastgele adla yazar, yolu döner. Rapor logoları kurumsal görsellerdir,
 * kişisel veri içermez (KVKK kuralı public/uploads yasağı kişisel veri çıktıları içindir).
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

const KLASOR = path.join(process.cwd(), 'public', 'uploads', 'rapor', 'logolar')
const TURLER: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
const MAX_BOYUT = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Geçersiz form verisi' }, { status: 400 }) }

  const dosya = form.get('file')
  if (!(dosya instanceof File)) return NextResponse.json({ error: 'Dosya yok' }, { status: 400 })
  const uzanti = TURLER[dosya.type]
  if (!uzanti) return NextResponse.json({ error: 'Yalnız PNG, JPG, WEBP veya SVG yüklenebilir' }, { status: 400 })
  if (dosya.size > MAX_BOYUT) return NextResponse.json({ error: "Dosya 2 MB'dan büyük olamaz" }, { status: 400 })

  await fs.mkdir(KLASOR, { recursive: true })
  const ad = `${crypto.randomBytes(9).toString('base64url')}.${uzanti}`
  await fs.writeFile(path.join(KLASOR, ad), Buffer.from(await dosya.arrayBuffer()))

  return NextResponse.json({ url: `/uploads/rapor/logolar/${ad}`, dosyaId: ad, ad: dosya.name, boyut: dosya.size })
}
