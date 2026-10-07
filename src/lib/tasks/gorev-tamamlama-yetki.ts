/**
 * Planlı görev DURUM DEĞİŞTİRME yetkisi — TEK KAYNAK (07.10.2026).
 *
 * SORUN: kapı yalnız `responsiblePersonEmail` ile oturum e-postasını karşılaştırıyordu.
 * Liste kapsamı (`GET /api/tasks?viewMode=my`) ise görevleri e-posta ∪ `responsiblePersons`
 * dizisi ∪ SİCİL ∪ departman ile getiriyor. Sonuç: çoklu atamada (ya da e-postasız,
 * yalnız sicille atanmış) sorumlu görevini listede GÖRÜYOR ama "Tamamla" 403 dönüyordu —
 * istemci de mesajı göstermediği için sessiz ölü buton.
 *
 * İZİNLİ:
 *   · admin / super admin
 *   · atanan: responsiblePersonEmail ∨ responsiblePersons[].email ∨ responsiblePersons[].sicilNo
 *   · görevin bölümünün MÜDÜRÜ / MÜDÜR YARDIMCISI (DepartmentDefinition FK'sı)
 *   · LDAP amiri (atananlardan biri astıysa)
 * İZİNSİZ: bölümün sıradan çalışanı. Departmana atanmış görevi görmesi onu
 * tamamlama yetkisi YAPMAZ — kapı bilinçli olarak listeden DARDIR.
 *
 * Saf modül: DB/LDAP'a gitmez; çağıran uç veriyi hazır verir.
 */

import { normalizeDept } from '@/lib/auth/personnel-access'
import { sorumlulariCoz } from '@/lib/tasks/atama-bildirimi'

export const GOREV_DURUM_YETKI_HATASI =
  'Bu görevin durumunu değiştirme yetkiniz yok. Yalnız görev sorumlusu, bölüm müdürü/müdür yardımcısı, amiri ya da yönetici bu işlemi yapabilir.'

export type GorevYetkiSebebi =
  | 'ADMIN'
  | 'ATANAN_EPOSTA'
  | 'ATANAN_SICIL'
  | 'BOLUM_MUDURU'
  | 'BOLUM_MUDUR_YRD'
  | 'LDAP_AMIRI'
  | 'YOK'

export type GorevKullanici = {
  email: string | null
  /** User.employeeId (sicil no, ör. ILR-00375). */
  sicilNo: string | null
  /** User.personnelId — DepartmentDefinition.mudurId/mudurYardimcisiId ile karşılaştırılır. */
  personnelId: string | null
  rol: string | null
}

export type GorevKaydi = {
  responsiblePersonEmail: string | null
  /** JSON metin: [{name, email, sicilNo}] */
  responsiblePersons: string | null
  responsibleDepartment: string | null
}

export type GorevBolumu = {
  id: string
  name: string
  mudurId: string | null
  mudurYardimcisiId: string | null
}

export type GorevYetkiGirdisi = {
  kullanici: GorevKullanici
  gorev: GorevKaydi
  /** Aktif DepartmentDefinition satırları (ad eşleşmesi burada yapılır). */
  bolumler: GorevBolumu[]
  /** LDAP astlarının e-postaları (getAllSubordinates çıktısı). */
  astEpostalari: string[]
}

const ADMIN_ROLLERI = ['ADMIN', 'SUPER_ADMIN']

/** Göreve atanmış tüm e-postalar (tek alan + çoklu dizi), küçük harfe indirilmiş. */
export function gorevAtananEpostalari(gorev: GorevKaydi): string[] {
  const hepsi = [
    gorev.responsiblePersonEmail,
    ...sorumlulariCoz(gorev.responsiblePersons).map((s) => s.email),
  ]
  return [...new Set(hepsi.filter((e): e is string => !!e && !!e.trim()).map((e) => e.trim().toLowerCase()))]
}

/** Göreve atanmış siciller. */
export function gorevAtananSicilleri(gorev: GorevKaydi): string[] {
  return [
    ...new Set(
      sorumlulariCoz(gorev.responsiblePersons)
        .map((s) => s.sicilNo)
        .filter((s): s is string => !!s && !!s.trim())
        .map((s) => s.trim()),
    ),
  ]
}

