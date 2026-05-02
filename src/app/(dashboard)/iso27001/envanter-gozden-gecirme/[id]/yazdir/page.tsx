import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import PrintActions from "./print-actions"
import ReactMarkdown from "react-markdown"

interface SonucAksiyon {
  no: number
  aksiyon: string
  sorumlu: string
  termin: string
  durum: string
}

interface DigitalSignature {
  signatureType: string
  signatureCode: string
  signedAt: string
  documentHash: string
  signerName: string
  signerEmail: string
  signerTitle: string
  signerDepartment?: string
  role: string
  note?: string
}

interface SignaturesJson {
  hazirlayan?: DigitalSignature
  onaylayan?: DigitalSignature
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/login")

  const { id } = await params

  const review = await prisma.inventoryReview.findUnique({
    where: { id },
  })

  if (!review) notFound()

  const aksiyonlar = (review.sonucAksiyonlar as unknown as SonucAksiyon[]) ?? []
  const signatures = (review.signatures as unknown as SignaturesJson | null) ?? {}
  const hazSig = signatures.hazirlayan
  const onaySig = signatures.onaylayan

  const iliskiliDokumanlar = await prisma.iso27001Document.findMany({
    where: { documentNumber: { in: review.iliskiliDokumanIds } },
    select: { documentNumber: true, title: true },
  })

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* DashboardLayout'taki Sidebar/Header/BottomNav'ı hem ekranda
               hem yazdırırken gizle. Sidebar root: .bg-slate-900.border-r */
            .bg-slate-900,
            header,
            nav.fixed.bottom-0,
            [data-sonner-toaster] {
              display: none !important;
            }
            /* Layout wrapper'ın min-w / overflow / padding kısıtlamalarını kaldır */
            .lg\\:pl-64 {
              padding-left: 0 !important;
            }
            html, body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            .h-screen {
              height: auto !important;
              min-height: 0 !important;
            }
            .overflow-hidden {
              overflow: visible !important;
            }
            main {
              padding: 0 !important;
              background: white !important;
              overflow: visible !important;
            }
            .print-container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 20mm;
              background: white;
              font-family: 'Times New Roman', Georgia, serif;
              color: #000;
              font-size: 11pt;
              line-height: 1.5;
            }
            .print-container h1 {
              font-size: 16pt;
              font-weight: bold;
              text-align: center;
              margin: 8mm 0;
            }
            .print-container h2 {
              font-size: 13pt;
              font-weight: bold;
              margin: 6mm 0 3mm;
              padding-bottom: 1mm;
              border-bottom: 1px solid #000;
            }
            .print-container h3 {
              font-size: 11pt;
              font-weight: bold;
              margin: 4mm 0 2mm;
            }
            .print-container p {
              margin: 2mm 0;
            }
            .print-container ul, .print-container ol {
              margin: 2mm 0 2mm 6mm;
            }
            .print-container li {
              margin: 1mm 0;
            }
            .print-container hr {
              border: none;
              border-top: 1px solid #999;
              margin: 4mm 0;
            }
            .print-header {
              border-bottom: 2px solid #000;
              padding-bottom: 6mm;
              margin-bottom: 6mm;
            }
            .print-header-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              font-size: 10pt;
            }
            .print-meta {
              text-align: right;
              line-height: 1.4;
            }
            .print-section {
              margin: 6mm 0;
            }
            .print-snapshot {
              display: flex;
              gap: 4mm;
              margin: 4mm 0;
            }
            .print-snapshot div {
              flex: 1;
              border: 1px solid #000;
              padding: 3mm;
              text-align: center;
            }
            .print-snapshot strong {
              font-size: 14pt;
              display: block;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              margin: 3mm 0;
              font-size: 10pt;
            }
            .print-table th, .print-table td {
              border: 1px solid #000;
              padding: 2mm 3mm;
              text-align: left;
              vertical-align: top;
            }
            .print-table th {
              background: #f0f0f0;
              font-weight: bold;
            }
            .print-signatures {
              margin-top: 10mm;
              display: flex;
              gap: 6mm;
            }
            .print-signatures > div {
              flex: 1;
              border: 1px solid #000;
              padding: 4mm;
              font-size: 9.5pt;
              line-height: 1.45;
            }
            .print-signatures strong {
              display: block;
              margin-bottom: 1.5mm;
              font-size: 10pt;
            }
            .print-signatures .imza-meta {
              margin-top: 2mm;
              padding-top: 2mm;
              border-top: 1px dashed #999;
              font-size: 8.5pt;
            }
            .print-signatures .imza-code {
              font-family: 'Courier New', monospace;
              font-weight: bold;
              font-size: 9pt;
              margin: 1mm 0;
            }
            .print-signatures .imza-hash {
              font-family: 'Courier New', monospace;
              font-size: 7.5pt;
              color: #444;
              word-break: break-all;
            }
            .print-signatures .imza-stamp {
              display: inline-block;
              padding: 1mm 3mm;
              border: 1.5px solid #006400;
              color: #006400;
              font-weight: bold;
              font-size: 8.5pt;
              border-radius: 2mm;
              margin-top: 1mm;
            }
            .print-content-hash {
              margin-top: 4mm;
              padding: 2mm 3mm;
              border: 1px solid #999;
              background: #f5f5f5;
              font-family: 'Courier New', monospace;
              font-size: 8pt;
              word-break: break-all;
            }
            .print-doc-list {
              list-style: none;
              padding: 0;
              margin: 2mm 0;
            }
            .print-doc-list li {
              padding: 1.5mm 0;
              border-bottom: 1px dashed #ccc;
              font-size: 10pt;
            }
            .print-doc-no {
              font-family: 'Courier New', monospace;
              font-weight: bold;
              margin-right: 3mm;
            }

            @media print {
              .print-actions,
              .bg-slate-900,
              header,
              nav.fixed.bottom-0,
              [data-sonner-toaster] {
                display: none !important;
              }
              @page {
                size: A4;
                margin: 15mm;
              }
              .print-container {
                padding: 0;
                max-width: none;
              }
              .page-break {
                page-break-before: always;
              }
              h1, h2, h3 {
                page-break-after: avoid;
              }
              .print-table, .print-signatures {
                page-break-inside: avoid;
              }
            }
          `,
        }}
      />

      <div className="print-container">
        <PrintActions />

        {/* Header */}
        <header className="print-header">
          <div className="print-header-row">
            <div>
              <strong>İLERİ GROUP</strong>
              <br />
              Bilgi Güvenliği Yönetim Sistemi
              <br />
              <span style={{ fontSize: "9pt", color: "#444" }}>
                ISO 27001:2022 — A.5.9 / Madde 9.1
              </span>
            </div>
            <div className="print-meta">
              <strong>Doküman No:</strong> {review.tutanakNo}
              <br />
              <strong>İç Kod:</strong> {review.internalCode}
              <br />
              <strong>Tarih:</strong>{" "}
              {format(review.reviewDate, "dd.MM.yyyy", { locale: tr })}
            </div>
          </div>
          <h1>{review.baslik}</h1>
        </header>

        {/* Snapshot */}
        <section className="print-section">
          <h2>Envanter Snapshot</h2>
          <div className="print-snapshot">
            <div>
              <strong>{review.hardwareCount ?? "—"}</strong>
              Donanım Varlığı
            </div>
            <div>
              <strong>{review.softwareCount ?? "—"}</strong>
              Yazılım Varlığı
            </div>
            <div>
              <strong>{review.informationCount ?? "—"}</strong>
              Bilgi Varlığı
            </div>
          </div>
        </section>

        <section className="print-section">
          <h2>1. Amaç</h2>
          <ReactMarkdown>{review.amac}</ReactMarkdown>
        </section>

        <section className="print-section">
          <h2>2. Kapsam</h2>
          <ReactMarkdown>{review.kapsam}</ReactMarkdown>
        </section>

        <section className="print-section">
          <h2>3. Süreç Tarihçesi</h2>
          <ReactMarkdown>{review.surecTarihcesi}</ReactMarkdown>
        </section>

        <section className="print-section">
          <h2>4. Bulgular</h2>
          <ReactMarkdown>{review.bulgular}</ReactMarkdown>
        </section>

        <section className="print-section">
          <h2>5. Sonuç ve Aksiyonlar</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: "8%" }}>No</th>
                <th>Aksiyon</th>
                <th style={{ width: "20%" }}>Sorumlu</th>
                <th style={{ width: "15%" }}>Termin</th>
                <th style={{ width: "12%" }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {aksiyonlar.map((a) => (
                <tr key={a.no}>
                  <td>{a.no}</td>
                  <td>{a.aksiyon}</td>
                  <td>{a.sorumlu}</td>
                  <td>{a.termin}</td>
                  <td>{a.durum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-section">
          <h2>6. İlişkili Dokümanlar</h2>
          <ul className="print-doc-list">
            {review.iliskiliDokumanIds.map((docNo) => {
              const doc = iliskiliDokumanlar.find(
                (d) => d.documentNumber === docNo,
              )
              return (
                <li key={docNo}>
                  <span className="print-doc-no">{docNo}</span>
                  {doc?.title ?? "(Doküman bulunamadı)"}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Signatures */}
        <section className="print-section">
          <h2>7. Dijital İmzalar</h2>
          <footer className="print-signatures">
            <div>
              <strong>Hazırlayan</strong>
              {hazSig?.signerName ?? review.hazirlayanAd}
              <br />
              {hazSig?.signerTitle ?? review.hazirlayanUnvan}
              {hazSig?.signerDepartment && (
                <>
                  <br />
                  {hazSig.signerDepartment}
                </>
              )}
              {hazSig ? (
                <>
                  <div className="imza-meta">
                    <div>
                      Tarih:{" "}
                      {format(new Date(hazSig.signedAt), "dd.MM.yyyy HH:mm", {
                        locale: tr,
                      })}
                    </div>
                    <div className="imza-code">
                      İmza Kodu: {hazSig.signatureCode}
                    </div>
                    <div className="imza-hash">
                      Hash: {hazSig.documentHash}
                    </div>
                    <div className="imza-stamp">✓ DİJİTAL OLARAK İMZALANDI</div>
                  </div>
                </>
              ) : (
                <div className="imza-meta">
                  Tarih: {review.hazirlanmaTarihi
                    ? format(review.hazirlanmaTarihi, "dd.MM.yyyy", { locale: tr })
                    : "____.____.________"}
                  <div style={{ marginTop: "12mm", borderBottom: "1px solid #000" }}>
                    İmza
                  </div>
                </div>
              )}
            </div>
            <div>
              <strong>Onaylayan</strong>
              {onaySig?.signerName ?? review.onaylayanAd ?? "Halit İleri"}
              <br />
              {onaySig?.signerTitle ?? review.onaylayanUnvan ?? "Genel Müdür"}
              {onaySig?.signerDepartment && (
                <>
                  <br />
                  {onaySig.signerDepartment}
                </>
              )}
              {onaySig ? (
                <>
                  <div className="imza-meta">
                    <div>
                      Tarih:{" "}
                      {format(new Date(onaySig.signedAt), "dd.MM.yyyy HH:mm", {
                        locale: tr,
                      })}
                    </div>
                    <div className="imza-code">
                      İmza Kodu: {onaySig.signatureCode}
                    </div>
                    <div className="imza-hash">
                      Hash: {onaySig.documentHash}
                    </div>
                    <div className="imza-stamp">✓ DİJİTAL OLARAK İMZALANDI</div>
                  </div>
                </>
              ) : (
                <div className="imza-meta">
                  Tarih: {review.onayTarihi
                    ? format(review.onayTarihi, "dd.MM.yyyy", { locale: tr })
                    : "____.____.________"}
                  <div style={{ marginTop: "12mm", borderBottom: "1px solid #000" }}>
                    İmza
                  </div>
                </div>
              )}
            </div>
          </footer>
          {review.contentHash && (
            <div className="print-content-hash">
              <strong>İçerik Bütünlük Hash'i (SHA-256):</strong>
              <br />
              {review.contentHash}
            </div>
          )}
        </section>

        <div
          style={{
            marginTop: "10mm",
            paddingTop: "3mm",
            borderTop: "1px solid #ccc",
            fontSize: "8pt",
            color: "#666",
            textAlign: "center",
          }}
        >
          Bu doküman ILERIHub BGYS modülü tarafından{" "}
          {format(new Date(), "dd.MM.yyyy HH:mm", { locale: tr })} tarihinde
          oluşturulmuştur · {review.tutanakNo}
        </div>
      </div>
    </>
  )
}
