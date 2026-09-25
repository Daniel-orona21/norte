import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { IconNode } from 'lucide';
import { createMorph, type Morph } from 'morphicons/dom';
import { animate, stagger, type AnimationPlaybackControls } from 'motion';
import 'motion-components/motion-headline';
import 'motion-components/motion-ticker';
import {
  Cloud,
  File,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Monitor,
  Moon,
  Rocket,
  Send,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Volume2,
  Wifi,
  Zap,
} from 'lucide';

type MotionHeadlineEl = HTMLElement & {
  play(): Promise<void>;
  cancel(): void;
  once: boolean;
};

const HEADLINE_INTERVAL = 0.05;
const HEADLINE_DURATION = 0.45;

gsap.registerPlugin(ScrollTrigger, SplitText);

/** 0 = más lejos … 8 = más cerca */
type Layer = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface ZoomIconConfig {
  icon: IconNode;
  layer: Layer;
  startZ: number;
  endZ: number;
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  width: string;
  /** Rotación del SVG interno (GSAP controla el transform del contenedor) */
  rotateDeg?: number;
}

const VISUAL_SCALE = 0.36;
const HEAD_START = 0.36;

const RAW_ICONS: ZoomIconConfig[] = [
  // 8 — frente
  { icon: Lock, layer: 8, startZ: -1400, endZ: 1480, left: '70%', top: '40%', width: '21vw' },
  { icon: Globe, layer: 8, startZ: -1480, endZ: 1460, left: '4%', top: '10%', width: '24vw' },

  // 7
  { icon: ShieldCheck, layer: 7, startZ: -1920, endZ: 1400, left: '5%', bottom: '12%', width: '22vw' },

  // 6
  { icon: Wifi, layer: 6, startZ: -2300, endZ: 1360, right: '7%', top: '11%', width: '20vw' },
  { icon: Zap, layer: 6, startZ: -2380, endZ: 1340, left: '6%', top: '44%', width: '18vw' },

  // 5
  { icon: Send, layer: 5, startZ: -2750, endZ: 1300, right: '8%', top: '38%', width: '18vw' },
  { icon: Cloud, layer: 5, startZ: -2820, endZ: 1280, left: '24%', top: '5%', width: '18vw' },

  // 4
  { icon: Share2, layer: 4, startZ: -3200, endZ: 1240, right: '22%', top: '6%', width: '18vw' },
  { icon: Sparkles, layer: 4, startZ: -3280, endZ: 1220, left: '40%', bottom: '10%', width: '16vw' },

  // 3
  { icon: Monitor, layer: 3, startZ: -3650, endZ: 1180, left: '10%', bottom: '30%', width: '16vw' },
  { icon: ShoppingCart, layer: 3, startZ: -3720, endZ: 1160, right: '30%', bottom: '14%', width: '16vw' },

  // 2
  { icon: Volume2, layer: 2, startZ: -4100, endZ: 1140, right: '12%', top: '55%', width: '15vw' },

  // 1
  { icon: Smartphone, layer: 1, startZ: -4550, endZ: 1100, left: '55%', top: '18%', width: '14vw' },
  { icon: Rocket, layer: 1, startZ: -4620, endZ: 1080, right: '50%', top: '20%', width: '14vw', rotateDeg: -90 },

  // 0 — fondo
  { icon: Moon, layer: 0, startZ: -5000, endZ: 1060, left: '30%', top: '58%', width: '13vw' },
  { icon: File, layer: 0, startZ: -5080, endZ: 1040, right: '38%', bottom: '8%', width: '13vw' },
];

const ZOOM_ICONS: ZoomIconConfig[] = RAW_ICONS.map((cfg) => {
  const bake = cfg.layer <= 1 ? HEAD_START * 0.75 : HEAD_START;
  return {
    ...cfg,
    startZ: cfg.startZ + (cfg.endZ - cfg.startZ) * bake,
  };
});

interface ServiceCard {
  title: string;
  icon: IconNode;
  desc: string;
}

