import 'server-only'
import { z } from 'zod'

/**
 * MAS MES (MSSQL) bağlantı yapılandırması — env'den okunur, zod ile doğrulanır.
 * SERVER-ONLY, SALT OKUMA (hub_ro). Credential asla client bundle'a sızmamalı (syteline/config.ts deseni).
 * Zorunlu env eksikse getMasConfig() net, tipli hata fırlatır.
 */
const MasConfigSchema = z.object({
  MAS_HOST: z.string().min(1, 'MAS_HOST zorunlu'),
  MAS_PORT: z.coerce.number().int().positive().default(1433),
  MAS_DB: z.string().min(1, 'MAS_DB zorunlu'),
  MAS_USER: z.string().min(1, 'MAS_USER zorunlu'),
  MAS_PASS: z.string().min(1, 'MAS_PASS zorunlu'),
  // TLS: self-signed sunucu → trustServerCertificate=true (env ile aç/kapa; varsayılan true).
  MAS_ENCRYPT: z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? true : v === 'true' || v === '1')),
  MAS_TRUST_CERT: z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? true : v === 'true' || v === '1')),
})

export interface MasConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  encrypt: boolean
  trustServerCertificate: boolean
}

let cached: MasConfig | null = null

/**
 * MAS yapılandırmasını döndürür (ilk çağrıda doğrulanır ve cache'lenir).
 * @throws Error — zorunlu env eksik/geçersizse hangi alanların hatalı olduğunu belirtir.
 */
export function getMasConfig(): MasConfig {
  if (cached) return cached
  const parsed = MasConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new Error(`MAS yapılandırması eksik/geçersiz: ${issues}`)
  }
  const d = parsed.data
  cached = {
    host: d.MAS_HOST,
    port: d.MAS_PORT,
    database: d.MAS_DB,
    user: d.MAS_USER,
    password: d.MAS_PASS,
    encrypt: d.MAS_ENCRYPT,
    trustServerCertificate: d.MAS_TRUST_CERT,
  }
  return cached
}
