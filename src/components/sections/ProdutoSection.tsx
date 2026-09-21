"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { gsap, ScrollTrigger, prefersReducedMotion, supportsHover } from "@/lib/gsap";

type GalleryItem = {
  index: number;
  alt: string;
  // Trocar por "/images/produto-0X.jpg" aqui quando os assets finais
  // chegarem — é a única linha que muda por imagem, o resto do
  // componente (grid, animação, lightbox) não precisa de ajuste.
  src?: string;
  ratio: string;
  gridClassName: string;
};

const TONE_OVERLAYS = [
  "",
  "bg-fernandito-off-white/10",
  "bg-fernandito-verde-escuro/15",
  "bg-fernandito-off-white/5",
  "bg-fernandito-verde-escuro/10",
  "bg-fernandito-off-white/15",
];

const ITEMS: GalleryItem[] = [
  {
    index: 1,
    alt: "Fernandito — foto do produto 01",
    ratio: "3 / 4",
    gridClassName: "md:col-span-5 md:col-start-1 md:row-start-1",
  },
  {
    index: 2,
    alt: "Fernandito — foto do produto 02",
    ratio: "1 / 1",
    gridClassName: "md:col-span-4 md:col-start-6 md:row-start-1 md:mt-16",
  },
  {
    index: 3,
    alt: "Fernandito — foto do produto 03",
    ratio: "4 / 5",
    gridClassName: "md:col-span-3 md:col-start-10 md:row-start-1 md:mt-32",
  },
  {
    index: 4,
    alt: "Fernandito — foto do produto 04",
    ratio: "16 / 9",
    gridClassName: "md:col-span-6 md:col-start-4 md:row-start-3",
  },
  {
    index: 5,
    alt: "Fernandito — foto do produto 05",
    ratio: "3 / 4",
    gridClassName: "md:col-span-4 md:col-start-1 md:row-start-4",
  },
  {
    index: 6,
    alt: "Fernandito — foto do produto 06",
    ratio: "1 / 1",
    gridClassName: "md:col-span-5 md:col-start-6 md:row-start-4 md:mt-12",
  },
];

function GalleryImage({
  item,
  onOpen,
}: {
  item: GalleryItem;
  onOpen: (index: number, triggerEl: HTMLElement) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const reduceMotion = prefersReducedMotion();

    let revealTrigger: ScrollTrigger | null = null;
    if (reduceMotion) {
      gsap.set(wrapper, { opacity: 1, y: 0, scale: 1 });
    } else {
      gsap.set(wrapper, { opacity: 0, y: 60, scale: 0.95 });
      revealTrigger = ScrollTrigger.create({
        trigger: wrapper,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.to(wrapper, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" });
        },
      });
    }

    let cleanupHover: (() => void) | null = null;
    if (!reduceMotion && supportsHover()) {
      const moveX = gsap.quickTo(inner, "x", { duration: 0.5, ease: "power2.out" });
      const moveY = gsap.quickTo(inner, "y", { duration: 0.5, ease: "power2.out" });

      const handleMove = (event: MouseEvent) => {
        const rect = wrapper.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / rect.width - 0.5;
        const relY = (event.clientY - rect.top) / rect.height - 0.5;
        moveX(relX * 20);
        moveY(relY * 15);
      };
      const handleEnter = () => {
        gsap.to(inner, { scale: 1.05, duration: 0.4, ease: "power2.out" });
      };
      const handleLeave = () => {
        gsap.to(inner, { x: 0, y: 0, scale: 1, duration: 0.4, ease: "power2.out" });
      };

      wrapper.addEventListener("mousemove", handleMove);
      wrapper.addEventListener("mouseenter", handleEnter);
      wrapper.addEventListener("mouseleave", handleLeave);
      cleanupHover = () => {
        wrapper.removeEventListener("mousemove", handleMove);
        wrapper.removeEventListener("mouseenter", handleEnter);
        wrapper.removeEventListener("mouseleave", handleLeave);
      };
    }

    return () => {
      revealTrigger?.kill();
      cleanupHover?.();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ aspectRatio: item.ratio }}
      className={clsx("relative overflow-hidden rounded-lg", item.gridClassName)}
    >
      <button
        type="button"
        onClick={(event) => onOpen(item.index, event.currentTarget)}
        aria-label={`Ampliar: ${item.alt}`}
        className="absolute inset-0 h-full w-full cursor-zoom-in"
      >
        <div ref={innerRef} className="absolute inset-0 h-full w-full [will-change:transform]">
          <GalleryVisual item={item} fit="cover" />
        </div>
      </button>
    </div>
  );
}

