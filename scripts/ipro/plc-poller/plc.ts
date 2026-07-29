/**
 * PlcConnection — tek bir Siemens S7 panosuna KALICI bağlantı.
 * - connect/disconnect her okumada YAPILMAZ; bağlantı açık tutulur.
 * - Koparsa exponential backoff (1s→60s) ile yeniden bağlanır.
 * - Her op (connect/read) timeout'lu → hung bir PLC diğerlerini bloklamaz.
 * Bağlantı bilgileri DB'den (IproPlc) gelir, hardcode yok.
 */
import { S7Client } from 'node-snap7'
import { okumaHatasiKarari, parcaPlani, pduParcaBoyutu } from './hesap'

const BACKOFF_MIN = 1_000
const BACKOFF_MAX = 60_000
const OP_TIMEOUT = 4_000
/**
 * Ard arda kaç okuma hatasında oturum ZORLA koparılır. 1 DEĞİL: saha gözlemi oturumun
 * genelde canlı olduğunu, PLC'nin geçici yanıt vermediğini gösterdi; her hatada kopmak
 * slotu kıt PLC'de churn yaratır (bkz. hesap.ts okumaHatasiKarari).
 */
const ZORLA_KOPMA_ESIGI = 2

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

export interface PlcStatus {
  kod: string
  ip: string
  connected: boolean
  lastReadAt: string | null
  backoffMs: number
  lastError: string | null
  /** GERÇEK başarılı yeniden bağlanma sayısı (ilk bağlantı sayılmaz). */
  yenidenBaglanmaSayisi: number
  /** Anlık ard arda okuma hatası sayacı (başarılı okumada sıfırlanır). */
  ardArdaHataSayisi: number
  /** Eşiğe ulaşıp oturumun ZORLA koparıldığı kez sayısı. */
  zorlaKopmaSayisi: number
  /** Son okumanın kaç parçada yapıldığı (PDU parçalama). */
  parcaSayisi: number
  /** Eksik bayt dönen (kısmi) parça kaç kez yakalandı (kümülatif). */
  eksikBaytSayisi: number
}

export class PlcConnection {
  private client = new S7Client()
  private backoffMs = BACKOFF_MIN
  private nextAttemptAt = 0
  private ardArdaHata = 0
  private ilkBaglanti = true
  private yenidenBaglanmaSayisi = 0
  private zorlaKopmaSayisi = 0
  /** Müzakere edilen PDU'dan türetilen, DWORD-hizalı parça boyutu (bağlantıda hesaplanır). */
  private parcaBoyutu = 0
  /** Son okumanın kaç parçada yapıldığı (telemetri). */
  private sonParcaSayisi = 0
  /** Eksik bayt dönen (kısmi) parça kaç kez yakalandı (kümülatif telemetri). */
  private eksikBaytSayisi = 0
  /** Uçuşta olan native işlem sayısı. >0 iken istemci DEĞİŞTİRİLMEZ / KAPATILMAZ. */
  private ucusta = 0
  /** Native çağrısı hâlâ süren, kapatılmayı bekleyen eski istemciler.
      Referans burada tutulur — GC toplarsa native taraf serbest belleğe yazar. */
  private terkEdilmis: S7Client[] = []
  lastReadAt: number | null = null
  lastError: string | null = null

  constructor(
    public readonly kod: string,
    public readonly ip: string,
    public readonly rack: number,
    public readonly slot: number,
    private readonly log: (msg: string) => void,
  ) {}

  get connected(): boolean {
    try {
      return this.client.Connected()
    } catch {
      return false
    }
  }

  private errText(err: number): string {
    try {
      return this.client.ErrorText(err)
    } catch {
      return `err ${err}`
    }
  }

  /** Uçuşta iş varsa istemciyi kapatma — park et, iş bitince kapatılır. */
  private guvenliKapat(c: S7Client) {
    if (this.ucusta > 0) {
      this.terkEdilmis.push(c)
      if (this.terkEdilmis.length > 8) {
        this.log(`⚠️ ${this.kod} ${this.terkEdilmis.length} terk edilmiş istemci birikti — native çağrı dönmüyor olabilir`)
      }
      return
    }
    try { c.Disconnect() } catch { /* yoksay */ }
  }

  private terkEdilmisTemizle() {
    if (this.ucusta > 0 || this.terkEdilmis.length === 0) return
    for (const c of this.terkEdilmis) {
      try { c.Disconnect() } catch { /* yoksay */ }
    }
    this.terkEdilmis.length = 0
  }

