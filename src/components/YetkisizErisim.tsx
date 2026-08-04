"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, Loader2, Send, CheckCircle2, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PERMISSION_DESCRIPTIONS } from '@/lib/auth/permissions'

interface YetkisizErisimProps {
  /** Guard'da kontrol edilen permission key — verilirse "Gerekli yetki" satırı gösterilir. */
  permission?: string
  /** Ana açıklama metni (varsayılan: genel yetkisiz mesajı). */
  mesaj?: string
  /** Kart başlığı. */
  baslik?: string
}

// Ticket "açık" (kapanmamış) statüleri — mükerrer talep kontrolü için.
// Kaynak: /api/tickets GET OPEN_STATUSES ile birebir.
const ACIK_STATULER = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED']

type TalepSonuc =
  | { tip: 'olusturuldu'; ticketNo: string }
  | { tip: 'zaten_acik'; ticketNo: string }
  | { tip: 'hata'; mesaj: string }

/**
 * Ortak 403 / yetkisiz erişim ekranı (client).
 *
 * Yetki reddinde `redirect('/dashboard')` yerine bu döndürülür: kullanıcı ekranda
 * kalır, hangi sayfa + hangi yetki eksik görür ve tek tıkla IT'ye yetki talebi
 * (Erisim Talepleri kategorisinde Hizmet Talebi ticket'ı) açabilir.
 *
 * "use client": usePathname (sayfa yolu) + ticket akışı (fetch/state) için. Bu
 * bileşeni render eden server sayfaları server kalır (client boundary yalnız burada).
 */
export function YetkisizErisim({
  permission,
  mesaj = 'Bu sayfaya erişim yetkiniz yok.',
  baslik = 'Erişim Reddedildi (403)',
}: YetkisizErisimProps) {
  const pathname = usePathname()
  const permAciklama = permission ? PERMISSION_DESCRIPTIONS[permission] ?? permission : null

  const [dialogAcik, setDialogAcik] = useState(false)
  const [not, setNot] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [sonuc, setSonuc] = useState<TalepSonuc | null>(null)

  const konu = `Yetki talebi: ${pathname}`

  async function yetkiTalepEt() {
    setGonderiliyor(true)
    setSonuc(null)
    try {
      // 1) Mükerrer koruma — aynı sayfa için AÇIK talebim var mı
      const dupRes = await fetch(
        `/api/tickets?viewMode=my&search=${encodeURIComponent(pathname)}&limit=50`,
      )
      if (dupRes.ok) {
        const liste = await dupRes.json()
        const mevcut = Array.isArray(liste)
          ? liste.find(
              (t: { subject?: string; status?: string; ticketNumber?: string }) =>
                t.subject === konu && ACIK_STATULER.includes(t.status ?? ''),
            )
          : null
        if (mevcut?.ticketNumber) {
          setSonuc({ tip: 'zaten_acik', ticketNo: mevcut.ticketNumber })
          return
        }
      }

      // 2) Kategori id'sini isimle bul (hardcode yok); bulunamazsa categoryId'siz gönder
      let categoryId: string | undefined
      try {
        const catRes = await fetch('/api/tickets/categories')
        if (catRes.ok) {
          const kategoriler = await catRes.json()
          const kat = Array.isArray(kategoriler)
            ? kategoriler.find((c: { name?: string }) => c.name === 'Erisim Talepleri')
            : null
          categoryId = kat?.id
        }
      } catch {
        // kategori alınamazsa fallback: categoryId'siz (ticket yine NEW açılır)
      }

      // 3) Ticket oluştur
      const aciklama = [
        `Sayfa: ${pathname}`,
        permission ? `Gerekli yetki: ${permAciklama} (${permission})` : null,
        not.trim() ? `Not: ${not.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketType: 'SERVICE_REQUEST',
          subject: konu,
          description: aciklama,
          ...(categoryId ? { categoryId } : {}),
        }),
      })
      if (!res.ok) {
        const hata = await res.json().catch(() => ({}))
        throw new Error(hata?.error ?? 'Talep oluşturulamadı')
      }
      const ticket = await res.json()
      setSonuc({ tip: 'olusturuldu', ticketNo: ticket.ticketNumber ?? '—' })
    } catch (e) {
      setSonuc({ tip: 'hata', mesaj: e instanceof Error ? e.message : 'Beklenmeyen hata' })
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1B4F72]/10">
            <ShieldAlert className="h-7 w-7 text-[#1B4F72]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-[#1B4F72]">{baslik}</h1>
            <p className="text-sm text-slate-600">{mesaj}</p>
            {permission ? (
              <div className="pt-1 text-sm">
                <p className="text-slate-600">
                  Gerekli yetki: <span className="font-medium text-slate-800">{permAciklama}</span>
                </p>
                <code className="mt-0.5 inline-block rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-500">
                  {permission}
                </code>
              </div>
            ) : null}
          </div>

          {/* Sayfa yolu — IT teşhis için */}
          <p className="font-mono text-[11px] text-slate-400">Sayfa: {pathname}</p>

          <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard&apos;a dön</Link>
            </Button>
            <Button
              onClick={() => {
                setSonuc(null)
                setDialogAcik(true)
              }}
              className="bg-[#1B4F72] hover:bg-[#163f5c]"
            >
              <Send className="mr-2 h-4 w-4" />
              Yetki Talep Et
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogAcik} onOpenChange={setDialogAcik}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yetki Talebi Oluştur</DialogTitle>
            <DialogDescription>
              IT ekibine bu sayfa için erişim talebi iletilir (Hizmet Talebi / Erişim Talepleri).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 p-3 text-left text-xs text-slate-600">
              <div>
                <span className="text-slate-400">Sayfa:</span>{' '}
                <span className="font-mono">{pathname}</span>
              </div>
              {permission ? (
                <div className="mt-1">
                  <span className="text-slate-400">Gerekli yetki:</span> {permAciklama}{' '}
                  <span className="font-mono text-slate-400">({permission})</span>
                </div>
              ) : null}
            </div>

            <Textarea
              placeholder="İsteğe bağlı not (neden erişime ihtiyacınız var?)"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              rows={3}
              disabled={gonderiliyor}
            />

            {sonuc?.tip === 'olusturuldu' && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-left text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Talebiniz oluşturuldu: <strong>{sonuc.ticketNo}</strong>. IT ekibi
                  bilgilendirildi.
                </span>
              </div>
            )}
            {sonuc?.tip === 'zaten_acik' && (
              <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-left text-sm text-blue-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Bu sayfa için talebiniz zaten açık: <strong>{sonuc.ticketNo}</strong>. Yeni
                  talep oluşturulmadı.
                </span>
              </div>
            )}
            {sonuc?.tip === 'hata' && (
              <div className="rounded-md bg-red-50 p-3 text-left text-sm text-red-800">
                {sonuc.mesaj}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAcik(false)} disabled={gonderiliyor}>
              Kapat
            </Button>
            {sonuc?.tip !== 'olusturuldu' && sonuc?.tip !== 'zaten_acik' && (
              <Button
                onClick={yetkiTalepEt}
                disabled={gonderiliyor}
                className="bg-[#1B4F72] hover:bg-[#163f5c]"
              >
                {gonderiliyor ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gönderiliyor…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Talebi Gönder
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default YetkisizErisim