/**
 * Görevin bölüm adını DepartmentDefinition satırına bağlar.
 *
 * NEDEN HEURİSTİK: `PlannedTask.responsibleDepartment` LDAP türevi `Department.name`
 * tutuyor; `DepartmentDefinition` ile arasında FK YOK ve adlar birebir tutmuyor
 * (07.10.2026 prod ölçümü: departmana atanmış 22 görevin 6 farklı bölüm adından
 * yalnız 1'i — "Yönetim" — birebir eşleşiyor; "İnsan Varlıkları" ↔ "İnsan Varlıkları
 * Müdürlüğü" gibi ekli adlar eşleşmiyordu).
 *
 * Sıra: (1) birebir ad, (2) normalize ad, (3) normalize ÖN EK — ve 3. adımda aday
 * BİRDEN FAZLAYSA eşleşme YOK sayılır (fail-closed). Örn. "Asansör" iki bölümün de
 * ön eki ("Asansör Müdürlüğü", "Asansör Satış Pazarlama") → yanlış müdüre yetki
 * vermektense hiç verilmez.
 */
export function gorevBolumunuEslestir(gorevBolumu: string | null, bolumler: GorevBolumu[]): GorevBolumu | null {
  const ad = (gorevBolumu ?? '').trim()
  if (!ad) return null

  const birebir = bolumler.find((b) => b.name === ad)
  if (birebir) return birebir

  const n = normalizeDept(ad)
  if (!n) return null

  const normal = bolumler.filter((b) => normalizeDept(b.name) === n)
  if (normal.length === 1) return normal[0]
  if (normal.length > 1) return null

  const onEk = bolumler.filter((b) => {
    const bn = normalizeDept(b.name)
    return bn.startsWith(`${n} `) || n.startsWith(`${bn} `)
  })
  return onEk.length === 1 ? onEk[0] : null
}

/**
 * Durum değiştirme kararı. Sebep teşhis/denetim için döner; `izinli` dışındaki
 * her şey bilgi amaçlıdır.
 */
export function gorevDurumDegistirebilir(girdi: GorevYetkiGirdisi): {
  izinli: boolean
  sebep: GorevYetkiSebebi
} {
  const { kullanici, gorev, bolumler, astEpostalari } = girdi

  if (ADMIN_ROLLERI.includes(kullanici.rol ?? '')) return { izinli: true, sebep: 'ADMIN' }

  const epostam = kullanici.email?.trim().toLowerCase() || null
  const atananEpostalar = gorevAtananEpostalari(gorev)
  if (epostam && atananEpostalar.includes(epostam)) return { izinli: true, sebep: 'ATANAN_EPOSTA' }

  const sicilim = kullanici.sicilNo?.trim() || null
  if (sicilim && gorevAtananSicilleri(gorev).includes(sicilim)) {
    return { izinli: true, sebep: 'ATANAN_SICIL' }
  }

  // Bölüm koltuğu: Personnel FK karşılaştırması (ad eşleşmesi DEĞİL).
  if (kullanici.personnelId) {
    const bolum = gorevBolumunuEslestir(gorev.responsibleDepartment, bolumler)
    if (bolum?.mudurId && bolum.mudurId === kullanici.personnelId) {
      return { izinli: true, sebep: 'BOLUM_MUDURU' }
    }
    if (bolum?.mudurYardimcisiId && bolum.mudurYardimcisiId === kullanici.personnelId) {
      return { izinli: true, sebep: 'BOLUM_MUDUR_YRD' }
    }
  }

  // LDAP amiri: atananlardan HERHANGİ BİRİ astımsa yeter (eskiden yalnız
  // responsiblePersonEmail'e bakılıyordu; çoklu atamada amir dışarıda kalıyordu).
  const astlar = new Set(astEpostalari.map((e) => e.trim().toLowerCase()).filter(Boolean))
  if (astlar.size > 0 && atananEpostalar.some((e) => astlar.has(e))) {
    return { izinli: true, sebep: 'LDAP_AMIRI' }
  }

  return { izinli: false, sebep: 'YOK' }
}
