import {
  afterEveryRender,
  afterNextRender,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  ViewChild,
} from '@angular/core';
import { interpolate } from 'flubber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Menu, X } from 'lucide';
import { createMorph, type Morph } from 'morphicons/dom';
import { Servicios } from './componentes/servicios/servicios';
import { Proceso } from './componentes/proceso/proceso';
import { Proyecto } from './componentes/proyecto/proyecto';
import { Cta } from './componentes/cta/cta';
import { Footer } from './componentes/footer/footer';

gsap.registerPlugin(ScrollTrigger);

/** Exact original N (stem + body) — never rewrite this for display. */
const PATH_N_STEM = 'M149 14.6259V200.626';
const PATH_N_BODY =
  'M149 200.626L5 14.6259V200.626L49.1194 145.626L149 200.626Z';
/** Exact original A. */
const PATH_A =
  'M83.1292 13.8506L11.1292 199.851L83.1292 144.312L155.129 199.851L83.1292 13.8506Z';

/** Stem collapses toward A's bottom-right during N→A. */
const PATH_STEM_HIDDEN = 'M155.129 199.851L155.129 199.851';

const VIEW_H = 215;

/**
 * Dev toggle for the welcome intro (A fill → N morph → ORTE → tagline).
 * `true`  → play animation and lock scroll until it finishes.
 * `false` → skip animation, show final logo, keep scroll free.
 */
const PLAY_WELCOME_INTRO = true;

type ViteHot = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  dispose: (cb: () => void) => void;
};

