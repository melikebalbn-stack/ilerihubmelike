/**
 * Microsoft Graph — posta kutusu erişimi (app-only).
 *
 * KAPSAM: okuma + TEK yazma işlemi (klasöre taşıma). Mail SİLME, GÖNDERME,
 * okundu işaretleme bu dosyada YOK ve eklenmemeli.
 *
 * Erişim, Azure'daki Application Access Policy ile YALNIZ destek@ilerigroup.com
 * kutusuna kısıtlı. Başka bir kutu denenirse Graph 403 döner:
 *   "[RAOP] : Blocked by tenant configured AppOnly AccessPolicy settings"
 * (27 Ağu'da sunucudan ölçüldü.)
 */

import { graphToken, graphKok } from './token'

export class GraphMailHatasi extends Error {
  constructor(
    message: string,
    readonly httpDurum: number,
    readonly hamGovde: string | null,
  ) {
    super(message)
    this.name = 'GraphMailHatasi'
  }
}

/** Graph'ın internetMessageHeaders girdisi. */
export interface GraphBaslik {
  name: string
  value: string
}

export interface GraphAdres {
  emailAddress?: { name?: string | null; address?: string | null } | null
}

/** listeleGelenKutusu'nun $select'i ile birebir. */
export interface GraphMesaj {
  id: string
  internetMessageId: string | null
  conversationId: string | null
  subject: string | null
  receivedDateTime: string | null
  from: GraphAdres | null
  toRecipients: GraphAdres[] | null
  bodyPreview: string | null
  body: { contentType?: string | null; content?: string | null } | null
  internetMessageHeaders: GraphBaslik[] | null
  hasAttachments: boolean | null
}

export interface GraphKlasor {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
  childFolderCount: number
}

const MESAJ_SELECT = [
  'id',
  'internetMessageId',
  'conversationId',
  'subject',
  'receivedDateTime',
  'from',
  'toRecipients',
  'bodyPreview',
  'body',
  'internetMessageHeaders',
  'hasAttachments',
].join(',')

async function graphIstek(
  yol: string,
  secenek: { method?: string; govde?: unknown } = {},
): Promise<unknown> {
  const token = await graphToken()
  const yanit = await fetch(`${graphKok()}${yol}`, {
    method: secenek.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(secenek.govde !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(secenek.govde !== undefined ? { body: JSON.stringify(secenek.govde) } : {}),
  })

  const ham = await yanit.text()
  if (!yanit.ok) {
    // Ham gövde KORUNUR: 403'ün "[RAOP] politika" mı yoksa "izin yok" mu olduğu
    // ancak mesajdan anlaşılıyor. Jenerik hataya çevirmek teşhisi öldürür.
    throw new GraphMailHatasi(
      `Graph ${secenek.method ?? 'GET'} ${yol} başarısız (HTTP ${yanit.status})`,
      yanit.status,
      ham.slice(0, 1000),
    )
  }
  return ham ? JSON.parse(ham) : null
}

/** UPN'i yol parçası olarak güvenli hâle getirir. */
function kutuYolu(kutu: string): string {
  return encodeURIComponent(kutu)
}

/**
 * Gelen kutusundaki mesajlar — ESKİDEN YENİYE.
 *
 * Sıra bilinçli: en eski mail önce işlenir, böylece bir konuşmanın ilk maili
 * ticket'ı açar, sonrakiler ona yorum olarak düşer. Yeniden eskiye işlenseydi
 * yanıt önce gelir ve eşleşecek ticket bulunamazdı.
 */
export async function listeleGelenKutusu(kutu: string, limit = 25): Promise<GraphMesaj[]> {
  const top = Math.max(1, Math.min(100, Math.trunc(limit)))
  const yanit = (await graphIstek(
    `/users/${kutuYolu(kutu)}/mailFolders/inbox/messages` +
      `?$select=${MESAJ_SELECT}&$top=${top}&$orderby=receivedDateTime%20asc`,
  )) as { value?: GraphMesaj[] } | null
  return yanit?.value ?? []
}

/** Inbox'ın altındaki alt klasörler. */
export async function listeleAltKlasorler(kutu: string): Promise<GraphKlasor[]> {
  const yanit = (await graphIstek(
    `/users/${kutuYolu(kutu)}/mailFolders/inbox/childFolders?$top=100`,
  )) as { value?: GraphKlasor[] } | null
  return yanit?.value ?? []
}

/**
 * Inbox altında verilen adlı alt klasörü bulur; YOKSA oluşturur.
 *
 * İdempotent: önce arar, bulursa oluşturmaz. Bu dosyadaki TEK klasör yazma
 * işlemi. Karşılaştırma büyük/küçük harf duyarsız — Exchange klasör adlarında
 * ayrım yapmıyor, iki "İşlenmiş" doğmasın.
 */
export async function klasorBulVeyaOlustur(kutu: string, ad: string): Promise<GraphKlasor> {
  const hedef = ad.trim()
  const mevcut = await listeleAltKlasorler(kutu)
  const bulunan = mevcut.find((k) => k.displayName.toLocaleLowerCase('tr') === hedef.toLocaleLowerCase('tr'))
  if (bulunan) return bulunan

  return (await graphIstek(`/users/${kutuYolu(kutu)}/mailFolders/inbox/childFolders`, {
    method: 'POST',
    govde: { displayName: hedef },
  })) as GraphKlasor
}

/**
 * Mesajı hedef klasöre taşır.
 *
 * Graph /move mesajın YENİ bir kopyasını üretir ve YENİ id döner — eski id
 * geçersizleşir. Tekilleştirme bu yüzden Graph id'sine DEĞİL,
 * internetMessageId'ye dayanıyor (o taşımada korunur).
 */
export async function tasi(kutu: string, mesajId: string, hedefKlasorId: string): Promise<{ id: string }> {
  return (await graphIstek(`/users/${kutuYolu(kutu)}/messages/${encodeURIComponent(mesajId)}/move`, {
    method: 'POST',
    govde: { destinationId: hedefKlasorId },
  })) as { id: string }
}
