import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { Icon } from "./icons";
import { telHref } from "../lib/contact";

const links = [
  { href: "#about", label: "Biz haqimizda" },
  { href: "#courses", label: "Kurslar" },
  { href: "#teachers", label: "O'qituvchilar" },
  { href: "#faq", label: "Savollar" },
  { href: "#contact", label: "Aloqa" },
];

export default function Header({ name, phone }: { name: string; phone?: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const bar = useRef<HTMLSpanElement>(null);
  const [first, ...restWords] = name.trim().split(/\s+/);
  const rest = restWords.join(" ");

  // Skroll: sarlavha ixchamlashadi, tepada o'qish progressi chizig'i
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        const h = document.documentElement.scrollHeight - window.innerHeight;
        if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Hozir qaysi bo'limda ekanimiz menyuda ko'rinadi
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    links.forEach((l) => { const el = document.querySelector(l.href); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "bg-white/90 shadow-[0_8px_30px_-12px_rgba(7,50,63,0.35)] backdrop-blur-xl" : "bg-white max-sm:border-b max-sm:border-slate-100"}`}>
      <span ref={bar} className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-saffron via-sky to-leaf" aria-hidden="true" />
      <div className={`mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 transition-all duration-300 sm:gap-4 sm:px-6 ${scrolled ? "h-[3.25rem] sm:h-[4.5rem]" : "h-16 sm:h-[5.5rem]"}`}>
        <a href="#top" aria-label={name} className="flex min-w-0 shrink items-center gap-1.5 sm:shrink-0 sm:gap-1">
          <Logo name={name} className={`w-auto shrink-0 transition-all duration-300 ${scrolled ? "h-11 sm:h-[4.5rem]" : "h-[3.25rem] sm:h-[5.5rem]"}`} />
          <span className="min-w-0 leading-none lg:hidden xl:block">
            <span className="block truncate text-[1.05rem] font-extrabold tracking-tight text-brand-900 sm:text-2xl">{first}</span>
            {rest && <span className="mt-0.5 block truncate text-[0.72rem] font-bold tracking-wide text-leaf sm:text-base">{rest}</span>}
          </span>
        </a>

        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex" aria-label="Asosiy menyu">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={`group relative whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${active === l.href ? "text-brand-600" : "text-slate-600 hover:text-brand-600"}`}>
              {l.label}
              <span className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded bg-saffron transition-transform duration-300 ${active === l.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {phone && (
            <a href={telHref(phone)} className="group hidden items-center gap-2.5 whitespace-nowrap rounded-full border border-brand-600/20 bg-brand-50 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-brand-900 transition hover:border-brand-600/50 hover:bg-white md:flex" aria-label={`Qo'ng'iroq qilish: ${phone}`}>
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                <span className="pulse-ring text-brand-600" />
                <Icon name="phone" className="ringing h-4 w-4" />
              </span>
              <span className="hidden xl:inline">{phone}</span>
              <span className="xl:hidden">Qo'ng'iroq</span>
            </a>
          )}
          {phone && (
            <a href={telHref(phone)} aria-label={`Qo'ng'iroq qilish: ${phone}`} className="press flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm sm:hidden">
              <Icon name="phone" className="ringing h-[1.1rem] w-[1.1rem]" />
            </a>
          )}
          <a href="#apply" className="btn-shine hidden whitespace-nowrap rounded-full bg-saffron px-5 py-2.5 text-sm font-bold text-brand-900 shadow-sm transition hover:brightness-105 sm:inline-flex">
            Kursga yozilish
          </a>
          <button
            className="press flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:bg-brand-50 sm:h-11 sm:w-11 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "x" : "menu"} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="menu-in max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain border-t border-slate-100 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 shadow-xl max-sm:rounded-b-3xl lg:hidden" aria-label="Mobil menyu">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 py-3 text-base font-medium text-slate-700 active:text-brand-600">
              {l.label}
              <Icon name="right" className="h-4 w-4 text-slate-400" />
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {phone ? (
              <a href={telHref(phone)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white">
                <Icon name="phone" className="h-4 w-4" /> Qo'ng'iroq
              </a>
            ) : <span />}
            <a href="#apply" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl bg-saffron py-3 font-bold text-brand-900">Yozilish</a>
          </div>
        </nav>
      )}
    </header>
  );
}