@Component({
  selector: 'app-layout',
  imports: [Servicios, Proceso, Proyecto, Cta, Footer],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  @ViewChild('hero', { static: true }) hero!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stage!: ElementRef<HTMLElement>;
  @ViewChild('logo', { static: true }) logo!: ElementRef<HTMLElement>;
  @ViewChild('presentacion', { static: true }) presentacion!: ElementRef<HTMLElement>;
  @ViewChild('header', { static: true }) header!: ElementRef<HTMLElement>;
  @ViewChild('headerLogo', { static: true }) headerLogo!: ElementRef<HTMLElement>;
  @ViewChild('headerNav', { static: true }) headerNav!: ElementRef<HTMLElement>;
  @ViewChild('overlay', { static: true }) overlay!: ElementRef<HTMLElement>;
  @ViewChild('menuToggle') menuToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('menuMorphPath') menuMorphPath?: ElementRef<SVGPathElement>;
  @ViewChild('morphStem') morphStem?: ElementRef<SVGPathElement>;
  @ViewChild('morphBody') morphBody?: ElementRef<SVGPathElement>;
  @ViewChild('orteRest') orteRest?: ElementRef<HTMLElement>;
  @ViewChild('orteTrack') orteTrack?: ElementRef<HTMLElement>;
  @ViewChild('wordmark') wordmark?: ElementRef<HTMLElement>;
  @ViewChild('letterN') letterN?: ElementRef<HTMLElement>;
  @ViewChild('tagline') tagline?: ElementRef<SVGElement>;
  @ViewChild('scrollHint') scrollHint?: ElementRef<HTMLElement>;

  /** Start on gray A when intro plays; otherwise final N. */
  morphStemD = PLAY_WELCOME_INTRO ? PATH_STEM_HIDDEN : PATH_N_STEM;
  morphBodyD = PLAY_WELCOME_INTRO ? PATH_A : PATH_N_BODY;
  morphStemOpacity = PLAY_WELCOME_INTRO ? 0 : 1;
  grayPathD = PLAY_WELCOME_INTRO ? PATH_A : PATH_N_BODY;
  grayOpacity = PLAY_WELCOME_INTRO ? 1 : 0;
  fillProgress = PLAY_WELCOME_INTRO ? 0 : 1;
  morphing = false;
  menuOpen = false;
  /** Section currently in the viewport — drives the orange strikethrough in the menu. */
  activeSectionId: 'servicios' | 'proceso' | 'proyectos' | 'contacto' = 'servicios';

  get fillY(): number {
    if (this.fillProgress <= 0) return VIEW_H + 40;
    // Pad upward so thick stroke isn't clipped mid-reveal
    return VIEW_H * (1 - this.fillProgress) - 24;
  }

  get fillHeight(): number {
    if (this.fillProgress <= 0) return 0;
    return VIEW_H * this.fillProgress + 48;
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private ctx?: gsap.Context;
  private morphTween?: gsap.core.Tween | gsap.core.Timeline;
  private scrollHintTween?: gsap.core.Tween | gsap.core.Timeline;
  private setupQueued = false;
  private boundHero: HTMLElement | null = null;
  private boundLogo: HTMLElement | null = null;
  private boundPresentacion: HTMLElement | null = null;
  private letterNDocked = false;
  private letterNSpacer?: HTMLElement;
  private letterNHome?: HTMLElement | null;
  private headerNavRevealed = false;
  private headerNavTween?: gsap.core.Tween;
  private menuMorph?: Morph;
  private menuTimeline?: gsap.core.Timeline;
  private menuCtx?: gsap.Context;
  private activeBarTween?: gsap.core.Tween;
  private sectionSpyTriggers: ScrollTrigger[] = [];
  private scrollLocked = false;
  private scrollHintVisible = false;
  private logoResizeObserver?: ResizeObserver;
  private readonly host = inject(ElementRef<HTMLElement>);
  /** Once true, HMR/setup always snaps to the finished welcome logo. */
  introDone = !PLAY_WELCOME_INTRO;

  private readonly preventScroll = (event: Event) => {
    event.preventDefault();
  };

  private readonly preventScrollKeys = (event: KeyboardEvent) => {
    const keys = new Set([
      'ArrowUp',
      'ArrowDown',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      ' ',
      'Spacebar',
    ]);
    if (keys.has(event.key)) event.preventDefault();
  };

  constructor() {
    afterNextRender(() => {
      // Drop leftover hashes so reload doesn't jump to a section
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, 0);
      }
      this.initCursor();
      this.bindHotReload();
      this.bindLogoResize();
      this.initMenuMorph();
      this.initMenuOverlay();
      this.bindSectionSpy();
      void this.boot().then(() => ScrollTrigger.refresh());
    });

    afterEveryRender(() => {
      const hero = this.hero?.nativeElement;
      const logo = this.logo?.nativeElement;
      const presentacion = this.presentacion?.nativeElement;
      if (!hero || !logo || !presentacion) return;

      if (
        hero !== this.boundHero ||
        logo !== this.boundLogo ||
        presentacion !== this.boundPresentacion
      ) {
        this.queueSetup();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.morphTween?.kill();
      this.scrollHintTween?.kill();
      this.menuMorph?.destroy();
      this.menuMorph = undefined;
      this.menuTimeline?.kill();
      this.menuTimeline = undefined;
      this.menuCtx?.revert();
      this.menuCtx = undefined;
      this.activeBarTween?.kill();
      this.activeBarTween = undefined;
      this.killSectionSpy();
      document.body.style.overflow = '';
      this.logoResizeObserver?.disconnect();
      this.logoResizeObserver = undefined;
      this.unlockScroll();
      this.teardown();
    });
  }

  toggleMenu(): void {
    if (!this.menuTimeline) return;

    if (this.menuOpen) {
      this.animateActiveBar(0);
      this.menuTimeline.timeScale(1.35).reverse();
      document.body.style.overflow = '';
    } else {
      this.syncActiveSectionFromScroll();
      this.overlay?.nativeElement.classList.add('is-open');
      this.resetAllStrikes();
      this.menuTimeline.timeScale(1).play();
      this.animateActiveBar(1, 0.35);
      document.body.style.overflow = 'hidden';
    }

    this.menuOpen = !this.menuOpen;
    this.menuMorph?.morphTo(this.menuOpen ? X : Menu, 'snappy');
  }

  private initCursor(): void {
    const root = this.host.nativeElement as HTMLElement;
    const dot = root.querySelector('.cursor-dot') as HTMLElement | null;
    if (!dot) return;

    // Touch / coarse pointers: no custom cursor
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      dot.remove();
      return;
    }

    // Fuera del host para que mix-blend-mode haga difference con toda la página
    document.body.appendChild(dot);

    let visible = false;
    let showRaf = 0;

    const show = () => {
      if (visible) return;
      visible = true;
      // Posición primero, scale después → la transición no arranca desde (0,0)
      cancelAnimationFrame(showRaf);
      showRaf = requestAnimationFrame(() => {
        dot.classList.add('is-active');
      });
    };

    const hide = () => {
      if (!visible) return;
      visible = false;
      cancelAnimationFrame(showRaf);
      dot.classList.remove('is-active');
    };

    const isOverHero = (x: number, y: number): boolean => {
      const hero = this.hero?.nativeElement;
      if (!hero) return false;
      const r = hero.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;

      if (isOverHero(e.clientX, e.clientY)) hide();
      else show();
    };

    const onDocLeave = (e: MouseEvent) => {
      // Solo cuando el puntero sale de la ventana (relatedTarget null)
      if (e.relatedTarget == null) hide();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onDocLeave);
    window.addEventListener('blur', hide);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(showRaf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onDocLeave);
      window.removeEventListener('blur', hide);
      dot.remove();
    });
  }

  private initMenuMorph(): void {
    const path = this.menuMorphPath?.nativeElement;
    if (!path) return;
    this.menuMorph?.destroy();
    this.menuMorph = createMorph(path, Menu);
    this.menuMorph.set(Menu);
    this.menuOpen = false;
  }

  private initMenuOverlay(): void {
    const overlay = this.overlay?.nativeElement;
    const header = this.header?.nativeElement;
    if (!overlay) return;

    this.menuTimeline?.kill();
    this.menuCtx?.revert();

    const brand = header?.querySelector('.header__brand') as HTMLElement | null;

    this.menuCtx = gsap.context(() => {
      gsap.set('.menu-item p', { y: 120 });
      gsap.set('.menu-strike', {
        scaleX: 0,
        yPercent: -50,
        transformOrigin: 'left center',
      });
      gsap.set('.sub-nav', { bottom: '5%', opacity: 0 });
      if (brand) gsap.set(brand, { opacity: 0 });
      gsap.set(overlay, {
        clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)',
      });

      const timeline = gsap.timeline({
        paused: true,
        onReverseComplete: () => {
          overlay.classList.remove('is-open');
        },
      });

      timeline.to(
        overlay,
        {
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
          duration: 0.55,
          ease: 'power4.inOut',
        },
        0,
      );

      timeline.to(
        '.menu-item p',
        {
          y: 0,
          duration: 0.55,
          stagger: 0.05,
          ease: 'power4.out',
        },
        '-=0.35',
      );

      if (brand) {
        timeline.to(
          brand,
          {
            opacity: 1,
            duration: 0.35,
            delay: 0.05,
          },
          '<',
        );
      }

      timeline.to(
        '.sub-nav',
        {
          bottom: '10%',
          opacity: 1,
          duration: 0.25,
          delay: 0.1,
        },
        '<',
      );

      this.menuTimeline = timeline;
    }, overlay);
  }

  private killSectionSpy(): void {
    this.sectionSpyTriggers.forEach((st) => st.kill());
    this.sectionSpyTriggers = [];
  }

  private readonly menuSectionIds = [
    'servicios',
    'proceso',
    'proyectos',
    'contacto',
  ] as const;

  /** Keep the orange strikethrough on the menu title for the section in view. */
  private bindSectionSpy(): void {
    this.killSectionSpy();

    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: () => this.syncActiveSectionFromScroll(),
      onRefresh: () => this.syncActiveSectionFromScroll(),
    });
    this.sectionSpyTriggers.push(st);
    this.syncActiveSectionFromScroll();
  }

  /**
   * Pick the last section whose top has crossed ~35% of the viewport.
   * Works scrolling up and down, including when returning to the hero.
   */
  private syncActiveSectionFromScroll(): void {
    const probe = window.innerHeight * 0.35;
    let current: (typeof this.menuSectionIds)[number] = this.menuSectionIds[0];

    for (const id of this.menuSectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= probe) {
        current = id;
      }
    }

    if (this.menuOpen) {
      this.transitionActiveSection(current);
    } else {
      this.setActiveSection(current);
    }
  }

  private setActiveSection(
    id: 'servicios' | 'proceso' | 'proyectos' | 'contacto',
  ): void {
    if (this.activeSectionId === id) return;
    this.activeSectionId = id;
    // Sync DOM so p#active / .menu-strike queries match the viewport section
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private getActiveStrike(): HTMLElement | null {
    return (
      this.overlay?.nativeElement.querySelector('p#active .menu-strike') ?? null
    );
  }

  /** Force every fringe closed — only one title may be struck at a time. */
  private resetAllStrikes(): void {
    const strikes =
      this.overlay?.nativeElement.querySelectorAll('.menu-strike');
    if (!strikes?.length) return;
    gsap.set(strikes, {
      scaleX: 0,
      yPercent: -50,
      transformOrigin: 'left center',
    });
  }

  /** Grow (1) or shrink (0) the strike on the current #active title only. */
  private animateActiveBar(to: 0 | 1, delay = 0, onComplete?: () => void): void {
    this.activeBarTween?.kill();

    if (to === 0) {
      const el = this.getActiveStrike();
      if (!el) {
        this.resetAllStrikes();
        onComplete?.();
        return;
      }
      this.activeBarTween = gsap.to(el, {
        scaleX: 0,
        yPercent: -50,
        transformOrigin: 'left center',
        duration: 0.45,
        delay,
        ease: 'power4.out',
        overwrite: true,
        onComplete: () => {
          this.resetAllStrikes();
          onComplete?.();
        },
      });
      return;
    }

    // Grow: clear every fringe first, then wipe only the active one
    this.resetAllStrikes();
    const el = this.getActiveStrike();
    if (!el) {
      onComplete?.();
      return;
    }
    this.activeBarTween = gsap.fromTo(
      el,
      { scaleX: 0, yPercent: -50, transformOrigin: 'left center' },
      {
        scaleX: 1,
        yPercent: -50,
        transformOrigin: 'left center',
        duration: 0.5,
        delay,
        ease: 'power4.out',
        overwrite: true,
        onComplete: () => onComplete?.(),
      },
    );
  }

  /**
   * Move the strike to the viewport section (shrink old → clear all → grow new).
   * Always leaves exactly one fringe open when the menu is open.
   */
  private transitionActiveSection(
    id: 'servicios' | 'proceso' | 'proyectos' | 'contacto',
    onDone?: () => void,
  ): void {
    if (this.activeSectionId === id) {
      onDone?.();
      return;
    }

    if (!this.menuOpen) {
      this.setActiveSection(id);
      onDone?.();
      return;
    }

    this.activeBarTween?.kill();
    const prev = this.getActiveStrike();

    const showNew = () => {
      this.setActiveSection(id);
      this.resetAllStrikes();
      this.animateActiveBar(1, 0, onDone);
    };

    if (prev && Number(gsap.getProperty(prev, 'scaleX')) > 0.02) {
      this.activeBarTween = gsap.to(prev, {
        scaleX: 0,
        yPercent: -50,
        transformOrigin: 'left center',
        duration: 0.3,
        ease: 'power4.out',
        overwrite: true,
        onComplete: showNew,
      });
    } else {
      showNew();
    }
  }

  /** Close overlay and scroll to a section without leaving a hash in the URL. */
  onMenuNavigate(event: Event, sectionId: string): void {
    event.preventDefault();

    // Close first so animateActiveBar(0) still targets the current fringe
    if (this.menuOpen) this.toggleMenu();

    if (
      sectionId === 'servicios' ||
      sectionId === 'proceso' ||
      sectionId === 'proyectos' ||
      sectionId === 'contacto'
    ) {
      this.setActiveSection(sectionId);
    }

    const target = document.getElementById(sectionId);
    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  scrollPastHero(): void {
    const hero = this.hero?.nativeElement;
    if (!hero) return;
    const target = Math.min(
      window.scrollY + window.innerHeight * 0.55,
      hero.offsetTop + hero.offsetHeight - window.innerHeight,
    );
    window.scrollTo({ top: Math.max(target, 1), behavior: 'smooth' });
  }

  private showScrollHint(): void {
    const hint = this.scrollHint?.nativeElement;
    if (!hint || this.scrollHintVisible) return;

    this.scrollHintTween?.kill();
    this.scrollHintVisible = true;
    hint.classList.add('is-visible');

    gsap.set(hint, { xPercent: -50 });

    const bob = gsap.timeline({ repeat: -1, yoyo: true });
    bob.to(hint, {
      y: 10,
      duration: 0.9,
      ease: 'sine.inOut',
    });

    this.scrollHintTween = gsap
      .timeline()
      .fromTo(
        hint,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: 'power2.out',
        },
      )
      .add(bob, '-=0.1');
  }

  private hideScrollHint(immediate = false): void {
    const hint = this.scrollHint?.nativeElement;
    if (!hint || (!this.scrollHintVisible && !immediate)) return;

    this.scrollHintTween?.kill();
    this.scrollHintTween = undefined;
    this.scrollHintVisible = false;
    hint.classList.remove('is-visible');

    if (immediate) {
      gsap.set(hint, { autoAlpha: 0, y: 18, xPercent: -50 });
      return;
    }

    this.scrollHintTween = gsap.to(hint, {
      autoAlpha: 0,
      y: 12,
      duration: 0.35,
      ease: 'power2.in',
      xPercent: -50,
    });
  }

  private async boot(): Promise<void> {
    await this.whenLogoFontsReady();
    // Hide ORTE before any layout/setup so it never flashes open
    const orteEl = this.orteRest?.nativeElement;
    if (PLAY_WELCOME_INTRO && orteEl && !this.introDone) {
      gsap.set(orteEl, { clipPath: 'inset(0 100% 0 0)' });
    }
    this.setup();
    await this.runIntro();
    ScrollTrigger.refresh();
  }

  private async runIntro(): Promise<void> {
    if (this.morphing) return;

    if (!PLAY_WELCOME_INTRO || this.introDone) {
      this.introDone = true;
      this.applyFinalIntroState();
      return;
    }

    this.runFillThenMorph();
  }

  /** Kodchasan must be loaded before measuring ORTE width (GSAP freezes px otherwise). */
  private async whenLogoFontsReady(): Promise<void> {
    const fonts = document.fonts;
    if (!fonts?.load) return;
    try {
      await Promise.all([
        fonts.load('200 1em Kodchasan'),
        fonts.load('300 1em Kodchasan'),
      ]);
      await fonts.ready;
    } catch {
      // Proceed with fallback metrics if the network font fails.
    }
  }

  private lockScroll(): void {
    if (this.scrollLocked) return;
    this.scrollLocked = true;
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('wheel', this.preventScroll, { passive: false });
    window.addEventListener('touchmove', this.preventScroll, { passive: false });
    window.addEventListener('keydown', this.preventScrollKeys, { passive: false });
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    window.removeEventListener('wheel', this.preventScroll);
    window.removeEventListener('touchmove', this.preventScroll);
    window.removeEventListener('keydown', this.preventScrollKeys);
  }

  /** Jump to post-intro logo (N + ORTE + tagline) without animating. */
  private applyFinalIntroState(): void {
    const stemEl = this.morphStem?.nativeElement;
    const bodyEl = this.morphBody?.nativeElement;
    const orteEl = this.orteRest?.nativeElement;
    const taglineEl = this.tagline?.nativeElement;
    const wordmarkEl = this.wordmark?.nativeElement;
    if (!stemEl || !bodyEl || !orteEl || !taglineEl || !wordmarkEl) return;

    this.morphTween?.kill();
    this.morphTween = undefined;
    this.morphing = false;
    this.unlockScroll();

    stemEl.setAttribute('d', PATH_N_STEM);
    stemEl.setAttribute('opacity', '1');
    bodyEl.setAttribute('d', PATH_N_BODY);

    this.morphStemD = PATH_N_STEM;
    this.morphBodyD = PATH_N_BODY;
    this.morphStemOpacity = 1;
    this.grayPathD = PATH_N_BODY;
    this.grayOpacity = 0;
    this.fillProgress = 1;
    this.introDone = true;

    gsap.set(wordmarkEl, { x: 0, force3D: false });
    gsap.set(taglineEl, { autoAlpha: 1, force3D: false });
    this.syncOrteSizes(orteEl);

    if (window.scrollY <= 8) this.showScrollHint();
    else this.hideScrollHint(true);
  }

  /** Keep ORTE fully revealed (clip open). Layout width stays max-content. */
  private syncOrteSizes(orteEl = this.orteRest?.nativeElement): void {
    if (!orteEl) return;
    gsap.set(orteEl, { clipPath: 'inset(0 0% 0 0)' });
  }

  private bindLogoResize(): void {
    const logo = this.logo?.nativeElement;
    if (!logo || this.logoResizeObserver) return;

    this.logoResizeObserver = new ResizeObserver(() => {
      if (!this.introDone || this.morphing) return;
      this.syncOrteSizes();
    });
    this.logoResizeObserver.observe(logo);
  }

  /** Shift wordmark so the A/N column sits on the logo (and stage) center. */
  private measureLetterCenterOffset(): number {
    const logo = this.logo?.nativeElement;
    const letterN = this.letterN?.nativeElement;
    const wordmark = this.wordmark?.nativeElement;
    if (!logo || !letterN || !wordmark) return 0;

    const logoCenter = logo.offsetWidth / 2;
    const letterCenter = wordmark.offsetLeft + letterN.offsetLeft + letterN.offsetWidth / 2;
    return logoCenter - letterCenter;
  }

  private runFillThenMorph(): void {
    const stemEl = this.morphStem?.nativeElement;
    const bodyEl = this.morphBody?.nativeElement;
    const orteEl = this.orteRest?.nativeElement;
    const taglineEl = this.tagline?.nativeElement;
    const wordmarkEl = this.wordmark?.nativeElement;
    if (!stemEl || !bodyEl || !orteEl || !taglineEl || !wordmarkEl) return;

    this.lockScroll();
    this.morphing = true;
    this.morphTween?.kill();

    bodyEl.setAttribute('d', PATH_A);
    stemEl.setAttribute('d', PATH_STEM_HIDDEN);
    stemEl.setAttribute('opacity', '0');
    this.morphBodyD = PATH_A;
    this.morphStemD = PATH_STEM_HIDDEN;
    this.morphStemOpacity = 0;
    this.grayPathD = PATH_A;
    this.grayOpacity = 1;
    this.fillProgress = 0;

    const centerOffset = this.measureLetterCenterOffset();
    gsap.killTweensOf(orteEl);
    gsap.set(orteEl, { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(wordmarkEl, { x: centerOffset, force3D: false });
    gsap.set(taglineEl, { autoAlpha: 0, force3D: false });

    const fillState = { p: 0 };
    const morphState = { t: 0 };
    const bodyInterp = interpolate(PATH_A, PATH_N_BODY, { maxSegmentLength: 4 });
    const stemInterp = interpolate(PATH_STEM_HIDDEN, PATH_N_STEM, { maxSegmentLength: 4 });

    const tl = gsap.timeline({
      onComplete: () => {
        bodyEl.setAttribute('d', PATH_N_BODY);
        stemEl.setAttribute('d', PATH_N_STEM);
        stemEl.setAttribute('opacity', '1');
        gsap.set(wordmarkEl, { x: 0, force3D: false });
        gsap.set(taglineEl, { autoAlpha: 1, force3D: false });

        // Mark settled BEFORE syncing so CSS never snaps clip closed
        this.ngZone.run(() => {
          this.morphBodyD = PATH_N_BODY;
          this.morphStemD = PATH_N_STEM;
          this.morphStemOpacity = 1;
          this.grayOpacity = 0;
          this.fillProgress = 1;
          this.morphing = false;
          this.introDone = true;
        });
        this.syncOrteSizes(orteEl);

        this.unlockScroll();
        this.showScrollHint();
        ScrollTrigger.refresh();
      },
    });

    tl.to(fillState, {
      p: 1,
      duration: .6,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.ngZone.run(() => {
          this.fillProgress = fillState.p;
        });
      },
      onComplete: () => {
        this.ngZone.run(() => {
          this.fillProgress = 1;
          this.grayOpacity = 0;
        });
      },
    });

    tl.to(
      morphState,
      {
        t: 1,
        duration: .6,
        ease: 'power2.inOut',
        onUpdate: () => {
          const bodyD = bodyInterp(morphState.t);
          const stemD = stemInterp(morphState.t);
          const stemOpacity = morphState.t;

          bodyEl.setAttribute('d', bodyD);
          stemEl.setAttribute('d', stemD);
          stemEl.setAttribute('opacity', String(stemOpacity));

          this.morphBodyD = bodyD;
          this.morphStemD = stemD;
          this.morphStemOpacity = stemOpacity;
          this.grayPathD = bodyD;
        },
      },
      '+=0',
    );

    // ORTE wipe (clip-path) — no width reflow, letters stay put
    tl.to(
      orteEl,
      {
        clipPath: 'inset(0 0% 0 0)',
        duration: .6,
        ease: 'power2.inOut',
      },
      '+=0',
    );
    tl.to(
      wordmarkEl,
      {
        x: 0,
        duration: .6,
        ease: 'power2.inOut',
        force3D: false,
      },
      '<',
    );

    tl.to(
      taglineEl,
      {
        autoAlpha: 1,
        duration: 0.8,
        ease: 'power2.out',
        force3D: false,
      },
      '+=0.05',
    );

    this.morphTween = tl;
  }

  private bindHotReload(): void {
    const hot = (import.meta as ImportMeta & { hot?: ViteHot }).hot;
    if (!hot) return;

    const resync = () => {
      this.queueSetup();
    };
    hot.on('angular:component-update', resync);
    hot.on('vite:afterUpdate', resync);
    hot.dispose(() => this.teardown());
  }

  private queueSetup(): void {
    if (this.setupQueued) return;
    this.setupQueued = true;
    queueMicrotask(() => {
      this.setupQueued = false;
      this.setup();
      // After HMR, always settle welcome visuals if intro is off or already finished
      if (!PLAY_WELCOME_INTRO || this.introDone) {
        this.applyFinalIntroState();
      }
    });
  }

  private teardown(): void {
    this.morphTween?.kill();
    this.morphTween = undefined;
    this.morphing = false;
    this.scrollHintTween?.kill();
    this.scrollHintTween = undefined;
    this.scrollHintVisible = false;
    this.headerNavTween?.kill();
    this.headerNavTween = undefined;
    this.headerNavRevealed = false;

    const letterN = this.letterN?.nativeElement;
    if (letterN && this.letterNDocked) {
      this.releaseLetterDock(letterN);
    } else {
      this.letterNSpacer?.remove();
      this.letterNSpacer = undefined;
      this.letterNHome = undefined;
      this.letterNDocked = false;
    }

    this.ctx?.revert();
    this.ctx = undefined;

    const logo = this.logo?.nativeElement;
    const presentacion = this.presentacion?.nativeElement;
    const hero = this.hero?.nativeElement;
    const wordmark = this.wordmark?.nativeElement;
    const orteEl = this.orteRest?.nativeElement;
    const taglineEl = this.tagline?.nativeElement;
    const hint = this.scrollHint?.nativeElement;
    const headerNav = this.headerNav?.nativeElement;

    if (logo) gsap.killTweensOf(logo);
    if (presentacion) gsap.killTweensOf(presentacion);
    if (wordmark) gsap.killTweensOf(wordmark);
    if (orteEl) gsap.killTweensOf(orteEl);
    if (taglineEl) gsap.killTweensOf(taglineEl);
    if (hint) gsap.killTweensOf(hint);
    if (letterN) gsap.killTweensOf(letterN);
    if (headerNav) {
      gsap.killTweensOf(headerNav);
      gsap.set(headerNav, { autoAlpha: 0 });
    }

    ScrollTrigger.getAll().forEach((st) => {
      if (
        st.trigger === hero ||
        st.trigger === this.boundHero ||
        st.trigger === logo ||
        st.trigger === this.boundLogo ||
        st.vars.id === 'logo-n-dock'
      ) {
        st.kill();
      }
    });

    if (logo) gsap.set(logo, { clearProps: 'transform' });
    if (presentacion) gsap.set(presentacion, { clearProps: 'all' });
    if (letterN) {
      letterN.classList.remove('is-docked');
      gsap.set(letterN, {
        clearProps: 'position,left,top,width,height,zIndex,margin,transform,transformOrigin',
      });
    }
    if (orteEl) {
      gsap.set(orteEl, {
        clipPath:
          this.introDone || !PLAY_WELCOME_INTRO ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
        clearProps: 'opacity,visibility',
      });
    }
    // Tagline / wordmark inline styles are reapplied in applyFinalIntroState

    this.boundHero = null;
    this.boundLogo = null;
    this.boundPresentacion = null;
  }

  /**
   * Logo is laid out at hero size. Start = scale 1 centered.
   * End = scale down into the left column (scaling down stays sharp).
   */
  private measureLogoStart(stage: HTMLElement, logo: HTMLElement): { x: number; scale: number } {
    const slot = logo.parentElement!;
    const stageRect = stage.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const stageCenter = stageRect.left + stageRect.width / 2;
    const logoCenter = slotRect.left + slotRect.width / 2;

    return {
      x: stageCenter - logoCenter,
      scale: 1,
    };
  }

  private measureLogoEnd(stage: HTMLElement, logo: HTMLElement): { x: number; scale: number } {
    const stageRect = stage.getBoundingClientRect();
    const gap =
      parseFloat(getComputedStyle(stage).columnGap || getComputedStyle(stage).gap) || 0;
    const colWidth = (stageRect.width - gap) / 2;
    const logoWidth = logo.offsetWidth || 1;
    // Fill the left column so logo + copy share the stage evenly
    const scale = Math.min(1, (colWidth * 0.98) / logoWidth);

    return { x: 0, scale };
  }

  /**
   * Lift the same N into document.body as position:fixed (pixel-matched),
   * so it isn't clipped by .hero__stage overflow or trapped by the logo's transform.
   * Leaves a ghost clone (black @ 0.2) in the wordmark so ORTE/tagline keep their seat.
   */
  private armLetterDock(letterN: HTMLElement): void {
    if (this.letterNDocked) return;

    const rect = letterN.getBoundingClientRect();
    this.letterNHome = letterN.parentElement;

    if (!this.letterNSpacer) {
      const ghost = letterN.cloneNode(true) as HTMLElement;
      ghost.classList.add('logo__n-ghost');
      ghost.removeAttribute('id');
      ghost.setAttribute('aria-hidden', 'true');

      // Avoid duplicate SVG clipPath ids with the flying original
      ghost.querySelectorAll('clipPath[id]').forEach((el, i) => {
        const prev = el.id;
        const next = `${prev}-ghost-${i}`;
        el.id = next;
        ghost
          .querySelectorAll(`[clip-path="url(#${prev})"]`)
          .forEach((g) => g.setAttribute('clip-path', `url(#${next})`));
      });

      ghost.querySelectorAll('path').forEach((path) => {
        path.setAttribute('stroke', '#000');
        path.removeAttribute('opacity');
      });

      this.letterNHome?.insertBefore(ghost, letterN);
      this.letterNSpacer = ghost;
    }

    // Reparent out of transformed/overflow ancestors BEFORE fixed — no jump
    document.body.appendChild(letterN);
    letterN.classList.add('is-docked');
    gsap.set(letterN, {
      position: 'fixed',
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      x: 0,
      y: 0,
      scale: 1,
      zIndex: 50,
      margin: 0,
      transformOrigin: 'center center',
    });
    this.letterNDocked = true;
  }

  private releaseLetterDock(letterN: HTMLElement): void {
    const home = this.letterNHome;
    const spacer = this.letterNSpacer;

    letterN.classList.remove('is-docked');
    gsap.set(letterN, {
      clearProps: 'position,left,top,width,height,zIndex,margin,transform,transformOrigin',
    });

    if (home) {
      if (spacer && spacer.parentElement === home) {
        home.insertBefore(letterN, spacer);
      } else {
        home.appendChild(letterN);
      }
    }

    spacer?.remove();
    this.letterNSpacer = undefined;
    this.letterNHome = undefined;
    this.letterNDocked = false;
  }

  private revealHeaderNav(headerNav: HTMLElement | undefined, show: boolean): void {
    if (!headerNav) return;
    if (show === this.headerNavRevealed) return;
    this.headerNavRevealed = show;
    this.headerNavTween?.kill();
    this.headerNavTween = gsap.to(headerNav, {
      autoAlpha: show ? 1 : 0,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: true,
    });
  }

  /** Scrub the fixed N from the live ghost seat to the header mark. */
  private applyLetterDock(
    letterN: HTMLElement,
    headerLogo: HTMLElement,
    progress: number,
    headerNav?: HTMLElement,
  ): void {
    const p = gsap.utils.clamp(0, 1, progress);

    if (p <= 0) {
      if (this.letterNDocked) this.releaseLetterDock(letterN);
      this.revealHeaderNav(headerNav, false);
      return;
    }

    this.armLetterDock(letterN);

    // Live ghost rect — tracks ORTE as the section scrolls so the N never lags downward
    const ghost = this.letterNSpacer;
    if (!ghost) return;
    const from = ghost.getBoundingClientRect();
    const to = headerLogo.getBoundingClientRect();
    const t = gsap.parseEase('power2.inOut')(p);

    // Quadratic bezier: up first (control keeps start X at header Y), then sideways
    const cpX = from.left;
    const cpY = to.top;
    const inv = 1 - t;

    const left = inv * inv * from.left + 2 * inv * t * cpX + t * t * to.left;
    const top = inv * inv * from.top + 2 * inv * t * cpY + t * t * to.top;

    gsap.set(letterN, {
      left,
      top,
      width: from.width + (to.width - from.width) * t,
      height: from.height + (to.height - from.height) * t,
    });

    // Timed reveal (0.3s), not scrubbed — fires once the N has arrived
    this.revealHeaderNav(headerNav, p >= 0.98);
  }

  private setup(): void {
    // Don't tear down / rebuild scroll while the welcome morph is running
    if (this.morphing) return;

    const hero = this.hero?.nativeElement;
    const stage = this.stage?.nativeElement;
    const logo = this.logo?.nativeElement;
    const presentacion = this.presentacion?.nativeElement;
    const headerLogo = this.headerLogo?.nativeElement;
    const headerNav = this.headerNav?.nativeElement;
    const letterN = this.letterN?.nativeElement;
    if (!hero || !stage || !logo || !presentacion || !headerLogo || !letterN) return;

    this.teardown();

    this.boundHero = hero;
    this.boundLogo = logo;
    this.boundPresentacion = presentacion;

    const scrollY = window.scrollY;
    const start = this.measureLogoStart(stage, logo);

    this.ctx = gsap.context(() => {
      gsap.set(logo, {
        x: start.x,
        scale: start.scale,
        force3D: false,
        transformOrigin: 'right center',
      });

      gsap.set(presentacion, {
        autoAlpha: 0,
        x: 0,
      });

      if (headerNav) gsap.set(headerNav, { autoAlpha: 0 });

      // Original hero flow only — logo + presentación (entrada / salida / reversa)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          markers: false,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.progress > 0.02) {
              this.hideScrollHint();
            } else if (this.introDone) {
              this.showScrollHint();
            }
          },
        },
      });

      tl.fromTo(
        logo,
        {
          x: () => this.measureLogoStart(stage, logo).x,
          scale: () => this.measureLogoStart(stage, logo).scale,
        },
        {
          x: () => this.measureLogoEnd(stage, logo).x,
          scale: () => this.measureLogoEnd(stage, logo).scale,
          ease: 'none',
          duration: 1,
          force3D: false,
          transformOrigin: 'right center',
          immediateRender: false,
        },
        0,
      );

      // Presentación: timed 0.3s (not scrubbed), at the same scroll point as before (~0.95)
      ScrollTrigger.create({
        id: 'presentacion-reveal',
        trigger: hero,
        start: () => {
          const dist = Math.max(0, hero.offsetHeight - window.innerHeight);
          return `top+=${dist * 0.95} top`;
        },
        invalidateOnRefresh: true,
        onEnter: () => {
          gsap.to(presentacion, {
            autoAlpha: 1,
            x: 0,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        },
        onLeaveBack: () => {
          gsap.to(presentacion, {
            autoAlpha: 0,
            x: 0,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        },
      });

      // Dock N → header: after presentación is fully shown, with hold,
      // then a short scrub so it settles in the header without needing much scroll.
      ScrollTrigger.create({
        id: 'logo-n-dock',
        trigger: hero,
        start: 'bottom 80%',
        end: '+=160',
        scrub: 0.45,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          this.applyLetterDock(letterN, headerLogo, self.progress, headerNav);
        },
        onLeave: () => {
          this.applyLetterDock(letterN, headerLogo, 1, headerNav);
        },
        onLeaveBack: () => {
          this.applyLetterDock(letterN, headerLogo, 0, headerNav);
        },
        onRefresh: (self) => {
          if (self.progress <= 0) {
            this.applyLetterDock(letterN, headerLogo, 0, headerNav);
            return;
          }
          if (this.letterNDocked) this.releaseLetterDock(letterN);
          this.applyLetterDock(letterN, headerLogo, self.progress, headerNav);
        },
      });
    }, hero);

    ScrollTrigger.refresh();
    if (window.scrollY !== scrollY) {
      window.scrollTo(0, scrollY);
    }

    if (!PLAY_WELCOME_INTRO || this.introDone) {
      this.applyFinalIntroState();
    }
  }
}
