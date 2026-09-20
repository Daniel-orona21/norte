import {
  afterEveryRender,
  afterNextRender,
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
  private ctx?: gsap.Context;
  private morphTween?: gsap.core.Tween | gsap.core.Timeline;
  private scrollHintTween?: gsap.core.Tween | gsap.core.Timeline;
  private setupQueued = false;
  private boundHero: HTMLElement | null = null;
  private boundLogo: HTMLElement | null = null;
  private boundPresentacion: HTMLElement | null = null;
  private scrollLocked = false;
  private scrollHintVisible = false;
  private logoResizeObserver?: ResizeObserver;
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
      this.bindHotReload();
      this.bindLogoResize();
      void this.boot();
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
      this.logoResizeObserver?.disconnect();
      this.logoResizeObserver = undefined;
      this.unlockScroll();
      this.teardown();
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

    this.ctx?.revert();
    this.ctx = undefined;

    const logo = this.logo?.nativeElement;
    const presentacion = this.presentacion?.nativeElement;
    const hero = this.hero?.nativeElement;
    const wordmark = this.wordmark?.nativeElement;
    const orteEl = this.orteRest?.nativeElement;
    const taglineEl = this.tagline?.nativeElement;
    const hint = this.scrollHint?.nativeElement;

    if (logo) gsap.killTweensOf(logo);
    if (presentacion) gsap.killTweensOf(presentacion);
    if (wordmark) gsap.killTweensOf(wordmark);
    if (orteEl) gsap.killTweensOf(orteEl);
    if (taglineEl) gsap.killTweensOf(taglineEl);
    if (hint) gsap.killTweensOf(hint);

    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === hero || st.trigger === this.boundHero) {
        st.kill();
      }
    });

    if (logo) gsap.set(logo, { clearProps: 'transform' });
    if (presentacion) gsap.set(presentacion, { clearProps: 'all' });
    if (orteEl) {
      gsap.set(orteEl, {
        clipPath:
          this.introDone || !PLAY_WELCOME_INTRO ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
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

  private setup(): void {
    // Don't tear down / rebuild scroll while the welcome morph is running
    if (this.morphing) return;

    const hero = this.hero?.nativeElement;
    const stage = this.stage?.nativeElement;
    const logo = this.logo?.nativeElement;
    const presentacion = this.presentacion?.nativeElement;
    if (!hero || !stage || !logo || !presentacion) return;

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

      tl.to(
        presentacion,
        {
          autoAlpha: 1,
          x: 0,
          ease: 'power2.out',
          duration: 0.35,
        },
        0.95,
      );
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