  private connect(): Promise<void> {
    this.guvenliKapat(this.client)   // uçuşta iş varsa eskisi canlı kalır
    this.client = new S7Client()
    const c = this.client
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        this.ucusta++
        c.ConnectTo(this.ip, this.rack, this.slot, (err) => {
          this.ucusta--
          this.terkEdilmisTemizle()
          if (err) reject(new Error(this.errText(err)))
          else resolve()
        })
      }),
      OP_TIMEOUT,
      `${this.kod} connect`,
    )
  }

  /** Bağlı değilse ve backoff zamanı geldiyse yeniden bağlanmayı dener. */
  async ensureConnected(): Promise<boolean> {
    if (this.connected) return true
    const now = Date.now()
    if (now < this.nextAttemptAt) return false
    try {
      await this.connect()
      this.backoffMs = BACKOFF_MIN
      this.lastError = null
      this.ardArdaHata = 0
      // Parça boyutunu MÜZAKERE EDİLEN PDU'dan türet (sabit değil — CPU'ya göre değişebilir).
      // Bağlantı başına bir kez; okuma bu boyutta parçalanır → çok-PDU birleştirme olmaz.
      let pdu = 0
      try {
        pdu = this.client.PDULength()
      } catch {
        /* okunamadı → güvenli varsayılan */
      }
      this.parcaBoyutu = pduParcaBoyutu(pdu)
      if (this.ilkBaglanti) {
        this.ilkBaglanti = false
        this.log(`✅ ${this.kod} (${this.ip}) bağlandı · PDU=${pdu || '?'} → parça=${this.parcaBoyutu}B`)
      } else {
        this.yenidenBaglanmaSayisi++
        this.log(`✅ ${this.kod} (${this.ip}) YENİDEN bağlandı (#${this.yenidenBaglanmaSayisi}) · PDU=${pdu || '?'} → parça=${this.parcaBoyutu}B`)
      }
      return true
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
      this.nextAttemptAt = now + this.backoffMs
      this.log(`⛔ ${this.kod} (${this.ip}) bağlantı hatası: ${this.lastError} — ${this.backoffMs / 1000}s sonra tekrar`)
      this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX)
      return false
    }
  }

  /** Tek MBRead (bir parça). Hata bağlantı kopması olabilir. */
  private mbReadTek(off: number, len: number): Promise<Buffer> {
    // Aynı istemcide EŞZAMANLI native işlem yok: snap7 istemcisi thread-safe değil.
    // Parçalar zaten ardışık okunuyor; bu kapı yalnız timeout sonrası sarkan çağrıyı yakalar.
    if (this.ucusta > 0) {
      return Promise.reject(new Error(`${this.kod} önceki native işlem hâlâ uçuşta — okuma atlandı`))
    }
    const c = this.client
    return withTimeout(
      new Promise<Buffer>((resolve, reject) => {
        this.ucusta++
        c.MBRead(off, len, (err, data) => {
          this.ucusta--
          this.terkEdilmisTemizle()
          if (err) reject(new Error(this.errText(err)))
          else resolve(data)
        })
      }),
      OP_TIMEOUT,
      `${this.kod} MBRead(${off},${len})`,
    )
  }

  /**
   * Merker bloğu oku — PDU yüküne göre PARÇALI (çok-PDU birleştirme yolunu kaldırır).
   *
   * Neden: tek büyük MBRead PDU'yu aşınca node-snap7 çok-PDU yanıtı bir bayt kaymalı
   * birleştiriyordu (24.07 ×256 epizotları). Parça boyutu ≤ PDU yükü olunca her MBRead
   * tek PDU'da tamamlanır, birleştirme hiç olmaz. Parçalar ardışık okunup birleştirilir.
   * Küçük bloklar (size ≤ parça) TEK parça kalır → PANO-3 davranışı değişmez.
   *
   * Eksik bayt dönen parça → okuma HATASI (kısmi/yutulmuş yanıta karşı ikinci kapı;
   * mevcut fail-safe: baseline tazeleme + blok-geçersiz zaten devrede).
   */
  async readMerker(start: number, size: number): Promise<Buffer> {
    const chunk = this.parcaBoyutu > 0 ? this.parcaBoyutu : pduParcaBoyutu(0)
    const plan = parcaPlani(start, size, chunk)
    this.sonParcaSayisi = plan.length
    const buf = Buffer.allocUnsafe(size)
    for (const { off, len } of plan) {
      const data = await this.mbReadTek(off, len)
      if (data.length !== len) {
        this.eksikBaytSayisi++
        throw new Error(`${this.kod} eksik bayt: MBRead(${off},${len}) → ${data.length}`)
      }
      data.copy(buf, off - start)
    }
    return buf
  }

  markRead() {
    this.lastReadAt = Date.now()
    this.lastError = null
    this.ardArdaHata = 0 // başarılı okuma → ard arda hata zinciri kırıldı
  }

  /**
   * Okuma hatası. Connected()'a GÜVENİLMEZ — karar yalnız ard arda hata sayacına dayanır.
   * Eşiğe ulaşılmadıysa hiçbir şey yapılmaz (oturum muhtemelen canlı, PLC geçici yanıtsız).
   */
  onReadError(msg: string) {
    this.lastError = msg
    const { ardArdaHata, zorlaKop } = okumaHatasiKarari(this.ardArdaHata, ZORLA_KOPMA_ESIGI)
    this.ardArdaHata = ardArdaHata
    if (!zorlaKop) return

    // Eşiğe ulaşıldı: yarım açık oturumu KAPAT (PLC tarafındaki slot sızıntısını durdurur)
    // ve KOŞULSUZ backoff kur — ensureConnected bir sonraki turda gerçekten bağlanacak.
    this.guvenliKapat(this.client)
    this.client = new S7Client()   // taze istemci → connected=false, ensureConnected devralır
    this.zorlaKopmaSayisi++
    this.ardArdaHata = 0
    this.nextAttemptAt = Date.now() + this.backoffMs
    this.log(
      `✂️ ${this.kod} ${ZORLA_KOPMA_ESIGI} ard arda okuma hatası → oturum ZORLA koparıldı ` +
        `(#${this.zorlaKopmaSayisi}), ${this.backoffMs / 1000}s sonra yeniden bağlanılacak`,
    )
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX)
  }

  disconnect() {
    this.guvenliKapat(this.client)
  }

  status(): PlcStatus {
    return {
      kod: this.kod,
      ip: this.ip,
      connected: this.connected,
      lastReadAt: this.lastReadAt ? new Date(this.lastReadAt).toISOString() : null,
      backoffMs: this.backoffMs,
      lastError: this.lastError,
      yenidenBaglanmaSayisi: this.yenidenBaglanmaSayisi,
      ardArdaHataSayisi: this.ardArdaHata,
      zorlaKopmaSayisi: this.zorlaKopmaSayisi,
      parcaSayisi: this.sonParcaSayisi,
      eksikBaytSayisi: this.eksikBaytSayisi,
    }
  }
}
