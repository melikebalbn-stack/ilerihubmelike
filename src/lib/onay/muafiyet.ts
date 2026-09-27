import { prisma } from '@/lib/prisma'

/**
 * SELF-ENTRY ONAY MUAFİYETİ (2026-08 · Melih kararı)
 *
 * Kişi KENDİ adına kayıt girdiğinde normalde 1./2./3. Sorumlu onayına tabidir
 * (bkz. approvers.ts). Müdürler için bu üst amir onayı KALDIRILDI: kayıt doğrudan
 * ONAYLANDI doğar, onaycı atanmaz ve İV katmanına (ivOnaylandi=false) düşer.
 * İV onay katmanı DEĞİŞMEZ — muaf kayıt da İV kararını bekler.
 *
 * MUAFİYET İKİ KAYNAKTAN GELİR:
 *
 * 1) ORGANİZASYON ŞEMASI — DepartmentDefinition.mudurId.
 *    Departman müdürü olmanın TEK KAYNAĞI budur. Serbest metin `Personnel.gorev`
 *    kullanılmaz: unvanı "MÜDÜR" içermeyen müdürler var (ör. bir departmanın müdürü
 *    "KİLİT MÜŞTERİ YÖNETİCİSİ" unvanlı) ve "MÜDÜR YARDIMCISI" da metne takılır.
 *    `User.role='DEPT_HEAD'` de kullanılmaz: prod'da müdürlerin yalnız küçük bir
 *    kısmında bu rol var, veri tutarsız.
 *    Müdür YARDIMCILARI bu kaynağa GİRMEZ (mudurYardimcisiId ayrı alan) — yani
 *    yardımcılar varsayılan olarak onay akışında KALIR.
 *
 * 2) KİŞİYE ÖZEL MUAFİYET LİSTESİ — SystemSetting['kart_okutamama_muaf_siciller'].
 *    Şemada müdür olmayan ama muaf tutulması kararlaştırılan kişiler için
 *    (ör. İnsan Varlıkları Müdür Yardımcısı). Virgülle ayrılmış sicil numarası
 *    listesi. Koda İSİM/SİCİL GÖMÜLMEZ; liste mevcut `SystemSetting` tablosundan
 *    okunur — yeni tablo/migration YOK, değişiklik için deploy gerekmez.
 *    Kayıt yoksa liste boş kabul edilir (yalnız şemadaki müdürler muaf).
 */
export const MUAF_SICIL_AYAR_ANAHTARI = 'kart_okutamama_muaf_siciller'

/** Ayardaki virgüllü sicil listesi. Kayıt yoksa/boşsa boş küme. */
async function muafSicilKumesi(): Promise<Set<string>> {
  const ayar = await prisma.systemSetting.findUnique({
    where: { key: MUAF_SICIL_AYAR_ANAHTARI },
    select: { value: true },
  })
  if (!ayar?.value) return new Set()
  return new Set(
    ayar.value
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )
}

/**
 * Bu personelin KENDİ adına girdiği kayıt üst amir onayından muaf mı?
 * Hata durumunda `false` döner (fail-closed): muafiyet çözülemezse kayıt
 * mevcut davranışa göre onay akışına girer, sessizce onaylanmaz.
 */
export async function selfEntryOnaydanMuafMi(personnelId: string): Promise<boolean> {
  try {
    // (1) Şemada departman müdürü mü — tek sorgu, varlık kontrolü.
    const mudurlukSayisi = await prisma.departmentDefinition.count({
      where: { mudurId: personnelId },
    })
    if (mudurlukSayisi > 0) return true

    // (2) Kişiye özel muafiyet listesi (sicil no ile).
    const personel = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { sicilNo: true },
    })
    if (!personel?.sicilNo) return false
    const muaflar = await muafSicilKumesi()
    return muaflar.has(personel.sicilNo.trim().toUpperCase())
  } catch (err) {
    console.error('[kart-okutamama] muafiyet cozulemedi — onay akisi uygulanir:', err)
    return false
  }
}
