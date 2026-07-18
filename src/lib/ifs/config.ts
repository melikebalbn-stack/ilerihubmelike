import 'server-only'
import { z } from 'zod'

/**
 * IFS Cloud entegrasyon yapılandırması — env'den okunur, zod ile doğrulanır.
 * SERVER-ONLY: IFS credential'ları asla client bundle'a sızmamalı.
 *
 * Zorunlu env'lerden biri eksikse getIfsConfig() net, tipli bir hata fırlatır.
 */

const IfsConfigSchema = z.object({
  IFS_INT_BASE_URL: z.string().min(1, 'IFS_INT_BASE_URL zorunlu'),
  IFS_TOKEN_URL: z.string().min(1, 'IFS_TOKEN_URL zorunlu'),
  IFS_CLIENT_ID: z.string().min(1, 'IFS_CLIENT_ID zorunlu'),
  IFS_CLIENT_SECRET: z.string().min(1, 'IFS_CLIENT_SECRET zorunlu'),
  IFS_SCOPE: z.string().optional(),
  IFS_CONTRACT: z.string().min(1).default('ILER2'),
  // DİKKAT: Company (ILERI2) ≠ Contract (ILER2) — farklı değerler, contract'tan TÜRETİLMEZ.
  IFS_COMPANY: z.string().min(1).default('ILERI2'),
})

export interface IfsConfig {
  /** ShopFloorService.svc base URL — sondaki slash temizlenmiş. */
  baseUrl: string
  /** Keycloak OAuth2 token endpoint (client_credentials). */
  tokenUrl: string
  clientId: string
  clientSecret: string
  /** Opsiyonel OAuth2 scope. */
  scope?: string
  /** IFS site/contract kodu (varsayılan ILER2). */
  contract: string
  /** IFS firma (Company) kodu — TeamEmployee için (varsayılan ILERI2, contract'tan FARKLI). */
  company: string
}

let cached: IfsConfig | null = null

/**
 * IFS yapılandırmasını döndürür (ilk çağrıda doğrulanır ve cache'lenir).
 * @throws Error — zorunlu env eksik/geçersizse hangi alanların hatalı olduğunu belirtir.
 */
export function getIfsConfig(): IfsConfig {
  if (cached) return cached

  const parsed = IfsConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`IFS yapılandırması eksik/geçersiz: ${issues}`)
  }

  const d = parsed.data
  cached = {
    // base + '/' + funcCall birleştirmesinde çift slash olmasın diye temizle
    baseUrl: d.IFS_INT_BASE_URL.replace(/\/+$/, ''),
    tokenUrl: d.IFS_TOKEN_URL,
    clientId: d.IFS_CLIENT_ID,
    clientSecret: d.IFS_CLIENT_SECRET,
    scope: d.IFS_SCOPE,
    contract: d.IFS_CONTRACT,
    company: d.IFS_COMPANY,
  }
  return cached
}
