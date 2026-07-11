import type { Metadata } from "next";
import SinavClient from "./SinavClient";

// Güvenlik: arama motoru indexlemesin, Referer'da token sızmasın.
export const metadata: Metadata = {
  title: "Aday Sınavı",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Public sınav sayfası (auth yok — middleware matcher'ında DEĞİL).
export default async function SinavPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SinavClient token={token} />;
}
