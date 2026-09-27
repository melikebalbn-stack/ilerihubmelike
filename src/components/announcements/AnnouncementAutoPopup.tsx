"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnnouncementModal, type AnnouncementPopupData } from "./AnnouncementModal";
import { selectPendingPopups } from "@/lib/announcements/announcement-ui";

type ApiAnnouncement = AnnouncementPopupData & { publishedAt?: string | null };

/**
 * Dashboard layout'ta BİR KEZ mount edilir. Her (sert) sayfa yüklemesinde
 * /api/announcements/bekleyen → görülmemiş yayındaki duyuruları tek tek popup açar.
 * Ayrıca ?ac=<id> (push tıklaması) verildiğinde o duyuruyu öne alır (görülmüş olsa da).
 * Kapatınca /goruldu, onaylayınca /acknowledge yazılır → bir daha çıkmaz.
 */
export function AnnouncementAutoPopup() {
  const searchParams = useSearchParams();
  const ac = searchParams.get("ac");
  const [queue, setQueue] = useState<AnnouncementPopupData[]>([]);

  // Görülmemiş bekleyen duyurular (mount'ta bir kez)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements/bekleyen")
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((d: { announcements?: ApiAnnouncement[] }) => {
        if (cancelled) return;
        const sorted = selectPendingPopups(
          (d.announcements ?? []).map((a) => ({ ...a, seen: false }))
        );
        setQueue((prev) => mergeUnique(prev, sorted));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Push tıklaması: ?ac=<id> → o duyuruyu öne al (görülmüş olsa da)
  useEffect(() => {
    if (!ac) return;
    let cancelled = false;
    fetch(`/api/announcements/${ac}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a: ApiAnnouncement | null) => {
        if (cancelled || !a) return;
        setQueue((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ac]);

  if (queue.length === 0) return null;
  const current = queue[0];

  const advance = () => setQueue((q) => q.slice(1));

  const dismiss = () => {
    fetch(`/api/announcements/${current.id}/goruldu`, { method: "POST" }).catch(() => {});
    advance();
  };
  const acknowledge = () => {
    fetch(`/api/announcements/${current.id}/acknowledge`, { method: "POST" }).catch(() => {});
    advance();
  };

  return <AnnouncementModal a={current} onDismiss={dismiss} onAcknowledge={acknowledge} />;
}

function mergeUnique(
  a: AnnouncementPopupData[],
  b: AnnouncementPopupData[]
): AnnouncementPopupData[] {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
}
