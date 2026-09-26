/**
 * Genel ilerleme halkası — saf SVG (Recharts yok). Atanan eğitimler üzerinden:
 *   yüzde = tamamlanan / atanan (merkezde), halkada tamamlandı (yeşil) +
 *   devam eden (cyan) + başlanmadı (gri) dilimleri; sağda sayaç legend'i.
 * r=15.9 → çevre ≈ 100, dasharray değerleri doğrudan yüzde.
 */
export function ProgressRing({
  assigned,
  completed,
  inProgress,
}: {
  assigned: number;
  completed: number;
  inProgress: number;
}) {
  const notStarted = Math.max(0, assigned - completed - inProgress);
  const completedPct = assigned ? (completed / assigned) * 100 : 0;
  const inProgressPct = assigned ? (inProgress / assigned) * 100 : 0;
  const yuzde = Math.round(completedPct);

  return (
    <div className="flex items-center gap-[18px] rounded-[14px] border border-[#e5e9f0] bg-white p-[16px_20px]">
      <svg width="88" height="88" viewBox="0 0 42 42" aria-hidden>
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e5e9f0" strokeWidth="5" />
        {completedPct > 0 && (
          <circle
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke="#16a34a"
            strokeWidth="5"
            strokeDasharray={`${completedPct} ${100 - completedPct}`}
            strokeDashoffset="25"
            strokeLinecap="butt"
          />
        )}
        {inProgressPct > 0 && (
          <circle
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke="#12B5CB"
            strokeWidth="5"
            strokeDasharray={`${inProgressPct} ${100 - inProgressPct}`}
            strokeDashoffset={`${25 - completedPct}`}
            strokeLinecap="butt"
          />
        )}
        <text
          x="21"
          y="23.5"
          textAnchor="middle"
          fontSize="8"
          fontWeight="600"
          fill="#0f172a"
        >
          %{yuzde}
        </text>
      </svg>
      <div>
        <div className="text-[13px] text-[#64748b]">Genel ilerleme</div>
        <div className="text-[22px] font-semibold text-[#0f172a]">{yuzde}%</div>
        <div className="mt-2 grid gap-1 text-[12px] text-[#475569]">
          <div>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#16a34a]" />
            Tamamlandı {completed}
          </div>
          <div>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#12B5CB]" />
            Devam eden {inProgress}
          </div>
          <div>
            <i className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#e5e9f0]" />
            Başlanmadı {notStarted}
          </div>
        </div>
      </div>
    </div>
  );
}
