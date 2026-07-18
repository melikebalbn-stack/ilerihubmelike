/**
 * node-snap7 için minimal tip bildirimi (kütüphane kendi tiplerini getirmiyor).
 * Yalnız poller'da kullanılan yüzey. Sabitler S7Client instance'ında (ör. c.S7AreaMK).
 */
declare module 'node-snap7' {
  export class S7Client {
    ConnectTo(ip: string, rack: number, slot: number, cb: (err: number) => void): void
    Connected(): boolean
    Disconnect(): void
    /** Merker (M) alanından `size` byte oku, `start` byte offset'inden. */
    MBRead(start: number, size: number, cb: (err: number, data: Buffer) => void): void
    ErrorText(err: number): string
  }
}
