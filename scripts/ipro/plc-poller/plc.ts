/**
 * PlcConnection — tek bir Siemens S7 panosuna KALICI bağlantı.
 * - connect/disconnect her okumada YAPILMAZ; bağlantı açık tutulur.
 * - Koparsa exponential backoff (1s→60s) ile yeniden bağlanır.
 * - Her op (connect/read) timeout'lu → hung bir PLC diğerlerini bloklamaz.
 * Bağlantı bilgileri DB'den (IproPlc) gelir, hardcode yok.
 */
import { S7Client } from 'node-snap7'

const BACKOFF_MIN = 1_000
const BACKOFF_MAX = 60_000
const OP_TIMEOUT = 4_000

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
}

export class PlcConnection {
  private client = new S7Client()
  private backoffMs = BACKOFF_MIN
  private nextAttemptAt = 0
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
      this.log(`✅ ${this.kod} (${this.ip}) bağlandı`)
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
  }

  onReadError(msg: string) {
    this.lastError = msg
    if (!this.connected) {
      this.nextAttemptAt = Date.now() + this.backoffMs
      this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX)
    }
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
    }
  }
}
