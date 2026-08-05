"use client";

import { useState } from "react";
import {
  Play,
  FileText,
  FileCode,
  HelpCircle,
  ListChecks,
  Eye,
  CheckCircle2,
  MoreHorizontal,
  Building2,
  GraduationCap,
  RotateCcw,
} from "lucide-react";
import { getContentTypeLabel, formatDuration } from "@/lib/akademi-helpers";
import type { ContentItem } from "@/types/akademi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Açıklama modal'ı başlık/metni durum bazlı.
const MODAL_METIN: Record<
  string,
  { title: string; desc: string; placeholder: string; buton: string }
> = {
  ORNEK_YAPILDI: {
    title: "Ne yaptınız? (kısa açıklama)",
    desc: "Bu görevde örnek olarak ne yaptığınızı kısaca yazın. Değerlendiren ekip okuyacak.",
    placeholder: "Örn. IFS ekranında ... kaydını oluşturdum / ... işlemini uyguladım.",
    buton: "Örnek Yaptım",
  },
  FARKLI_DEPARTMAN: {
    title: "Neden farklı departman?",
    desc: "Bu görev sizin bölümünüze ait değilse kısaca nedenini yazın. Bu görev ilerlemenizden düşülür.",
    placeholder: "Örn. Bu ekran satınalma bölümüne ait, benim görevim değil.",
    buton: "Farklı Departman",
  },
  EGITIM_GEREKLI: {
    title: "Hangi konuda eğitim gerekli?",
    desc: "Bu görevi yapabilmek için hangi konuda eğitime ihtiyacınız olduğunu yazın.",
    placeholder: "Örn. IFS ... modülünde eğitim almadım, uygulamalı destek gerekiyor.",
    buton: "Eğitim Gerekli Olarak İşaretle",
  },
};

// Kursiyer durum butonları — üçü de görünür (dropdown'da gizli DEĞİL).
// Aktif durumun butonu dolu (variant default), diğerleri outline.
const DURUM_BUTONLAR: {
  durum: string;
  label: string;
  renk: string;
  Icon: typeof CheckCircle2;
}[] = [
  { durum: "ORNEK_YAPILDI", label: "Örnek Yaptım", renk: "var(--ak-green)", Icon: CheckCircle2 },
  { durum: "FARKLI_DEPARTMAN", label: "Farklı Dept.", renk: "#64748b", Icon: Building2 },
  { durum: "EGITIM_GEREKLI", label: "Eğitim Gerekli", renk: "#d97706", Icon: GraduationCap },
];

interface Props {
  content: ContentItem;
  index: number;
  onOpen: (content: ContentItem) => void;
  onMarkComplete: (contentId: string) => Promise<void>;
  // IFS-DURUM: GOREV görev durumu (ORNEK_YAPILDI / FARKLI_DEPARTMAN / EGITIM_GEREKLI / BEKLIYOR).
  // Açıklama zorunlu durumlarda modal ile alınır.
  onGorevDurum?: (
    contentId: string,
    durum: string,
    aciklama?: string
  ) => Promise<void>;
  isMarking: boolean;
}

const ICONS = {
  VIDEO: Play,
  PDF: FileText,
  DOCUMENT: FileCode,
  QUIZ: HelpCircle,
  GOREV: ListChecks,
};

const COLORS = {
  VIDEO: "purple",
  PDF: "red",
  DOCUMENT: "teal",
  QUIZ: "orange",
  GOREV: "accent",
} as const;

