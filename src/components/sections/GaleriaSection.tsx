"use client";

import { useEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  DURATION,
  EASE,
  prefersReducedMotion,
  supportsHover,
} from "@/lib/gsap";

// ── Photo data ───────────────────────────────────────────────────

type TrackPhoto = {
  label: string;
  tone: string;
  widthVw: number;
  aspect: string;
  yPct: number;
  zIndex: number;
  speed: number;
  startXVw: number;
};

const HERO_LABEL = "FOTO HERO";
const HERO_TONE = "bg-fernandito-verde-medio";
const HERO_WIDTH_VW = 65;
const HERO_ASPECT = "4 / 5";
const HERO_Z = 10;

// 3 speed tiers: slow/foreground (0.9–1.0), medium (1.3), fast/background (1.7–2.0)
const TRACK: TrackPhoto[] = [
  { label: "FOTO 01", tone: "bg-fernandito-verde-claro", widthVw: 30, aspect: "3 / 4", yPct: 10, zIndex: 5, speed: 1.0, startXVw: 55 },
  { label: "FOTO 02", tone: "bg-fernandito-verde-medio/80", widthVw: 22, aspect: "4 / 5", yPct: -15, zIndex: 3, speed: 1.8, startXVw: 95 },
  { label: "FOTO 03", tone: "bg-fernandito-verde-claro/90", widthVw: 35, aspect: "3 / 4", yPct: 5, zIndex: 7, speed: 0.9, startXVw: 140 },
  { label: "FOTO 04", tone: "bg-fernandito-verde-medio", widthVw: 20, aspect: "3 / 5", yPct: -20, zIndex: 2, speed: 2.0, startXVw: 185 },
  { label: "FOTO 05", tone: "bg-fernandito-verde-claro", widthVw: 28, aspect: "4 / 5", yPct: 12, zIndex: 4, speed: 1.3, startXVw: 225 },
  { label: "FOTO 06", tone: "bg-fernandito-verde-medio/85", widthVw: 24, aspect: "3 / 4", yPct: -8, zIndex: 3, speed: 1.7, startXVw: 265 },
];

const BASE_DISPLACEMENT_VW = 150;
const SHADOW = "0 20px 60px rgba(36, 48, 34, 0.25)";
const SHADOW_HOVER = "0 25px 80px rgba(36, 48, 34, 0.4)";
const RADIUS = "1.5rem";

const ALL_PHOTOS = [
  { label: HERO_LABEL, tone: HERO_TONE, aspect: HERO_ASPECT },
  ...TRACK.map((p) => ({ label: p.label, tone: p.tone, aspect: p.aspect })),
];

// ── Placeholder ──────────────────────────────────────────────────

