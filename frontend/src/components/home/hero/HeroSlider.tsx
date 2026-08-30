"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocaleCode } from "@maglive/contracts";
import { LocaleLink } from "@/components/site/LocaleLink";
import { heroSlides } from "./hero.data";

const AUTOPLAY_MS = 7600;

export function HeroSlider({ locale, accessibilityTitle }: { locale: LocaleCode; accessibilityTitle: string }) {
  const heroRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + heroSlides.length) % heroSlides.length);
  }, []);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const previous = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (paused || reducedMotion) return;
    timerRef.current = setTimeout(() => goTo(activeIndex + 1), AUTOPLAY_MS);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [activeIndex, goTo, paused, reducedMotion]);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = node.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      node.style.setProperty("--pointer-x", `${x.toFixed(3)}`);
      node.style.setProperty("--pointer-y", `${y.toFixed(3)}`);
    };
    const onPointerLeave = () => {
      node.style.setProperty("--pointer-x", "0");
      node.style.setProperty("--pointer-y", "0");
    };
    const onScroll = () => {
      const bounds = node.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      node.style.setProperty("--scroll-depth", progress.toFixed(3));
    };

    node.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      next();
      setPaused(true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      previous();
      setPaused(true);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
      setPaused(true);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(heroSlides.length - 1);
      setPaused(true);
    } else if (event.key === " ") {
      event.preventDefault();
      setPaused((value) => !value);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    touchStartX.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const distance = event.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 48) return;
    setPaused(true);
    if (distance < 0) next();
    else previous();
  }

  const activeSlide = heroSlides[activeIndex] ?? heroSlides[0]!;

  return (
    <section
      ref={heroRef}
      aria-label="Maglive energy outlook"
      className={`hero hero--cinematic hero--${activeSlide.tone} ${paused ? "hero--paused" : ""}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      tabIndex={0}
    >
      <div className="hero__media" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <div className={`hero-slide ${index === activeIndex ? "is-active" : ""}`} key={slide.id}>
            {slide.video ? (
              <video
                autoPlay
                className="hero-slide__video"
                loop
                muted
                playsInline
                poster={slide.image}
                preload={index === 0 ? "metadata" : "none"}
              >
                <source src={slide.video} />
              </video>
            ) : (
              <Image
                alt=""
                className="hero-slide__image"
                fill
                priority={index === 0}
                sizes="100vw"
                src={slide.image}
              />
            )}
          </div>
        ))}
        <div className="hero__wash" />
        <div className="hero__grain" />
      </div>

      <div className="hero__frame" aria-hidden="true">
        <span>MAGLIVE / ENERGY SYSTEMS</span>
        <span>GLOBAL INFRASTRUCTURE / 2025</span>
      </div>

      <div className="hero__content container">
        <div className="hero__copy" key={activeSlide.id}>
          <p className="hero__eyebrow"><span className="hero__eyebrow-line" />{activeSlide.eyebrow}</p>
          <h1 aria-label={accessibilityTitle}>{activeSlide.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
          <p className="hero__description">{activeSlide.description}</p>
          <div className="hero__actions">
            <LocaleLink className="hero__cta hero__cta--primary" href={activeSlide.primaryHref} locale={locale}>
              {activeSlide.primary}<span aria-hidden="true">-&gt;</span>
            </LocaleLink>
            <LocaleLink className="hero__cta hero__cta--secondary" href={activeSlide.secondaryHref} locale={locale}>
              {activeSlide.secondary}<span aria-hidden="true">-&gt;</span>
            </LocaleLink>
          </div>
        </div>

        <div className="hero__scene" aria-hidden="true">
          <div className="hero-scene__grid" />
          <div className="hero-scene__core">
            <span className="hero-scene__halo hero-scene__halo--one" />
            <span className="hero-scene__halo hero-scene__halo--two" />
            <span className="hero-scene__orb"><i /><i /><i /></span>
          </div>
          <span className="hero-scene__signal hero-scene__signal--one">LIVE / 99.98%</span>
          <span className="hero-scene__signal hero-scene__signal--two">GRID READY</span>
          <span className="hero-scene__signal hero-scene__signal--three">+24.8 MW</span>
        </div>
      </div>

      <div className="hero__footer container">
        <div className="hero__counter" aria-live="polite"><strong>{String(activeIndex + 1).padStart(2, "0")}</strong><span>/ 04</span></div>
        <div className="hero__progress" role="tablist" aria-label="Hero slides">
          {heroSlides.map((slide, index) => (
            <button
              aria-label={`Show ${slide.eyebrow.toLowerCase()}`}
              aria-selected={index === activeIndex}
              className={`hero__progress-item ${index === activeIndex ? "is-active" : ""}`}
              key={slide.id}
              onClick={() => { goTo(index); setPaused(true); }}
              role="tab"
              type="button"
            >
              <span className="hero__progress-bar"><i /></span>
              <span>{slide.eyebrow.slice(5)}</span>
            </button>
          ))}
        </div>
        <div className="hero__controls">
          <button aria-label="Previous slide" className="hero__arrow" onClick={() => { previous(); setPaused(true); }} type="button"><span aria-hidden="true">&lt;-</span></button>
          <button aria-label="Next slide" className="hero__arrow" onClick={() => { next(); setPaused(true); }} type="button"><span aria-hidden="true">-&gt;</span></button>
          <button aria-label={paused ? "Resume autoplay" : "Pause autoplay"} aria-pressed={paused} className="hero__pause" onClick={() => setPaused((value) => !value)} type="button"><span aria-hidden="true">{paused ? "PLAY" : "PAUSE"}</span></button>
        </div>
      </div>
    </section>
  );
}
