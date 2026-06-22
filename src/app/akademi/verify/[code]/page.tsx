import { headers } from "next/headers";
import { CheckCircle2, XCircle, Award, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VerifyResult =
  | {
      kind: "valid" | "expired";
      certificateNo: string;
      userName: string;
      courseName: string;
      issuedAt: Date;
      validUntil: Date | null;
    }
  | { kind: "notfound" };

async function verifyAndLog(code: string): Promise<VerifyResult> {
  if (!code || code.length < 6) return { kind: "notfound" };

  const cert = await prisma.akademiCertificate.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true } },
    },
  });

  if (!cert) return { kind: "notfound" };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;

  await prisma.akademiCertificateVerification
    .create({
      data: {
        certificateId: cert.id,
        verifiedAt: new Date(),
        ipAddress: ip,
      },
    })
    .catch(() => {
      /* log fail kritik değil */
    });

  const isExpired =
    cert.validUntil && new Date(cert.validUntil) < new Date();

  return {
    kind: isExpired ? "expired" : "valid",
    certificateNo: cert.certificateNo,
    userName: cert.user?.name ?? "Bilinmeyen",
    courseName: cert.course?.title ?? "Kurs",
    issuedAt: cert.issuedAt,
    validUntil: cert.validUntil,
  };
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = await verifyAndLog(code);

  if (result.kind === "notfound") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-md w-full text-center shadow-sm">
          <XCircle size={48} className="mx-auto text-red-500 mb-3" />
          <h1 className="text-xl font-bold text-red-700">
            Geçersiz Sertifika
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Bu doğrulama koduna sahip bir sertifika bulunamadı.
          </p>
          <p className="text-xs text-slate-500 mt-4 font-mono break-all">
            {code}
          </p>
        </div>
      </div>
    );
  }

  if (result.kind === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="bg-white border-2 border-amber-300 rounded-lg p-8 max-w-md w-full text-center shadow-lg">
          <div className="bg-amber-100 p-3 rounded-full inline-block mb-3">
            <AlertTriangle size={48} className="text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-amber-800">
            Sertifika Geçerlilik Süresi Dolmuş
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Bu sertifika{" "}
            {result.validUntil ? fmtDate(result.validUntil) : "—"} tarihine
            kadar geçerliydi.
          </p>
          <div className="mt-6 space-y-3 text-left">
            <Field label="Kullanıcı" value={result.userName} />
            <Field label="Kurs" value={result.courseName} />
            <Field label="Düzenlenme" value={fmtDate(result.issuedAt)} />
            {result.validUntil && (
              <Field label="Son Geçerlilik" value={fmtDate(result.validUntil)} />
            )}
            <Field label="Sertifika No" value={result.certificateNo} mono />
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Award size={14} />
            İLERİ AKADEMİ
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-slate-50 p-6">
      <div className="bg-white border-2 border-green-300 rounded-lg p-8 max-w-md w-full text-center shadow-lg">
        <div className="bg-green-100 p-3 rounded-full inline-block mb-3">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-green-700">
          Geçerli Sertifika
        </h1>
        <div className="mt-6 space-y-3 text-left">
          <Field label="Kullanıcı" value={result.userName} />
          <Field label="Kurs" value={result.courseName} />
          <Field label="Düzenlenme" value={fmtDate(result.issuedAt)} />
          {result.validUntil && (
            <Field label="Geçerlilik Tarihi" value={fmtDate(result.validUntil)} />
          )}
          <Field label="Sertifika No" value={result.certificateNo} mono />
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Award size={14} />
          İLERİ AKADEMİ
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`font-semibold ${mono ? "font-mono text-sm" : "text-base"} text-slate-800`}
      >
        {value}
      </div>
    </div>
  );
}