function Placeholder({ label, tone }: { label: string; tone: string }) {
  return (
    <div className={`${tone} absolute inset-0 flex items-center justify-center`}>
      <span className="text-label text-fernandito-off-white font-sans uppercase opacity-90">
        {label}
      </span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export function GaleriaSection() {
  const desktopRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mobileHeroRef = useRef<HTMLDivElement>(null);
  const mobileMaskRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // ── Desktop: two-phase pinned animation ──
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const container = desktopRef.current;
    const hero = heroRef.current;
    const mask = maskRef.current;
    const photos = trackRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!container || !hero || !mask || photos.length === 0) return;

    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;

    gsap.set(hero, { xPercent: -50, yPercent: -50 });

    photos.forEach((el, i) => {
      const p = TRACK[i];
      gsap.set(el, {
        xPercent: -50,
        yPercent: -50,
        x: p.startXVw * vw,
        y: p.yPct * vh,
        zIndex: p.zIndex,
        opacity: 0,
      });
    });

    const tl = gsap.timeline();

    // PHASE 1: mask reveal (0 → 0.28), breathe (0.28 → 0.35)
    tl.fromTo(mask, { scaleY: 1 }, { scaleY: 0, duration: 0.28, ease: "power2.inOut" }, 0);

    // PHASE 2 (0.35 → 1.0)

    // Hero shrinks and repositions
    tl.to(hero, { scale: 0.55, x: -28 * vw, y: 4 * vh, duration: 0.13, ease: "power2.inOut" }, 0.35);

    // Kill mask completely
    tl.set(mask, { autoAlpha: 0 }, 0.35);

    // Track photos fade in quickly
    tl.to(photos, { opacity: 1, duration: 0.07, ease: "none", stagger: 0.01 }, 0.35);

    // Hero parallax (after reposition)
    tl.to(hero, { x: (-28 - 1.0 * BASE_DISPLACEMENT_VW * 0.8) * vw, duration: 0.52, ease: "none" }, 0.48);

    // Track photos parallax (each at its own speed)
    photos.forEach((el, i) => {
      const p = TRACK[i];
      tl.to(el, { x: (p.startXVw - p.speed * BASE_DISPLACEMENT_VW) * vw, duration: 0.65, ease: "none" }, 0.35);
    });

    if (tl.totalDuration() < 1) tl.set({}, {}, 1);

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: `+=${280 * vh}`,
      pin: true,
      scrub: 1,
      animation: tl,
    });

    return () => {
      trigger.kill();
      tl.kill();
    };
  }, []);

  // ── Desktop: hover ──
  useEffect(() => {
    if (prefersReducedMotion() || !supportsHover()) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const wrappers = [heroRef.current, ...trackRefs.current].filter(Boolean) as HTMLDivElement[];
    const cleanups: (() => void)[] = [];

    wrappers.forEach((wrapper) => {
      const inner = wrapper.querySelector("[data-photo-inner]") as HTMLElement;
      if (!inner) return;

      let savedZ = 0;

      const onEnter = () => {
        savedZ = Number(gsap.getProperty(wrapper, "zIndex")) || 0;
        gsap.set(wrapper, { zIndex: 50 });
        gsap.to(inner, { scale: 1.05, boxShadow: SHADOW_HOVER, duration: DURATION.base, ease: EASE.outStandard });
      };

      const onLeave = () => {
        gsap.to(inner, {
          scale: 1,
          boxShadow: SHADOW,
          duration: DURATION.base,
          ease: EASE.outStandard,
          onComplete: () => gsap.set(wrapper, { zIndex: savedZ }),
        });
      };

      wrapper.addEventListener("mouseenter", onEnter);
      wrapper.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        wrapper.removeEventListener("mouseenter", onEnter);
        wrapper.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // ── Mobile: Phase 1 mask reveal (scrub, no pin) ──
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    const hero = mobileHeroRef.current;
    const mask = mobileMaskRef.current;
    if (!hero || !mask) return;

    const trigger = ScrollTrigger.create({
      trigger: hero,
      start: "top 75%",
      end: "center center",
      scrub: 0.6,
      animation: gsap.fromTo(mask, { scaleY: 1 }, { scaleY: 0, ease: "power2.inOut" }),
    });

    return () => trigger.kill();
  }, []);

  // ── Mobile: Phase 2 scroll row fade-in ──
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    const row = mobileScrollRef.current;
    if (!row) return;

    gsap.set(row, { opacity: 0, y: 30 });
    const trigger = ScrollTrigger.create({
      trigger: row,
      start: "top 85%",
      once: true,
      onEnter: () => gsap.to(row, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }),
    });

    return () => trigger.kill();
  }, []);

  return (
    <section
      id="galeria"
      aria-label="Galeria de fotos"
      className="bg-fernandito-verde-escuro relative w-full"
    >
      <h2 className="sr-only">Galeria</h2>

      {/* ── Animated (hidden under prefers-reduced-motion) ── */}
      <div className="motion-reduce:hidden">
        {/* Desktop: pinned two-phase container */}
        <div
          ref={desktopRef}
          className="bg-fernandito-verde-escuro relative hidden h-screen w-full overflow-hidden md:block"
        >
          {/* Hero photo — centered, revealed by mask in Phase 1 */}
          <div
            ref={heroRef}
            className="absolute top-1/2 left-1/2 [will-change:transform]"
            style={{ zIndex: HERO_Z }}
          >
            <div
              data-photo-inner
              data-cursor-hover
              role="img"
              aria-label="Galeria Fernandito — foto destaque"
              className="relative overflow-hidden"
              style={{ width: `${HERO_WIDTH_VW}vw`, aspectRatio: HERO_ASPECT, boxShadow: SHADOW, borderRadius: RADIUS }}
            >
              <Placeholder label={HERO_LABEL} tone={HERO_TONE} />
              <div ref={maskRef} className="bg-fernandito-verde-escuro absolute inset-0 origin-top" />
            </div>
          </div>

          {/* Track photos — positioned by GSAP, parallax in Phase 2 */}
          {TRACK.map((photo, i) => (
            <div
              key={photo.label}
              ref={(el) => {
                trackRefs.current[i] = el;
              }}
              className="absolute top-1/2 left-1/2 [will-change:transform]"
            >
              <div
                data-photo-inner
                data-cursor-hover
                role="img"
                aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
                className="relative overflow-hidden"
                style={{ width: `${photo.widthVw}vw`, aspectRatio: photo.aspect, boxShadow: SHADOW, borderRadius: RADIUS }}
              >
                <Placeholder label={photo.label} tone={photo.tone} />
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Phase 1 hero reveal + Phase 2 horizontal scroll */}
        <div className="md:hidden">
          <div className="flex items-center justify-center px-6 py-20">
            <div
              ref={mobileHeroRef}
              role="img"
              aria-label="Galeria Fernandito — foto destaque"
              className="relative w-full max-w-[80vw] overflow-hidden"
              style={{ aspectRatio: HERO_ASPECT, boxShadow: SHADOW, borderRadius: RADIUS }}
            >
              <Placeholder label={HERO_LABEL} tone={HERO_TONE} />
              <div ref={mobileMaskRef} className="bg-fernandito-verde-escuro absolute inset-0 origin-top" />
            </div>
          </div>

          <div
            ref={mobileScrollRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-12 [will-change:transform,opacity]"
          >
            {TRACK.map((photo) => (
              <div
                key={photo.label}
                className="relative shrink-0 snap-center overflow-hidden"
                role="img"
                aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
                style={{ width: "75vw", aspectRatio: photo.aspect, boxShadow: SHADOW, borderRadius: RADIUS }}
              >
                <Placeholder label={photo.label} tone={photo.tone} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reduced motion: static grid fallback ── */}
      <div className="hidden motion-reduce:block px-6 py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {ALL_PHOTOS.map((photo) => (
            <div
              key={photo.label}
              className="relative overflow-hidden"
              role="img"
              aria-label={`Galeria Fernandito — ${photo.label.toLowerCase()}`}
              style={{ aspectRatio: photo.aspect, boxShadow: SHADOW, borderRadius: RADIUS }}
            >
              <Placeholder label={photo.label} tone={photo.tone} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GaleriaSection;
