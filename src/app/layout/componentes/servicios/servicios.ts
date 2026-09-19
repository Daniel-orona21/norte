import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { IconNode } from 'lucide';
import {
  Cloud,
  File,
  Globe,
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
  { icon: Rocket, layer: 1, startZ: -4620, endZ: 1080, right: '50%', top: '30%', width: '14vw', rotateDeg: -90 },

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
})
export class Servicios {
  readonly zoomIcons = ZOOM_ICONS;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private ctx?: gsap.Context;

  constructor() {
    afterNextRender(() => this.initDemo());

    this.destroyRef.onDestroy(() => {
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

      gsap.set('.heading', { z: -900, opacity: 0.45 });
      applyOpacity();

      const zoomTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.zoom-container',
          start: 'top top',
          end: '+=160%',
          pin: true,
          scrub: 1,
          onUpdate: () => applyOpacity(),
        },
      });

      items.forEach((el, i) => {
        const cfg = ZOOM_ICONS[i];
        if (!cfg) return;

        zoomTl.to(
          el,
          {
            z: cfg.endZ,
            scale: VISUAL_SCALE,
            ease: 'power1.in',
            duration: 1,
          },
          0,
        );
      });

      zoomTl.to(
        '.heading',
        {
          opacity: 1,
          z: 60,
          ease: 'power1.inOut',
          duration: 1,
        },
        0,
      );

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
