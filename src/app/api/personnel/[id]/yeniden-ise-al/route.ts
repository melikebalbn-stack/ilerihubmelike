// POST /api/personnel/[id]/yeniden-ise-al
//
// ESKİ ÇALIŞAN GERİ DÖNDÜ (05.10.2026, Melih kararı): yeni Personnel kaydı
// AÇILMAZ — eski kayıt yeniden aktifleştirilir. Böylece sicil korunur ve geçmiş
// bağlar (zimmet, eğitim, izin, değerlendirme, org geçmişi) kopmaz.
//
// Transaction:
//   1. Guard: kayıt PASİF olmalı, AÇIK dönemi bulunmamalı (varsa 409).
//   2. Personnel.update: aktif=true + yeni giriş tarihi + formdan gelen kadro
//      alanları (bölüm/görev/yaka…) + FK'lar (çift yazım deseni).
//   3. Yeni AÇIK EmploymentPeriod. ESKİ KAPALI DÖNEM VE ÇIKIŞ BİLGİSİ KORUNUR —
//      hiçbir kapalı döneme dokunulmaz (çıkış istatistikleri bozulmasın).
//   4. Org koltuğu: personelEklendiginde (ikincil — açılmazsa kayıt yine geçerli).
//   5. Denetim: PERSONNEL_YENIDEN_ISE_ALIM (eski/yeni kadro + dönem sayısı).
// Sonra: IFS senkron kuyruğu (ateşle-unut), hassas/beden alanları DEĞİŞTİRİLMEZ
// (eski kayıt zaten taşıyor; güncelleme personel kartından yapılır).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'
import { YAKA_DETAY_MAP } from '@/lib/personnel-constants'
import { personelFkAlanlariIdOncelikli } from '@/lib/personnel/fk-cozum'
import { personelEklendiginde, type YeniPersonelSonuc } from '@/lib/org/personel-koltuk-senkron'
import { ifsKuyrugaEkle, personelKuyrukKayitlari } from '@/lib/ifs/personel-sync/kuyruk'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

/** Yeniden işe alımda güncellenebilen kadro alanları (hassas/banka HARİÇ). */
const GUNCELLENEBILIR = [
  'adSoyad', 'cinsiyet', 'yakaRengi', 'yakaDetayi', 'sinif', 'direktEndirekt', 'asansorMekanik',
  'gorev', 'bolum', 'bolumDetay', 'birimSorumlusu', 'sorumlu2', 'sorumlu3', 'bolumMuduru',
  'masrafMerkezi', 'interKepMail', 'mailAdresi', 'ikametAdresi', 'telefon', 'kanGrubu',
  'serviceRoute', 'serviceStop', 'denemeDegerlendirme', 'altiAyDegerlendirme',
] as const

