/**
 * PlcConnection — tek bir Siemens S7 panosuna KALICI bağlantı.
 * - connect/disconnect her okumada YAPILMAZ; bağlantı açık tutulur.
 * - Koparsa exponential backoff (1s→60s) ile yeniden bağlanır.
 * - Her op (connect/read) timeout'lu → hung bir PLC diğerlerini bloklamaz.
 * Bağlantı bilgileri DB'den (IproPlc) gelir, hardcode yok.
 */
import { S7Client } from 'node-snap7'
import { okumaHatasiKarari } from './hesap'

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
}

export class PlcConnection {
  private client = new S7Client()
  private backoffMs = BACKOFF_MIN
  private nextAttemptAt = 0
  private ardArdaHata = 0
  private ilkBaglanti = true
  private yenidenBaglanmaSayisi = 0
  private zorlaKopmaSayisi = 0
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

  private connect(): Promise<void> {
    // TAZE İSTEMCİ: aynı S7Client üzerinde tekrar ConnectTo eski soketi bırakabilir
    // (native kaynak + PLC tarafında yarım açık oturum = slot sızıntısı). Eskisini
    // kapatıp yenisini yaratıyoruz.
    try {
      this.client.Disconnect()
    } catch {
      /* yoksay — zaten kopuk olabilir */
    }
    this.client = new S7Client()
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        this.client.ConnectTo(this.ip, this.rack, this.slot, (err) => {
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
      if (this.ilkBaglanti) {
        this.ilkBaglanti = false
        this.log(`✅ ${this.kod} (${this.ip}) bağlandı`)
      } else {
        this.yenidenBaglanmaSayisi++
        this.log(`✅ ${this.kod} (${this.ip}) YENİDEN bağlandı (#${this.yenidenBaglanmaSayisi})`)
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

  /** Merker bloğu oku (byte). Hata bağlantı kopması olabilir. */
  readMerker(start: number, size: number): Promise<Buffer> {
    return withTimeout(
      new Promise<Buffer>((resolve, reject) => {
        this.client.MBRead(start, size, (err, data) => {
          if (err) reject(new Error(this.errText(err)))
          else resolve(data)
        })
      }),
      OP_TIMEOUT,
      `${this.kod} MBRead(${start},${size})`,
    )
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
    try {
      this.client.Disconnect()
    } catch {
      /* yoksay */
    }
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
    try {
      this.client.Disconnect()
    } catch {
      /* yoksay */
    }
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
    }
  }
}
