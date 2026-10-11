import { useEffect, useRef, useState } from "react";
import Section from "./Section";
import { Icon } from "./icons";
import type { Teacher } from "../types";

const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");

// photo_url katagida quyidagilardan istalgani bo'lishi mumkin:
//  - Google Drive havolasi yoki faqat fayl ID'si (rasm "Anyone with the link" bo'lishi kerak)
//  - fayl nomi (ali.jpg) — public/assets/teachers/ papkasidan olinadi
//  - boshqa to'liq havola (https://...)
const driveId = (u: string) =>
  u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([\w-]{20,})/)?.[1] ??
  (/^[\w-]{25,}$/.test(u) ? u : null);

const photoSrc = (url: string) => {
  const id = driveId(url);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w800`;
  return /^(https?:|data:)/.test(url)
    ? url
    : `${import.meta.env.BASE_URL}assets/teachers/${url.replace(/^\.?\/?(assets\/teachers\/)?/, "")}`;
};

// Karta tuzilishi (admin paneldagi maydonlar o'zgarmagan):
//  rasm (tik to'rtburchak 4:5) · ism (full_name) · qisqa izoh (position) · "Batafsil" bosilganda — bio shu kartaning o'zida ochiladi
function Photo({ t }: { t: Teacher }) {
  const [failed, setFailed] = useState(false);
  if (t.photo && !failed) {
    return (
      <img
        src={photoSrc(t.photo)}
        alt={t.fullName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-[50%_22%]"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-900 via-brand-600 to-sky text-5xl font-extrabold text-white/90" aria-hidden="true">
      {initials(t.fullName)}
    </div>
  );
}

export default function Teachers({ teachers, name }: { teachers: Teacher[]; name: string }) {
  const n = teachers.length;
  const [active, setActive] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null); // batafsil qismi ochiq o'qituvchi
  const [paused, setPaused] = useState(false);
  const [w, setW] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Avtomatik aylanish: sichqoncha/barmoq tegsa yoki batafsil qismi ochiq bo'lsa TO'XTAYDI
  useEffect(() => {
    if (n < 2 || paused || openId !== null) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), 3500);
    return () => clearInterval(t);
  }, [n, paused, openId]);

  const select = (i: number) => { setOpenId(null); setActive(i); };
  const go = (d: number) => { setOpenId(null); setActive((a) => (a + d + n) % n); };

  const cardW = Math.min(340, w * 0.78);
  const step = cardW * 0.82;
  const half = Math.floor(n / 2);
  const photoFull = Math.round(cardW * 1.25);                // 4:5 tik to'rtburchak
  const photoSmall = Math.max(88, Math.round(cardW * 0.36)); // batafsil ochilganda rasm kichrayadi

  return (
    <Section id="teachers" title="O'qituvchilar" eyebrow="Jamoa" tone="light" prev="tint" wave="curve" backdrop={5} subtitle={`${name} ustozlari — har bir talabaga e'tibor beradigan tajribali mutaxassislar.`}>
      <div
        ref={box}
        data-reveal
        className="grid touch-pan-y items-start justify-items-center overflow-hidden py-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => {
          // Batafsil qismi ochiq paytda surish karusel'ni aylantirmaydi (sahifa o'qish uchun tinch turadi)
          if (touchX.current !== null && openId === null) {
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }
          touchX.current = null;
          setPaused(false);
        }}
      >
        {teachers.map((t, i) => {
          const d = ((i - active + n + half) % n) - half;
          const abs = Math.abs(d);
          const isActive = d === 0;
          const hasMore = t.bio.trim().length > 0;
          const open = isActive && hasMore && openId === t.id;
          return (
            <article
              key={t.id}
              aria-hidden={!isActive}
              onClick={() => abs === 1 && select(i)}
              className={`[grid-area:1/1] overflow-hidden rounded-3xl border bg-white text-center transition-[transform,opacity,box-shadow,border-color] duration-700 ease-out ${isActive ? "border-brand-600/30 shadow-2xl" : "border-slate-200 shadow-sm"} ${abs === 1 ? "cursor-pointer" : ""}`}
              style={{
                width: cardW || undefined,
                transformOrigin: "50% 0",
                transform: `translateX(${d * step}px) scale(${isActive ? 1 : 0.8})`,
                opacity: isActive ? 1 : abs === 1 ? 0.55 : abs === 2 ? 0.2 : 0,
                zIndex: 10 - abs,
                pointerEvents: abs > 1 ? "none" : "auto",
              }}
            >
              {/* Rasm: yopiq holatda katta tik to'rtburchak, ochilganda silliq kichrayadi */}
              <div
                className="relative overflow-hidden bg-slate-100 transition-[height] duration-500 ease-in-out"
                style={{ height: open ? photoSmall : photoFull || undefined, aspectRatio: photoFull ? undefined : "4 / 5" }}
              >
                <Photo t={t} />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
              </div>

              {/* Ism va qisqa izoh — bosilganda batafsil ochiladi */}
              <button
                type="button"
                disabled={!hasMore}
                tabIndex={isActive ? 0 : -1}
                aria-expanded={open}
                aria-controls={`teacher-${t.id}`}
                onClick={(e) => {
                  if (!isActive) return; // yon kartada bosish — kartani markazga olib keladi (article onClick)
                  e.stopPropagation();
                  setOpenId(open ? null : t.id);
                }}
                className={`block w-full px-5 pb-4 pt-4 text-center ${hasMore ? "cursor-pointer" : "cursor-default"}`}
              >
                <h3 className="text-lg font-extrabold leading-snug sm:text-xl">{t.fullName}</h3>
                <p className="mt-1 text-[0.92rem] font-medium leading-snug text-brand-600 sm:text-[0.95rem]">{t.position}</p>
                {hasMore && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-[0.8rem] font-bold text-brand-600 sm:text-sm">
                    {open ? "Yopish" : "Batafsil"}
                    <Icon name="chevron" className={`h-4 w-4 transition-transform duration-500 ${open ? "rotate-180" : ""}`} />
                  </span>
                )}
              </button>

              {/* Batafsil ma'lumot — shu kartaning o'zida silliq ochiladi */}
              <div id={`teacher-${t.id}`} role="region" aria-label={`${t.fullName} haqida`} className="acc" data-open={open} style={{ transitionDuration: "500ms" }}>
                <div>
                  <p className={`whitespace-pre-line px-5 pb-5 text-left text-[0.9rem] leading-relaxed text-slate-600 transition-opacity duration-500 sm:text-[0.95rem] ${open ? "opacity-100" : "opacity-0"}`}>{t.bio}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {n > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4 sm:mt-4">
          <button onClick={() => go(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white transition hover:border-brand-600 hover:bg-brand-600 hover:text-white" aria-label="Oldingi o'qituvchi"><Icon name="chevleft" className="h-5 w-5" /></button>
          <div className="flex gap-2" aria-hidden="true">
            {teachers.map((t, i) => (
              <span key={t.id} className={`h-2 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-saffron" : "w-2 bg-slate-300"}`} />
            ))}
          </div>
          <button onClick={() => go(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white transition hover:border-brand-600 hover:bg-brand-600 hover:text-white" aria-label="Keyingi o'qituvchi"><Icon name="right" className="h-5 w-5" /></button>
        </div>
      )}
    </Section>
  );
}
