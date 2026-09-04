import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";

// IFS eğitim ekranlarının KAPSAM KARARI — TEK KAYNAK.
//
// İki farklı kullanıcı tipi aynı uçları çağırıyor:
//   · akademi.kurs.edit  → yönetici. TÜM kişileri görür. Davranışı DEĞİŞMEZ.
//   · ifs.keyuser        → key user. YALNIZ kendi atandığı bölümlerdeki kişileri
//                          görür (IfsKeyUser.bolum = Personnel.bolum).
//
// Guard OR: ikisinden biri yeterli. İkisi birden varsa yönetici kazanır
// (geniş kapsam), çünkü daraltma yalnız key user'ın kendi işini görmesi için.
//
// `bolumler === null` → sınırsız (yönetici). Dizi → yalnız o bölümler.
// Boş dizi olamaz: key user'ın hiç ataması yoksa `yetkili:false` döner ve
// çağıran 403 verir — fail-closed.
// IFS ayrıştırması TAMAM: eski akademi.* anahtarları kaldırıldı, kapı yalnız
// ifs.* anahtarlarında. Geçiş 3 Eyl 2026'da ölçülerek yapıldı — eski anahtarı
// taşıyıp yeni karşılığı olmayan kimse kalmamıştı (altı eşlemede de eksik: 0).
export const IFS_EGITIM_OKUMA = ["ifs.admin", "ifs.keyuser"];

/** Yönetici sayılan anahtarlar — kapsam DARALTILMAZ, tüm kişiler görünür. */
const IFS_YONETICI = ["ifs.admin"];

export interface IfsKapsam {
  yetkili: boolean;
  /** null = tüm kişiler (yönetici); dizi = yalnız bu bölümler (key user). */
  bolumler: string[] | null;
  yonetici: boolean;
  keyUser: boolean;
}

export async function ifsEgitimKapsami(userId: string): Promise<IfsKapsam> {
  const perms = await getUserPermissions(userId);
  // DİKKAT: yönetici kararı guard listesiyle AYNI anahtar kümesinden gelmeli.
  // ifs.admin yalnız IFS_EGITIM_OKUMA'ya eklenip buraya eklenmeseydi, sadece
  // ifs.admin taşıyan kişi guard'ı geçer ama yonetici=false + keyUser=false
  // olduğu için yetkili=false dönüp 403 yerdi — sessiz bir kapı.
  const yonetici = IFS_YONETICI.some((k) => perms.has(k));
  const keyUser = perms.has("ifs.keyuser");

  if (yonetici) {
    return { yetkili: true, bolumler: null, yonetici: true, keyUser };
  }
  if (!keyUser) {
    return { yetkili: false, bolumler: [], yonetici: false, keyUser: false };
  }

  const atamalar = await prisma.ifsKeyUser.findMany({
    where: { userId },
    select: { bolum: true },
  });
  const bolumler = [...new Set(atamalar.map((a) => a.bolum))];
  // İzin var ama hiç bölüme atanmamış → kapsam yok, fail-closed.
  return {
    yetkili: bolumler.length > 0,
    bolumler,
    yonetici: false,
    keyUser: true,
  };
}

/** Kapsam dışı yanıtı — çağıranlar aynı metni kullansın. */
export function ifsKapsamYok() {
  return { error: "IFS eğitim verisini görüntüleme kapsamınız yok." };
}

/** Bir kişinin bölümü kapsamda mı? (null bölüm = kapsam dışı, fail-closed.) */
export function kapsamdaMi(kapsam: IfsKapsam, bolum: string | null): boolean {
  if (kapsam.bolumler === null) return true;
  return !!bolum && kapsam.bolumler.includes(bolum);
}
