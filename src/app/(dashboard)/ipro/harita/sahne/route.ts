import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'

// Fabrika Haritası izometrik sahnesini (sahne.html) auth arkasından servis eder.
// public/ altına konulmaz — orada olsa auth bypass olurdu. Bunun yerine kaynak
// ağacındaki .html dosyası burada okunup, IPRO görüntüleme yetkisi doğrulandıktan
// sonra text/html olarak döndürülür. iframe src'i buna bağlanır; ?tv=1 gibi query
// parametreleri sahnenin kendi location.search'ine bu sayede ulaşır (srcDoc ile
// ulaşamazdı).
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const { error } = await requireUser()
  if (error) {
    return NextResponse.redirect(new URL('/login', _req.url))
  }

  const canView = await hasPermission(['ipro.view', 'ipro.admin'])
  if (!canView) {
    return NextResponse.redirect(new URL('/dashboard', _req.url))
  }

  const filePath = path.join(
    process.cwd(),
    'src/app/(dashboard)/ipro/harita/sahne.html',
  )
  const html = fs.readFileSync(filePath, 'utf8')

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