const SERVICE_CARDS: ServiceCard[] = [
  {
    title: 'SOFTWARE',
    icon: Layers,
    desc: 'Desarrollo de sistemas para llevar cada proyecto a donde necesita llegar.',
  },
  {
    title: 'WEB',
    icon: Globe,
    desc: 'Construcción de plataformas digitales escalables y optimizadas para potenciar la presencia y conversión de tu negocio.',
  },
  {
    title: 'MÓVIL',
    icon: Smartphone,
    desc: 'Diseño y desarrollo de aplicaciones fluidas e intuitivas para conectar directamente con tus usuarios en cualquier dispositivo.',
  },
  {
    title: 'INTEGRACIONES',
    icon: GitBranch,
    desc: 'Conexión y automatización de tus herramientas existentes para optimizar el flujo de datos y la eficiencia operativa.',
  },
];

const PRODUCT_TICKER = [
  'CRM',
  'ERP',
  'APPS',
  'LANDING',
  'ECOMMERCE',
  'PORTAL WEB',
  'iOS',
  'ANDROID',
  'FLUTTER',
  'REACT NATIVE',
  'UI/UX',
  'APIs & REST',
  'WEBHOOKS',
] as const;

function paintLucideIcon(svg: SVGElement, icon: IconNode): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  for (const [tag, attrs] of icon) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, String(value));
    }
    svg.appendChild(el);
  }
}

