import { headers } from "next/headers";
import { CheckCircle2, XCircle, Award } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function verifyAndLog(code: string) {
  if (!code || code.length < 6) return null;

  const cert = await prisma.akademiCertificate.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true } },
    },
  });

  if (!cert) return null;

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

  return {
    certificateNo: cert.certificateNo,
    userName: cert.user?.name ?? "Bilinmeyen",
    courseName: cert.course?.title ?? "Kurs",
    issuedAt: cert.issuedAt,
  };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await verifyAndLog(code);

  if (!cert) {
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

  const dateStr = new Date(cert.issuedAt).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
          <Field label="Kullanıcı" value={cert.userName} />
          <Field label="Kurs" value={cert.courseName} />
          <Field label="Tarih" value={dateStr} />
          <Field label="Sertifika No" value={cert.certificateNo} mono />
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
