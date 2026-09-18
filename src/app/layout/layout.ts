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
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Exact original N (stem + body) — never rewrite this for display. */
const PATH_N_STEM = 'M195.043 17.7835V246.799';
const PATH_N_BODY =
  'M195.043 246.799L7.5 20.7835V238.553L64.9603 179.079L195.043 246.799Z';
/** Exact original A. */
const PATH_A =
  'M100.447 21.7786L16.447 250.779L100.447 182.4L184.447 250.779L100.447 21.7786Z';

/** Stem collapses toward A's bottom-right during N→A. */
const PATH_STEM_HIDDEN = 'M184.447 250.779L184.447 250.779';

const VIEW_H = 274;

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
  imports: [],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  @ViewChild('hero', { static: true }) hero!: ElementRef<HTMLElement>;
  @ViewChild('stage', { static: true }) stage!: ElementRef<HTMLElement>;
  @ViewChild('logo', { static: true }) logo!: ElementRef<HTMLElement>;
  @ViewChild('mexicoMap', { static: true }) mexicoMap!: ElementRef<HTMLElement>;
  @ViewChild('mexicoMapCanvas', { static: true }) mexicoMapCanvas!: ElementRef<HTMLElement>;
  @ViewChild('morphStem') morphStem?: ElementRef<SVGPathElement>;
  @ViewChild('morphBody') morphBody?: ElementRef<SVGPathElement>;
  @ViewChild('orteRest') orteRest?: ElementRef<HTMLElement>;
  @ViewChild('orteTrack') orteTrack?: ElementRef<HTMLElement>;
  @ViewChild('wordmark') wordmark?: ElementRef<HTMLElement>;
  @ViewChild('letterN') letterN?: ElementRef<HTMLElement>;
  @ViewChild('tagline') tagline?: ElementRef<SVGElement>;
  @ViewChild('scrollHint') scrollHint?: ElementRef<HTMLElement>;
  @ViewChild('durangoCopy', { static: true }) durangoCopy!: ElementRef<HTMLElement>;
  @ViewChild('durangoCopyText', { static: true }) durangoCopyText!: ElementRef<HTMLElement>;

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
  private splitTexts: SplitText[] = [];
  private setupQueued = false;
  private boundHero: HTMLElement | null = null;
  private boundLogo: HTMLElement | null = null;
  private boundMexicoMap: HTMLElement | null = null;
  private mexicoPaths: SVGPathElement[] = [];
  private mexicoSvgReady = false;
  private mexicoSvgLoading?: Promise<void>;
  private scrollLocked = false;
  private scrollHintVisible = false;
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
      // Position logo immediately, start intro, then attach Mexico scroll when SVG is ready.
      this.setup({ requireMap: false });
      this.runIntro();
      void this.ensureMexicoSvg().then(() => this.setup({ requireMap: true }));
    });

    afterEveryRender(() => {
      const hero = this.hero?.nativeElement;
      const logo = this.logo?.nativeElement;
      const mexicoMap = this.mexicoMap?.nativeElement;
      if (!hero || !logo || !mexicoMap) return;

      if (
        hero !== this.boundHero ||
        logo !== this.boundLogo ||
        mexicoMap !== this.boundMexicoMap
      ) {
        this.queueSetup();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.morphTween?.kill();
      this.scrollHintTween?.kill();
      this.unlockScroll();
      this.teardown({ killIntro: true });
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

  private runIntro(): void {
    if (this.morphing) return;

    if (!PLAY_WELCOME_INTRO || this.introDone) {
      this.introDone = true;
      this.applyFinalIntroState();
      return;
    }

    this.runFillThenMorph();
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
    const orteSvg = orteEl?.querySelector('svg') as SVGElement | null;
    if (!stemEl || !bodyEl || !orteEl || !taglineEl || !wordmarkEl) return;

    this.morphTween?.kill();
    this.morphTween = undefined;
    this.morphing = false;
    this.unlockScroll();

    const orteWidth = this.measureOrteWidth();
    if (orteSvg) orteSvg.style.width = `${orteWidth}px`;

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

    gsap.set(orteEl, { width: orteWidth });
    gsap.set(wordmarkEl, { x: 0 });
    gsap.set(taglineEl, { autoAlpha: 1, scale: .5 });

    if (window.scrollY <= 8) this.showScrollHint();
    else this.hideScrollHint(true);
  }

  private measureOrteWidth(): number {
    const track = this.orteTrack?.nativeElement;
    if (!track) return 1;
    return Math.max(track.offsetWidth, 1);
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
    const orteSvg = orteEl?.querySelector('svg') as SVGElement | null;
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

    const orteWidth = this.measureOrteWidth();
    const centerOffset = this.measureLetterCenterOffset();
    if (orteSvg) orteSvg.style.width = `${orteWidth}px`;
    gsap.set(orteEl, { width: 0 });
    gsap.set(wordmarkEl, { x: centerOffset });
    gsap.set(taglineEl, { autoAlpha: 0, scale: 0.5, transformOrigin: 'center center' });

    const fillState = { p: 0 };
    const morphState = { t: 0 };
    const bodyInterp = interpolate(PATH_A, PATH_N_BODY, { maxSegmentLength: 4 });
    const stemInterp = interpolate(PATH_STEM_HIDDEN, PATH_N_STEM, { maxSegmentLength: 4 });

    const tl = gsap.timeline({
      onComplete: () => {
        bodyEl.setAttribute('d', PATH_N_BODY);
        stemEl.setAttribute('d', PATH_N_STEM);
        stemEl.setAttribute('opacity', '1');
        gsap.set(orteEl, { width: orteWidth });
        gsap.set(wordmarkEl, { x: 0 });
        gsap.set(taglineEl, { autoAlpha: 1, scale: .5 });

        this.ngZone.run(() => {
          this.morphBodyD = PATH_N_BODY;
          this.morphStemD = PATH_N_STEM;
          this.morphStemOpacity = 1;
          this.grayOpacity = 0;
          this.fillProgress = 1;
          this.morphing = false;
          this.introDone = true;
        });

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

    // ORTE reveal + shift N from center into final left alignment
    tl.to(
      orteEl,
      {
        width: orteWidth,
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
      },
      '<',
    );

    tl.fromTo(
      taglineEl,
      { autoAlpha: 0, scale: 0.5 },
      {
        autoAlpha: 1,
        scale: .5,
        duration: 1,
        ease: 'power2.out',
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
      void this.ensureMexicoSvg().then(() => {
        this.setup({ requireMap: true });
        // After HMR, always settle welcome visuals if intro is off or already finished
        if (!PLAY_WELCOME_INTRO || this.introDone) {
          this.applyFinalIntroState();
        }
      });
    });
  }

  private teardown(opts: { killIntro?: boolean } = {}): void {
    const killIntro = opts.killIntro === true || !this.morphing;

    if (killIntro) {
      this.morphTween?.kill();
      this.morphTween = undefined;
      this.morphing = false;
    }

    this.scrollHintTween?.kill();
    this.scrollHintTween = undefined;
    this.scrollHintVisible = false;

    this.ctx?.revert();
    this.ctx = undefined;

    this.splitTexts.forEach((split) => split.revert());
    this.splitTexts = [];

    const logo = this.logo?.nativeElement;
    const hero = this.hero?.nativeElement;
    const wordmark = this.wordmark?.nativeElement;
    const orteEl = this.orteRest?.nativeElement;
    const taglineEl = this.tagline?.nativeElement;
    const hint = this.scrollHint?.nativeElement;
    const copy = this.durangoCopy?.nativeElement;

    if (this.mexicoPaths.length) gsap.killTweensOf(this.mexicoPaths);
    if (killIntro) {
      if (wordmark) gsap.killTweensOf(wordmark);
      if (orteEl) gsap.killTweensOf(orteEl);
      if (taglineEl) gsap.killTweensOf(taglineEl);
    }
    if (hint) gsap.killTweensOf(hint);
    if (copy) gsap.killTweensOf(copy);

    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === hero || st.trigger === this.boundHero) {
        st.kill();
      }
    });

    // Keep ORTE / tagline / wordmark / logo position — logo no longer scrolls
    if (logo) gsap.set(logo, { clearProps: 'transform,opacity,visibility' });
    if (copy) {
      gsap.set(copy, { clearProps: 'opacity,visibility' });
      copy.setAttribute('aria-hidden', 'true');
    }

    this.boundHero = null;
    this.boundLogo = null;
    this.boundMexicoMap = null;
  }

  private async ensureMexicoSvg(): Promise<void> {
    const host = this.mexicoMapCanvas?.nativeElement;
    if (
      this.mexicoSvgReady &&
      this.mexicoPaths.length === 32 &&
      host?.querySelector('#MX-aguascalientes') &&
      !host.querySelector('path[pathLength]')
    ) {
      return;
    }
    if (this.mexicoSvgLoading) return this.mexicoSvgLoading;

    this.mexicoSvgLoading = (async () => {
      if (!host) return;

      try {
        host.style.visibility = 'hidden';
        const res = await fetch('/mexico-states.svg?v=draw1');
        if (!res.ok) throw new Error(`Mexico SVG failed: ${res.status}`);
        host.innerHTML = await res.text();

        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );

        const paths = Array.from(host.querySelectorAll<SVGPathElement>('.mexico-states path'));
        this.mexicoPaths = paths;
        this.mexicoSvgReady = paths.length > 0;
        this.prepareMexicoPaths(paths);
        host.style.visibility = 'visible';
      } catch (err) {
        console.error(err);
        this.mexicoSvgReady = false;
        this.mexicoPaths = [];
        host.style.visibility = 'visible';
      }
    })().finally(() => {
      this.mexicoSvgLoading = undefined;
    });

    return this.mexicoSvgLoading;
  }

  /**
   * Prepare stroke-draw: real path length in px (no pathLength attr).
   * Fully invisible until scroll starts tracing the contour.
   */
  private prepareMexicoPaths(paths: SVGPathElement[]): void {
    paths.forEach((p) => {
      p.removeAttribute('pathLength');
      p.removeAttribute('stroke-dasharray');
      p.removeAttribute('stroke-dashoffset');

      p.setAttribute('fill', 'transparent');
      p.setAttribute('stroke', 'rgba(17, 17, 17, 0.28)');
      p.setAttribute('stroke-width', '1.85');
      p.setAttribute('stroke-linejoin', 'round');
      // butt avoids the round-cap "dot" at dash start
      p.setAttribute('stroke-linecap', 'butt');
      p.style.fill = 'transparent';
      p.style.stroke = 'rgba(17, 17, 17, 0.28)';
      p.style.strokeWidth = '1.85';
      p.style.strokeLinecap = 'butt';

      const len = Math.max(p.getTotalLength(), 1);
      p.dataset['len'] = String(len);
      // Extra offset past length so no pixel of the stroke peeks through
      const hide = len + 4;

      gsap.set(p, {
        strokeDasharray: len,
        strokeDashoffset: hide,
        autoAlpha: 0,
      });
    });
  }

  private setup(opts: { requireMap?: boolean } = {}): void {
    const requireMap = opts.requireMap !== false;
    const hero = this.hero?.nativeElement;
    const logo = this.logo?.nativeElement;
    const mexicoMap = this.mexicoMap?.nativeElement;
    const copyRoot = this.durangoCopy?.nativeElement;
    const copyText = this.durangoCopyText?.nativeElement;
    const paths = this.mexicoPaths;
    if (!hero || !logo || !mexicoMap) return;
    if (requireMap && !paths.length) return;

    this.teardown();

    this.boundHero = hero;
    this.boundLogo = logo;
    this.boundMexicoMap = mexicoMap;

    gsap.set(logo, { clearProps: 'transform', autoAlpha: 1 });
    if (copyRoot) {
      gsap.set(copyRoot, { autoAlpha: 0 });
      copyRoot.setAttribute('aria-hidden', 'true');
    }

    if (!paths.length) return;

    const scrollY = window.scrollY;
    this.prepareMexicoPaths(paths);

    this.ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          markers: false,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.progress > 0.02) {
              this.hideScrollHint();
            } else if (this.introDone) {
              this.showScrollHint();
            }

            if (copyRoot) {
              copyRoot.setAttribute(
                'aria-hidden',
                self.progress > 0.82 ? 'false' : 'true',
              );
            }
          },
        },
      });

      const drawDuration = 5;
      const staggerAmount = 2.2;
      const order = gsap.utils.shuffle(paths.slice());
      const durango = paths.find((p) => p.id === 'MX-durango');
      const others = paths.filter((p) => p.id !== 'MX-durango');

      order.forEach((path, i) => {
        const len = Number(path.dataset['len'] || path.getTotalLength() || 1);
        const hide = len + 4;
        const start = paths.length <= 1 ? 0 : (i / (paths.length - 1)) * staggerAmount;

        gsap.set(path, {
          strokeDasharray: len,
          strokeDashoffset: hide,
          autoAlpha: 0,
          strokeLinecap: 'butt',
          fill: 'rgba(44,220,110,0)',
        });

        // Appear only when this contour starts tracing
        tl.to(path, { autoAlpha: 1, duration: 0.08, ease: 'none' }, start);
        tl.to(path, { strokeDashoffset: 0, duration: drawDuration, ease: 'none' }, start);
      });

      // Finale: fill Durango + fade the rest + swap logo → copy
      const finaleAt = staggerAmount + drawDuration;
      if (durango) {
        tl.to(
          durango,
          {
            fill: '#2CDC6E',
            stroke: '#2CDC6E',
            strokeWidth: 0,
            duration: 0.85,
            ease: 'none',
          },
          finaleAt,
        );
      }
      if (others.length) {
        tl.to(
          others,
          { autoAlpha: 0.28, duration: 0.85, ease: 'none' },
          finaleAt,
        );
      }

      tl.to(
        logo,
        { autoAlpha: 0, y: -28, scale: 0.96, duration: 0.7, ease: 'none' },
        finaleAt,
      );

      if (copyRoot && copyText) {
        // SplitText en el mismo scrub del mapa (un ST aparte no alcanzaba el start)
        const split = SplitText.create(copyText, {
          type: 'words,lines',
          mask: 'lines',
          linesClass: 'line',
        });
        this.splitTexts.push(split);

        gsap.set(split.lines, { yPercent: 120 });
        tl.to(copyRoot, { autoAlpha: 1, duration: 0.15, ease: 'none' }, finaleAt);
        tl.to(
          split.lines,
          { yPercent: 0, stagger: 0.1, duration: 0.85, ease: 'none' },
          finaleAt + 0.05,
        );
      }
    }, hero);

    ScrollTrigger.refresh();
    ScrollTrigger.getAll()
      .filter((st) => st.trigger === hero)
      .forEach((st) => st.update());

    if (window.scrollY !== scrollY) {
      window.scrollTo(0, scrollY);
    }

    if (!PLAY_WELCOME_INTRO || this.introDone) {
      this.applyFinalIntroState();
    }
  }
}
