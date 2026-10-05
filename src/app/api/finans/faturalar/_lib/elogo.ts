import { inflateRawSync } from 'zlib'

// eLogo e-Fatura PostBoxService entegrasyonu — fatura eklenince arka planda PDF'ini
// bulup indirmek için. SOAP action'ları WSDL'den doğrulandı (http://tempuri.org/IPostBoxService/<op>),
// WSDL dosyasını her çağrıda okumaya gerek yok.

const URL = 'https://pb.elogo.com.tr/PostBoxService.svc'
const TNS = 'http://tempuri.org/'
const DC = 'http://schemas.datacontract.org/2004/07/eFaturaWebService'
const AR = 'http://schemas.microsoft.com/2003/10/Serialization/Arrays'

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function soapCall(action: string, body: string): Promise<string> {
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"http://tempuri.org/IPostBoxService/${action}"`,
    },
    body: envelope,
  })
  return res.text()
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`))
  return m ? m[1] : null
}

async function login(): Promise<string> {
  const user = process.env.ELOGO_USERNAME
  const pass = process.env.ELOGO_PASSWORD
  if (!user || !pass) throw new Error('ELOGO_USERNAME / ELOGO_PASSWORD .env.local içinde tanımlı değil')

  const body =
    `<Login xmlns="${TNS}"><login xmlns:a="${DC}">` +
    `<a:appStr>ILERIHub</a:appStr>` +
    `<a:passWord>${xmlEscape(pass)}</a:passWord>` +
    `<a:source>ILERIHub</a:source>` +
    `<a:userName>${xmlEscape(user)}</a:userName>` +
    `<a:version>1.0</a:version></login></Login>`
  const txt = await soapCall('Login', body)
  const sid = extractTag(txt, 'sessionID')
  if (!sid) throw new Error('eLogo login başarısız: ' + txt.slice(0, 400))
  return sid
}

async function logout(sessionID: string): Promise<void> {
  try {
    await soapCall('Logout', `<Logout xmlns="${TNS}"><sessionID>${sessionID}</sessionID></Logout>`)
  } catch {
    // Logout başarısız olsa da sorun değil — session zaten timeout ile düşer.
  }
}

async function getDocumentList(sessionID: string, day: string): Promise<string[]> {
  // day: "YYYY-MM-DD". OPTYPE=2 -> SendRecvType.RECV (bize gelen faturalar).
  const params = ['DOCUMENTTYPE=EINVOICE', `BEGINDATE=${day}`, `ENDDATE=${day}`, 'OPTYPE=2']
  const paramList = params.map((p) => `<b:string>${xmlEscape(p)}</b:string>`).join('')
  const body =
    `<GetDocumentList xmlns="${TNS}"><sessionID>${sessionID}</sessionID>` +
    `<paramList xmlns:b="${AR}">${paramList}</paramList></GetDocumentList>`
  const txt = await soapCall('GetDocumentList', body)
  return Array.from(txt.matchAll(/<(?:\w+:)?Document>([\s\S]*?)<\/(?:\w+:)?Document>/g)).map((m) => m[1])
}

/** Bir faturanın eLogo'daki documentUuid'sini (ETTN) bulur — fatura no eşleşmesiyle. */
export async function findInvoiceUuid(invoiceNumber: string, invoiceDateISO: string): Promise<string | null> {
  const day = invoiceDateISO.slice(0, 10)
  const days = [day]
  // Belge eLogo'ya invoiceDate'ten 1 gün sonra düşmüş olabilir (gönderim/kayıt gecikmesi) — geniş tut.
  const d = new Date(day)
  d.setDate(d.getDate() + 1)
  days.push(d.toISOString().slice(0, 10))

  const sessionID = await login()
  try {
    for (const d2 of days) {
      const docs = await getDocumentList(sessionID, d2)
      for (const doc of docs) {
        const json = extractTag(doc, 'documentJSon')
        const uuid = extractTag(doc, 'documentUuid')
        if (json && uuid && json.includes(invoiceNumber)) {
          return uuid
        }
      }
    }
    return null
  } finally {
    await logout(sessionID)
  }
}

/** documentUuid'ye göre PDF içeriğini indirir. */
export async function fetchInvoicePdf(uuid: string): Promise<Buffer> {
  const sessionID = await login()
  try {
    const body =
      `<getDocumentData xmlns="${TNS}"><sessionID>${sessionID}</sessionID><uuid>${xmlEscape(uuid)}</uuid>` +
      `<docType>EINVOICE</docType><dataType>PDF</dataType></getDocumentData>`
    const txt = await soapCall('getDocumentData', body)
    const value = extractTag(txt, 'Value')
    if (!value) throw new Error('eLogo PDF verisi alınamadı: ' + txt.slice(0, 400))
    const raw = Buffer.from(value, 'base64')
    // eLogo PDF'i de (UBL gibi) tek dosyalık bir ZIP içinde dönüyor ("PK" imzası).
    return raw.subarray(0, 2).toString('latin1') === 'PK' ? unzipFirstEntry(raw) : raw
  } finally {
    await logout(sessionID)
  }
}

/**
 * Tek dosyalık bir ZIP'in ilk (ve tek) kaydını çıkarır — adm-zip/jszip gibi bir bağımlılık
 * eklemeden (package.json paylaşımlı dosya, değiştirmeden önce sorulması gerekiyor).
 * ZIP local file header formatı: https://en.wikipedia.org/wiki/ZIP_(file_format)#Local_file_header
 */
function unzipFirstEntry(zip: Buffer): Buffer {
  if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error('Geçersiz ZIP imzası')
  const method = zip.readUInt16LE(8)
  const compressedSize = zip.readUInt32LE(18)
  const nameLen = zip.readUInt16LE(26)
  const extraLen = zip.readUInt16LE(28)
  const dataStart = 30 + nameLen + extraLen
  const compressed = zip.subarray(dataStart, dataStart + compressedSize)
  if (method === 0) return Buffer.from(compressed) // STORED — sıkıştırılmamış
  if (method === 8) return inflateRawSync(compressed) // DEFLATE
  throw new Error(`Desteklenmeyen ZIP sıkıştırma yöntemi: ${method}`)
}

/** Fatura eklenince arka planda çağrılır: eLogo'da arar, bulursa PDF'i indirip diske yazar. */
export async function resolveAndStorePdf(opts: {
  invoiceId: string
  invoiceNumber: string
  invoiceDateISO: string
}): Promise<{ uuid: string; pdfPath: string } | null> {
  const uuid = await findInvoiceUuid(opts.invoiceNumber, opts.invoiceDateISO)
  if (!uuid) return null

  const pdf = await fetchInvoicePdf(uuid)
  const fs = await import('fs/promises')
  const path = await import('path')
  const dir = path.join(process.cwd(), 'storage', 'sandbox-melike', 'fatura-pdf')
  await fs.mkdir(dir, { recursive: true })
  const pdfPath = path.join(dir, `${opts.invoiceId}.pdf`)
  await fs.writeFile(pdfPath, pdf)
  return { uuid, pdfPath }
}
