import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type VerifyResult =
  | {
      kind: "valid"
      reportNo: string
      partName: string
      lotNo: string | null
      result: "PENDING" | "OK" | "RED"
      finalizedAt: Date
    }
  | { kind: "notfound" }

async function lookup(qrKey: string): Promise<VerifyResult> {
  if (!qrKey || qrKey.length < 16) return { kind: "notfound" }

  const report = await prisma.measurementReport.findUnique({
    where: { qrKey },
    select: {
      reportNo: true,
      partName: true,
      lotNo: true,
      result: true,
      finalizedAt: true,
    },
  })

  if (!report || !report.finalizedAt) return { kind: "notfound" }

  return {
    kind: "valid",
    reportNo: report.reportNo,
    partName: report.partName,
    lotNo: report.lotNo,
    result: report.result as "PENDING" | "OK" | "RED",
    finalizedAt: report.finalizedAt,
  }
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const RESULT_LABELS: Record<"PENDING" | "OK" | "RED", string> = {
  PENDING: "Bekliyor",
  OK: "OK",
  RED: "RED",
}

const RESULT_CLASS: Record<"PENDING" | "OK" | "RED", string> = {
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  OK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RED: "bg-red-50 text-red-700 border-red-200",
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ qrKey: string }>
}) {
  const { qrKey } = await params
  const result = await lookup(qrKey)

  if (result.kind === "notfound") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-md w-full text-center shadow-sm">
          <XCircle size={48} className="mx-auto text-red-500 mb-3" />
          <h1 className="text-xl font-bold text-red-700">
            Geçersiz veya bulunamayan rapor
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Bu doğrulama kodu sistemde tanınmıyor veya rapor henüz finalize
            edilmemiş.
          </p>
          <p className="text-[11px] text-slate-400 mt-4 font-mono break-all">
            {qrKey}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      <div className="bg-white border-2 border-emerald-300 rounded-lg p-8 max-w-md w-full shadow-lg">
        <div className="text-center">
          <div className="bg-emerald-100 p-3 rounded-full inline-block mb-3">
            <CheckCircle2 size={48} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-emerald-700">
            Rapor Doğrulandı
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bu rapor sistem tarafından finalize edilmiştir.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Field label="Rapor No" value={result.reportNo} mono />
          <Field label="Parça" value={result.partName} />
          <Field label="Lot No" value={result.lotNo ?? "—"} mono />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Sonuç
            </div>
            <div className="mt-1">
              <span
                className={`inline-flex items-center justify-center min-w-[60px] px-2 py-1 rounded border text-[11px] font-bold tracking-wide ${RESULT_CLASS[result.result]}`}
              >
                {RESULT_LABELS[result.result]}
              </span>
            </div>
          </div>
          <Field
            label="Finalize Tarihi"
            value={fmtDateTime(result.finalizedAt)}
          />
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-[#1B4F72]" />
          İLERİ HUB · Kalite
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`mt-0.5 font-semibold ${mono ? "font-mono text-sm" : "text-base"} text-slate-800`}
      >
        {value}
      </div>
    </div>
  )
}