@Component({
  selector: 'app-servicios',
  imports: [],
  templateUrl: './servicios.html',
  styleUrl: './servicios.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Servicios {
  readonly zoomIcons = ZOOM_ICONS;
  readonly serviceCards = SERVICE_CARDS;
  /** Duplicado para que el loop del ticker no deje hueco al empalmar */
  readonly productTicker = [...PRODUCT_TICKER, ...PRODUCT_TICKER];
  tickerReady = false;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private ctx?: gsap.Context;
  private serviceMorph?: Morph;

  /** Envuelve las "i" con <strong> como en el CV (portafol<strong>i</strong>o) */
  titleChars(title: string): string[] {
    return Array.from(title);
  }

  isTitleI(ch: string): boolean {
    return /[iíIÍ]/.test(ch);
  }

  constructor() {
    afterNextRender(() => {
      this.initDemo();
    });

    this.destroyRef.onDestroy(() => {
      this.serviceMorph?.destroy();
      this.ctx?.revert();
    });
  }

  private initDemo(): void {
    const root = this.host.nativeElement as HTMLElement;
    const items = Array.from(
      root.querySelectorAll('.zoom-item'),
    ) as HTMLElement[];

    items.forEach((el, i) => {
      const cfg = ZOOM_ICONS[i];
      const svg = el.querySelector('.zoom-icon');
      if (!cfg || !(svg instanceof SVGElement)) return;
      paintLucideIcon(svg, cfg.icon);
    });

    const morphPath = root.querySelector('.morph-path') as SVGPathElement | null;
    const serviceIcons = SERVICE_CARDS.map((card) => card.icon);
    if (morphPath && serviceIcons[0]) {
      this.serviceMorph?.destroy();
      this.serviceMorph = createMorph(morphPath, serviceIcons[0]);
      this.serviceMorph.set(serviceIcons[0]);
    }

    this.ctx = gsap.context(() => {
      const FAINT_Z = -4000;
      const FULL_DARK_Z = 280;

      const opacityFromDepth = (z: number): number =>
        gsap.utils.clamp(0, 1, (z - FAINT_Z) / (FULL_DARK_Z - FAINT_Z));

      const setIconOpacity = (el: HTMLElement, o: number) => {
        el.style.setProperty('--icon-o', String(o));
      };

      const applyOpacity = () => {
        for (const el of items) {
          const z = Number(gsap.getProperty(el, 'z'));
          setIconOpacity(el, opacityFromDepth(z));
        }
      };

      items.forEach((el, i) => {
        const cfg = ZOOM_ICONS[i];
        if (!cfg) return;
        gsap.set(el, { z: cfg.startZ, scale: VISUAL_SCALE });
      });

      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      gsap.set('.heading', { z: isMobile ? -260 : -900, opacity: isMobile ? 0.7 : 0.45 });
      applyOpacity();

      const pinSection = root.querySelector('.pin-section');
      const list = root.querySelector('.list');
      const fill = root.querySelector('.fill');
      const listItems = gsap.utils.toArray<HTMLElement>('li', list);
      const slides = gsap.utils.toArray<HTMLElement>('.slide', root);

      const zoomScrollPct = isMobile ? 80 : 160;
      const itemScrollPct = 58;
      const handoffDur = 24;
      const pinScrollPct = handoffDur + listItems.length * itemScrollPct;
      const totalScrollPct = zoomScrollPct + pinScrollPct;
      const zoomDur = zoomScrollPct;
      const pinStart = zoomDur;
      const zoomFraction = zoomScrollPct / totalScrollPct;
      const handoffFraction = handoffDur / pinScrollPct;
      const itemCount = Math.max(1, listItems.length);
      let activeServiceIdx = 0;
      let visibleHeadlineIdx = 0;

      const headlines = Array.from(
        root.querySelectorAll('motion-headline'),
      ) as MotionHeadlineEl[];

      let swapToken = 0;
      let activeExit: AnimationPlaybackControls | null = null;

      const lineUnits = (el: HTMLElement) =>
        Array.from(el.querySelectorAll<HTMLElement>(':scope > span > span'));

      const exitHeadline = (el: MotionHeadlineEl, direction: number) => {
        const units = lineUnits(el);
        if (!units.length) return Promise.resolve();

        activeExit?.cancel();
        const controls = animate(
          units,
          { y: direction >= 0 ? '-110%' : '110%' },
          {
            delay: stagger(HEADLINE_INTERVAL),
            duration: HEADLINE_DURATION,
            type: 'spring',
            bounce: 0.05,
          },
        );
        activeExit = controls;

        return Promise.resolve(controls).then(() => {
          if (activeExit === controls) activeExit = null;
        });
      };

      const swapHeadline = async (
        fromIdx: number,
        toIdx: number,
        direction: number,
      ) => {
        if (fromIdx === toIdx) return;

        const token = ++swapToken;
        const leaving = headlines[fromIdx];
        const entering = headlines[toIdx];
        const leaveSlide = slides[fromIdx];
        const enterSlide = slides[toIdx];

        slides.forEach((slide, i) => {
          if (i === fromIdx || i === toIdx) return;
          gsap.set(slide, { autoAlpha: 0, zIndex: 0 });
          headlines[i]?.cancel();
        });

        if (leaveSlide) gsap.set(leaveSlide, { autoAlpha: 1, zIndex: 2 });
        if (enterSlide) {
          entering?.cancel();
          gsap.set(enterSlide, { autoAlpha: 1, zIndex: 1 });
        }

        const exitPromise = leaving
          ? exitHeadline(leaving, direction)
          : Promise.resolve();

        // Empieza la entrada casi de inmediato para no dejar hueco vacío
        await new Promise<void>((r) => setTimeout(r, HEADLINE_INTERVAL * 1000));
        if (token !== swapToken) return;

        if (entering) {
          entering.cancel();
          void entering.play();
        }
        visibleHeadlineIdx = toIdx;

        await exitPromise;
        if (token !== swapToken) return;

        leaving?.cancel();
        if (leaveSlide) gsap.set(leaveSlide, { autoAlpha: 0, zIndex: 0 });
        if (enterSlide) gsap.set(enterSlide, { zIndex: 1 });
      };

      const playHeadline = (idx: number) => {
        const el = headlines[idx];
        if (!el) return;
        slides.forEach((s, i) => {
          gsap.set(s, {
            autoAlpha: i === idx ? 1 : 0,
            zIndex: i === idx ? 1 : 0,
          });
          if (i !== idx) headlines[i]?.cancel();
        });
        el.cancel();
        void el.play();
        visibleHeadlineIdx = idx;
      };

      void customElements.whenDefined('motion-headline').then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            headlines.forEach((h) => {
              h.once = true;
              h.cancel();
            });
            playHeadline(0);
          });
        });
      });

      if (pinSection) {
        gsap.set(pinSection, { autoAlpha: 0, yPercent: 28 });
      }

      // Un solo pin: el título se queda fijo durante zoom + pin-section
      const master = gsap.timeline({
        scrollTrigger: {
          trigger: '.que-hacemos',
          start: 'top top',
          end: `+=${totalScrollPct}%`,
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            applyOpacity();

            // Activo cuando el pin-section entra y el heading sube
            const pinVisible = self.progress >= zoomFraction;
            if (pinVisible && !this.tickerReady) {
              this.tickerReady = true;
              this.cdr.detectChanges();
              playHeadline(activeServiceIdx);
            }

            let nextIdx = 0;
            let itemP = 0;
            if (self.progress >= zoomFraction) {
              const pinP = gsap.utils.clamp(
                0,
                1,
                (self.progress - zoomFraction) / (1 - zoomFraction),
              );
              itemP =
                pinP <= handoffFraction
                  ? 0
                  : (pinP - handoffFraction) / (1 - handoffFraction);
              nextIdx = Math.min(
                Math.floor(itemP * itemCount),
                itemCount - 1,
              );
            }

            if (fill) {
              gsap.set(fill, {
                scaleY: 1 / itemCount + itemP * (1 - 1 / itemCount),
              });
            }

            if (nextIdx === activeServiceIdx) return;

            const prevIdx = activeServiceIdx;
            activeServiceIdx = nextIdx;
            void swapHeadline(visibleHeadlineIdx, nextIdx, self.direction);

            const prevItem = listItems[prevIdx];
            const nextItem = listItems[nextIdx];
            if (prevItem) {
              gsap.to(prevItem, {
                scale: 1,
                color: '#00000082',
                duration: 0.2,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }
            if (nextItem) {
              gsap.to(nextItem, {
                scale: 1.12,
                color: '#000000',
                duration: 0.2,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }

            const morph = this.serviceMorph;
            if (!morph || !serviceIcons.length) return;
            const icon = serviceIcons[nextIdx];
            if (icon) morph.morphTo(icon, 'smooth');
          },
        },
      });

      items.forEach((el, i) => {
        const cfg = ZOOM_ICONS[i];
        if (!cfg) return;

        master.to(
          el,
          {
            z: cfg.endZ,
            scale: VISUAL_SCALE,
            ease: 'power2.in',
            duration: zoomDur,
          },
          0,
        );
      });

      master.to(
        '.heading',
        {
          opacity: 1,
          z: 60,
          ease: 'power2.in',
          duration: zoomDur,
        },
        0,
      );

      // Título sube arriba y el pin entra desde abajo, mismo ritmo
      master.to(
        '.heading',
        {
          top: () =>
            window.matchMedia('(max-width: 768px)').matches
              ? '4.5rem'
              : 'clamp(1rem, 5vh, 3rem)',
          yPercent: 0,
          ease: 'power2.inOut',
          duration: handoffDur,
        },
        pinStart,
      );

      if (pinSection) {
        master.to(
          pinSection,
          {
            autoAlpha: 1,
            yPercent: 0,
            ease: 'power2.inOut',
            duration: handoffDur,
          },
          pinStart,
        );
      }

      if (fill) {
        gsap.set(fill, {
          scaleY: 1 / listItems.length,
          transformOrigin: 'top left',
        });
      }

      listItems.forEach((item, i) => {
        if (i === 0) {
          gsap.set(item, { color: '#000000', scale: 1.12 });
          gsap.set(slides[i], { autoAlpha: 1 });
        } else {
          gsap.set(item, { color: '#00000082', scale: 1 });
        }
      });

      slides.forEach((slide, i) => {
        if (i === 0) return;
        gsap.set(slide, { autoAlpha: 0 });
      });

      master.to({}, { duration: pinScrollPct }, pinStart);

      const revealEl = root.querySelector('.opacity-reveal');
      if (!revealEl) return;

      const splitLetters = SplitText.create(revealEl);
      gsap.set(splitLetters.chars, { opacity: '0.2' });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: '.section-stick',
            pin: true,
            start: 'center center',
            end: '+=1500',
            scrub: 1,
          },
        })
        .to(splitLetters.chars, {
          opacity: '1',
          duration: 1,
          ease: 'none',
          stagger: 1,
        })
        .to({}, { duration: 10 })
        .to('.opacity-reveal', {
          opacity: '0',
          scale: 1.2,
          duration: 50,
        });
    }, root);
  }
}