const TARIH_ALANLARI = ['denemeDegerlendirme', 'altiAyDegerlendirme'] as const

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!(ALLOWED_ROLES.includes(user.role) || isInsanVarliklari(user.department))) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const mevcut = await prisma.personnel.findUnique({
      where: { id },
      select: {
        id: true, sicilNo: true, adSoyad: true, aktif: true,
        bolum: true, gorev: true, yakaRengi: true, iseGirisTarihi: true,
      },
    })
    if (!mevcut) return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    if (mevcut.aktif) {
      return NextResponse.json(
        { error: 'Bu personel zaten aktif — yeniden işe alım yapılamaz' },
        { status: 409 },
      )
    }

    const acikDonem = await prisma.employmentPeriod.findFirst({
      where: { personnelId: id, cikisTarihi: null },
      select: { id: true, girisTarihi: true },
    })
    if (acikDonem) {
      return NextResponse.json(
        { error: 'Personelin kapanmamış bir çalışma dönemi var — önce çıkışını tamamlayın' },
        { status: 409 },
      )
    }

    // Zorunlu alanlar — personel oluşturma ile AYNI küme (sicil hariç; o korunuyor).
    const iseGirisTarihi = String(body.iseGirisTarihi ?? '').trim()
    const bolum = String(body.bolum ?? '').trim()
    const gorev = String(body.gorev ?? '').trim()
    const yakaRengi = String(body.yakaRengi ?? '').trim()
    const yakaDetayi = String(body.yakaDetayi ?? '').trim()
    if (!iseGirisTarihi || !bolum || !gorev) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik: İşe Giriş Tarihi, Bölüm, Görev' },
        { status: 400 },
      )
    }
    if (!yakaRengi || !yakaDetayi) {
      return NextResponse.json({ error: 'Yaka Rengi ve Yaka Detayı zorunludur' }, { status: 400 })
    }
    if (!(YAKA_DETAY_MAP[yakaRengi] ?? []).includes(yakaDetayi)) {
      return NextResponse.json({ error: 'Yaka Detayı, seçilen Yaka Rengi ile uyumsuz' }, { status: 400 })
    }
    const girisDate = new Date(iseGirisTarihi)
    if (Number.isNaN(girisDate.getTime())) {
      return NextResponse.json({ error: 'İşe giriş tarihi geçersiz' }, { status: 400 })
    }

    // Beyaz liste — gövdedeki tanınmayan anahtar sessizce atılır (PUT deseni).
    const veri: Record<string, unknown> = {}
    for (const alan of GUNCELLENEBILIR) {
      const deger = (body as Record<string, unknown>)[alan]
      if (deger === undefined || deger === null || deger === '') continue
      veri[alan] = (TARIH_ALANLARI as readonly string[]).includes(alan)
        ? new Date(String(deger))
        : deger
    }
    veri.aktif = true
    veri.iseGirisTarihi = girisDate
    veri.updatedAt = new Date()

    // FAZ 1 · ÇİFT YAZIM: metin alanlarının yanına FK'lar (bölüm + sorumlular).
    Object.assign(
      veri,
      await personelFkAlanlariIdOncelikli(
        prisma,
        {
          bolum: veri.bolum as string | undefined,
          birimSorumlusu: veri.birimSorumlusu as string | undefined,
          sorumlu2: veri.sorumlu2 as string | undefined,
          sorumlu3: veri.sorumlu3 as string | undefined,
        },
        {
          sorumlu1Id: (body as Record<string, unknown>).sorumlu1Id,
          sorumlu2Id: (body as Record<string, unknown>).sorumlu2Id,
          sorumlu3Id: (body as Record<string, unknown>).sorumlu3Id,
        },
      ),
    )

    let koltukSonuc: YeniPersonelSonuc = { koltukAcildi: false, sebep: 'calistirilmadi' }
    const sonuc = await prisma.$transaction(async (tx) => {
      const guncel = await tx.personnel.update({ where: { id }, data: veri })

      await tx.employmentPeriod.create({
        data: {
          personnelId: id,
          girisTarihi: girisDate,
          cikisTarihi: null, // açık dönem
          entryRecordedById: user.id,
          entryRecordedAt: new Date(),
        },
      })

      const donemSayisi = await tx.employmentPeriod.count({ where: { personnelId: id } })

      // Koltuk İKİNCİL: eşleşme yoksa açılmaz, yeniden işe alım YİNE geçerlidir.
      koltukSonuc = await personelEklendiginde(tx, id, { actorId: user.id })

      await tx.permissionAuditLog.create({
        data: {
          action: 'PERSONNEL_YENIDEN_ISE_ALIM',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: id,
          details: {
            actorEmail: user.email,
            sicilNo: mevcut.sicilNo,
            adSoyad: guncel.adSoyad,
            eski: {
              bolum: mevcut.bolum,
              gorev: mevcut.gorev,
              yakaRengi: mevcut.yakaRengi,
              iseGirisTarihi: mevcut.iseGirisTarihi?.toISOString().slice(0, 10) ?? null,
            },
            yeni: {
              bolum: guncel.bolum,
              gorev: guncel.gorev,
              yakaRengi: guncel.yakaRengi,
              iseGirisTarihi: iseGirisTarihi,
            },
            donemSayisi,
            koltuk: {
              acildi: koltukSonuc.koltukAcildi,
              sebep: koltukSonuc.sebep ?? null,
              kutu: koltukSonuc.orgUnitAdi ?? null,
            },
          },
        },
      })

      return guncel
    })

    // IFS senkron kuyruğu (faz 1) — ateşle-unut.
    await ifsKuyrugaEkle(prisma, personelKuyrukKayitlari(id), 'HOOK:personnel-rehire')

    return NextResponse.json({
      ok: true,
      personnel: sonuc,
      koltuk: koltukSonuc.koltukAcildi
        ? { acildi: true, birim: koltukSonuc.orgUnitAdi }
        : { acildi: false, sebep: koltukSonuc.sebep, uyari: 'Şemada boş kadro yok, elle yerleştirin' },
    })
  } catch (err) {
    console.error('Yeniden işe alım hatası:', err)
    return NextResponse.json({ error: 'Yeniden işe alım başarısız' }, { status: 500 })
  }
}