function GalleryVisual({ item, fit }: { item: GalleryItem; fit: "cover" | "contain" }) {
  if (item.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- placeholder->real swap is a 1-line `src` change; revisit with next/image once assets are final
      <img
        src={item.src}
        alt={item.alt}
        className={clsx("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
      />
    );
  }

  return (
    <div className="bg-fernandito-verde-medio relative flex h-full w-full items-center justify-center">
      <div className={clsx("absolute inset-0", TONE_OVERLAYS[item.index - 1])} />
      <span className="text-label text-fernandito-off-white relative font-sans tracking-[0.08em] uppercase">
        PRODUTO {String(item.index).padStart(2, "0")}
      </span>
    </div>
  );
}

function Lightbox({ item, onClose }: { item: GalleryItem | null; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return;

    if (prefersReducedMotion()) {
      gsap.set(overlay, { opacity: 1 });
      gsap.set(dialog, { opacity: 1, scale: 1 });
    } else {
      gsap.set(overlay, { opacity: 0 });
      gsap.set(dialog, { opacity: 0, scale: 0.92 });
      gsap.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" });
      gsap.to(dialog, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" });
    }

    dialog.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      className="bg-fernandito-verde-escuro/90 fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.alt}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ aspectRatio: item.ratio }}
        className="relative h-screen w-screen outline-none sm:h-auto sm:max-h-[80vh] sm:w-auto sm:max-w-[80vw]"
      >
        <GalleryVisual item={item} fit="contain" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-fernandito-off-white absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-2xl leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ProdutoSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const handleOpen = (index: number, triggerEl: HTMLElement) => {
    triggerElRef.current = triggerEl;
    setOpenIndex(index);
  };

  const handleClose = () => {
    setOpenIndex(null);
    triggerElRef.current?.focus();
  };

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;

    if (prefersReducedMotion()) {
      gsap.set(heading, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.set(heading, { opacity: 0, y: 60, scale: 0.95 });
    const trigger = ScrollTrigger.create({
      trigger: heading,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(heading, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" });
      },
    });
    return () => trigger.kill();
  }, []);

  const activeItem = ITEMS.find((item) => item.index === openIndex) ?? null;

  return (
    <section id="produto" className="bg-fernandito-verde-medio w-full px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-y-16 md:grid-cols-12 md:gap-x-6 md:gap-y-24">
        <GalleryImage item={ITEMS[0]} onOpen={handleOpen} />
        <GalleryImage item={ITEMS[1]} onOpen={handleOpen} />
        <GalleryImage item={ITEMS[2]} onOpen={handleOpen} />

        <h2
          ref={headingRef}
          className="text-display-lg text-fernandito-off-white font-serif md:col-span-5 md:col-start-1 md:row-start-2"
        >
          O gole que conta a história
        </h2>

        <GalleryImage item={ITEMS[3]} onOpen={handleOpen} />
        <GalleryImage item={ITEMS[4]} onOpen={handleOpen} />
        <GalleryImage item={ITEMS[5]} onOpen={handleOpen} />
      </div>

      <Lightbox item={activeItem} onClose={handleClose} />
    </section>
  );
}

export default ProdutoSection;
