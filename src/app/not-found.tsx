"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#f9fafb" }}
    >
      <div className="max-w-md w-full text-center">
        <div
          className="text-7xl font-bold mb-4"
          style={{ color: "#3878ff" }}
        >
          404
        </div>
        <div
          className="text-xl font-bold mb-2"
          style={{ color: "#0f172a" }}
        >
          Sayfa Bulunamadı
        </div>
        <p
          className="text-sm mb-8"
          style={{ color: "rgba(15, 23, 42, 0.6)" }}
        >
          Aradığınız sayfa mevcut değil, taşınmış veya henüz yayında değil.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-colors"
            style={{ background: "#3878ff", color: "#fff" }}
          >
            <Home className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-colors"
            style={{
              background: "#fff",
              color: "#0f172a",
              border: "1px solid rgba(15, 23, 42, 0.1)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Geri Dön
          </button>
        </div>
      </div>
    </div>
  );
}