export function ContentRow({
  content,
  index,
  onOpen,
  onMarkComplete,
  onGorevDurum,
  isMarking,
}: Props) {
  const Icon = ICONS[content.type];
  const colorKey = COLORS[content.type];
  const isCompleted = content.completedByCurrentUser;
  const isGorev = content.type === "GOREV";
  const canView = Boolean(content.filePath || content.fileUrl);

  // Mevcut kursiyer durumu (completedByCurrentUser ile tutarlı fallback).
  const durum =
    content.kursiyerDurum ?? (isCompleted ? "ORNEK_YAPILDI" : "BEKLIYOR");

  // Açıklama modal'ı — hangi durum için açıldığını da tutar.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDurum, setModalDurum] = useState<string>("ORNEK_YAPILDI");
  const [aciklama, setAciklama] = useState("");
  const modalMetin = MODAL_METIN[modalDurum] ?? MODAL_METIN.ORNEK_YAPILDI;

  const openDurumModal = (d: string) => {
    setModalDurum(d);
    // Yeniden işaretlemede mevcut açıklamayı önele (düzenlenebilir).
    setAciklama(content.ornekAciklama ?? "");
    setModalOpen(true);
  };

  const confirmDurum = async () => {
    const text = aciklama.trim();
    if (!text) return;
    await onGorevDurum?.(content.id, modalDurum, text);
    setModalOpen(false);
  };

  // Geri Al → BEKLIYOR (açıklama gerekmez; mevcut açıklama sunucuda saklanır).
  const geriAl = async () => {
    await onGorevDurum?.(content.id, "BEKLIYOR");
  };

  // Buton tıklaması:
  // - Zaten aktif durum → toggle → BEKLIYOR (ayrı "Geri Al" gerekmez).
  // - ORNEK_YAPILDI (aktif değil) → modal + zorunlu açıklama.
  // - FARKLI_DEPARTMAN / EGITIM_GEREKLI (aktif değil) → TEK TIK, modal YOK, açıklama İSTENMEZ.
  const handleDurumClick = async (d: string) => {
    if (durum === d) {
      await geriAl();
      return;
    }
    if (d === "ORNEK_YAPILDI") {
      openDurumModal(d);
    } else {
      await onGorevDurum?.(content.id, d);
    }
  };

  return (
    <>
    <div
      className={`ak-card-static p-4 flex items-center gap-4 ak-animate-in ak-delay-${Math.min(
        index + 1,
        8
      )}`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isCompleted
            ? "var(--ak-green-glow)"
            : `var(--ak-${colorKey}-glow)`,
        }}
      >
        {isCompleted ? (
          <CheckCircle2
            className="w-5 h-5"
            style={{ color: "var(--ak-green)" }}
          />
        ) : (
          <Icon
            className="w-5 h-5"
            style={{ color: `var(--ak-${colorKey})` }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-semibold mb-0.5 truncate"
          style={{ color: "var(--ak-text-primary)" }}
        >
          {index + 1}. {content.title}
        </div>
        <div
          className="text-xs flex items-center gap-2 flex-wrap"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          <span>{getContentTypeLabel(content.type)}</span>
          {isGorev && content.ifsMeta?.modul && (
            <>
              <span>•</span>
              <span>
                {content.ifsMeta.modul}
                {content.ifsMeta.altModul
                  ? ` / ${content.ifsMeta.altModul}`
                  : ""}
              </span>
            </>
          )}
          {isGorev && content.ifsMeta?.ifsEkran && (
            <>
              <span>•</span>
              <span>{content.ifsMeta.ifsEkran}</span>
            </>
          )}
          {!isGorev && content.duration && (
            <>
              <span>•</span>
              <span>{formatDuration(content.duration)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isGorev ? (
          <>
            {content.ifsMeta?.refDocUrl && (
              <a
                href={content.ifsMeta.refDocUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
                style={{
                  background: "var(--ak-teal-glow)",
                  color: "var(--ak-teal)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Doküman
              </a>
            )}
            {content.ifsMeta?.refVideoUrl && (
              <a
                href={content.ifsMeta.refVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
                style={{
                  background: "var(--ak-purple-glow)",
                  color: "var(--ak-purple)",
                }}
              >
                <Play className="w-3.5 h-3.5" />
                Video
              </a>
            )}
            {/* Üç durum da GÖRÜNÜR buton — aktif olan dolu, diğerleri outline. */}
            {DURUM_BUTONLAR.map(({ durum: d, label, renk, Icon: BtnIcon }) => {
              const aktif = durum === d;
              return (
                <Button
                  key={d}
                  size="sm"
                  variant={aktif ? "default" : "outline"}
                  onClick={() => handleDurumClick(d)}
                  disabled={isMarking}
                  style={
                    aktif
                      ? { background: renk, color: "#fff", borderColor: renk }
                      : { color: renk, borderColor: renk }
                  }
                >
                  <BtnIcon className="w-3.5 h-3.5 mr-1" />
                  {label}
                </Button>
              );
            })}
            {/* İkincil aksiyon: yalnız Geri Al dropdown'da (durum işaretliyse). */}
            {durum !== "BEKLIYOR" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isMarking}
                    aria-label="Diğer"
                    className="px-2"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={geriAl}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Geri Al (işareti kaldır)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : (
          <>
            {canView ? (
              <button
                onClick={() => onOpen(content)}
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] flex items-center gap-1 transition-colors"
                style={{
                  background: "var(--ak-accent-glow)",
                  color: "var(--ak-accent)",
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                Görüntüle
              </button>
            ) : (
              <div
                className="text-xs italic"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Dosya yüklenmedi
              </div>
            )}
            {!isCompleted && (
              <button
                onClick={() => onMarkComplete(content.id)}
                disabled={isMarking}
                className="px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors disabled:opacity-50"
                style={{ background: "var(--ak-green)", color: "#fff" }}
              >
                {isMarking ? "..." : "Tamamla"}
              </button>
            )}
          </>
        )}
      </div>
    </div>

      {/* Durum açıklaması — ORNEK_YAPILDI / FARKLI_DEPARTMAN / EGITIM_GEREKLI (zorunlu). */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalMetin.title}</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{content.title}</span> — {modalMetin.desc}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder={modalMetin.placeholder}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isMarking}
            >
              Vazgeç
            </Button>
            <Button
              onClick={confirmDurum}
              disabled={isMarking || aciklama.trim() === ""}
            >
              {isMarking ? "Kaydediliyor..." : modalMetin.buton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
