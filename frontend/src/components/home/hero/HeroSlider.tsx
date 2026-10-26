"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocaleCode } from "@maglive/contracts";
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from "@/components/ui/icons";
import { LocaleLink } from "@/components/site/LocaleLink";
import { composeHeroSlides, type HeroSlide } from "./hero.data";

const AUTOPLAY_MS = 7600;

type HeroControls = {
  previous: string;
  next: string;
  pause: string;
  play: string;
  slides: string;
};

export function HeroSlider({
  locale,
  slides: copy,
  controls,
}: {
  locale: LocaleCode;
  slides: readonly { id: string; eyebrow: string; title: string; description: string; primary: string; secondary: string }[];
  controls: HeroControls;
}) {
  const slides: readonly HeroSlide[] = composeHeroSlides(copy);
  const heroRef = useRef<HTMLElement>(null);
  const pointerStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + slides.length) % slides.length);
  }, [slides.length]);

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
      goTo(slides.length - 1);
      setPaused(true);
    } else if (event.key === " ") {
      event.preventDefault();
      setPaused((value) => !value);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    pointerStartX.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (pointerStartX.current === null) return;
    const distance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(distance) < 48) return;
    setPaused(true);
    if (distance < 0) next();
    else previous();
  }

  const activeSlide = slides[activeIndex] ?? slides[0];
  if (activeSlide === undefined) return null;
  const total = String(slides.length).padStart(2, "0");

  return (
    <section
      aria-label={controls.slides}
      className={`hero ${paused ? "hero--paused" : ""}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      ref={heroRef}
      tabIndex={0}
    >
      <div aria-hidden="true" className="hero__media">
        {slides.map((slide, index) => (
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
      </div>

      <div className="hero__grid-lines" aria-hidden="true" />

      <div className="hero__content">
        <div className="hero__rail" aria-hidden="true">
          <span className="hero__rail-index">{String(activeIndex + 1).padStart(2, "0")}</span>
          <span className="hero__rail-line" />
          <span className="hero__rail-total">{total}</span>
        </div>

        <div className="hero__copy" key={activeSlide.id}>
          <p className="hero__eyebrow">{activeSlide.eyebrow}</p>
          <h1>{activeSlide.title}</h1>
          <p className="hero__description">{activeSlide.description}</p>
          <div className="hero__actions">
            <LocaleLink className="cta cta--primary" href={activeSlide.primaryHref} locale={locale}>
              {activeSlide.primary}
              <ArrowRightIcon />
            </LocaleLink>
            <LocaleLink className="cta cta--onDark" href={activeSlide.secondaryHref} locale={locale}>
              {activeSlide.secondary}
            </LocaleLink>
          </div>
        </div>
      </div>

      <div className="hero__footer">
        <div className="hero__tabs" role="tablist" aria-label={controls.slides}>
          {slides.map((slide, index) => (
            <button
              aria-label={slide.eyebrow}
              aria-selected={index === activeIndex}
              className={`hero-tab ${index === activeIndex ? "is-active" : ""}`}
              key={slide.id}
              onClick={() => {
                goTo(index);
                setPaused(true);
              }}
              role="tab"
              type="button"
            >
              <span className="hero-tab__bar">
                <i style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
              </span>
              <span className="hero-tab__label">{slide.eyebrow}</span>
            </button>
          ))}
        </div>

        <div className="hero__controls">
          <button aria-label={controls.previous} className="hero__control" onClick={() => { previous(); setPaused(true); }} type="button">
            <ArrowLeftIcon />
          </button>
          <button aria-label={controls.next} className="hero__control" onClick={() => { next(); setPaused(true); }} type="button">
            <ArrowRightIcon />
          </button>
          <button
            aria-label={paused ? controls.play : controls.pause}
            aria-pressed={paused}
            className="hero__control hero__control--wide"
            onClick={() => setPaused((value) => !value)}
            type="button"
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
            <span>{paused ? controls.play : controls.pause}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
