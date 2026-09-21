import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

@Component({
  selector: 'app-proceso',
  imports: [],
  templateUrl: './proceso.html',
  styleUrl: './proceso.scss',
})
export class Proceso implements AfterViewInit, OnDestroy {
  @ViewChild('cuerpo') cuerpo!: ElementRef<HTMLElement>;
  @ViewChild('textos') textos!: ElementRef<HTMLElement>;
  @ViewChild('flyer') flyer!: ElementRef<HTMLElement>;

  private ctx?: gsap.Context;
  private resizeHandler = () => this.setupAnimations();

  ngAfterViewInit() {
    setTimeout(() => this.setupAnimations(), 100);
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeHandler);
    this.ctx?.revert();
  }

  private setupAnimations() {
    const cuerpoElement = this.cuerpo.nativeElement;
    const h1Elements = this.textos.nativeElement.querySelectorAll('h1');
    const pasos = cuerpoElement.querySelectorAll<HTMLElement>(
      '.contenedorPaso .paso',
    );

    this.ctx?.revert();

    this.ctx = gsap.context(() => {
      ScrollTrigger.matchMedia({
        '(min-width: 769px)': () => {
          gsap.set(h1Elements, { letterSpacing: '28px', opacity: 0 });

          gsap
            .timeline({
              scrollTrigger: {
                trigger: cuerpoElement,
                start: 'top 85%',
                end: 'top 85%',
                scrub: 1,
              },
            })
            .to(h1Elements, {
              letterSpacing: 0,
              opacity: 1,
              duration: 1,
              stagger: 0.5,
              ease: 'power2.out',
            });

          // Path first (measures final layout), then entrance offsets
          this.animarFlyer(cuerpoElement, pasos);
          this.animarPasos(pasos, { offset: 120, fromLeftOnMobile: false });
        },

        '(max-width: 768px)': () => {
          gsap.set(h1Elements, { letterSpacing: '28px', opacity: 0 });

          gsap
            .timeline({
              scrollTrigger: {
                trigger: cuerpoElement,
                start: 'top 80%',
                end: 'top 80%',
                scrub: 1,
              },
            })
            .to(h1Elements, {
              letterSpacing: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.3,
              ease: 'power1.out',
            });

          this.animarFlyer(cuerpoElement, pasos);
          this.animarPasos(pasos, { offset: 80, fromLeftOnMobile: true });
        },
      });
    }, cuerpoElement);
  }

  private animarPasos(
    pasos: NodeListOf<HTMLElement>,
    options: { offset: number; fromLeftOnMobile: boolean },
  ) {
    pasos.forEach((paso, index) => {
      const fromLeft = options.fromLeftOnMobile || index % 2 === 0;
      const xFrom = fromLeft ? -options.offset : options.offset;

      gsap.set(paso, { x: xFrom, opacity: 0 });

      gsap.to(paso, {
        x: 0,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: paso,
          start: 'top 85%',
          end: 'top 55%',
          scrub: 1,
        },
      });
    });
  }

  private animarFlyer(cuerpo: HTMLElement, pasos: NodeListOf<HTMLElement>) {
    const flyer = this.flyer.nativeElement;
    const start = cuerpo.querySelector('.svg-slot') as HTMLElement | null;
    const end = cuerpo.querySelector('.proceso-end') as HTMLElement | null;
    const exit = cuerpo.querySelector('.flyer-exit') as HTMLElement | null;
    const markers = gsap.utils.toArray<HTMLElement>('.marker', cuerpo);

    if (!flyer || !start || !end || !exit || markers.length === 0) return;

    // Measure against final paso positions (before entrance offsets apply visually)
    gsap.set(pasos, { x: 0 });

    const slotRect = start.getBoundingClientRect();
    const cuerpoRect = cuerpo.getBoundingClientRect();
    const flyerH = flyer.offsetHeight || 100;
    const flyerW = flyer.offsetWidth || flyerH * (167 / 215);

    // Park flyer fully off the right edge so the tip isn't visible before scroll
    gsap.set(flyer, {
      top: slotRect.top - cuerpoRect.top + slotRect.height / 2 - flyerH / 2,
      left: cuerpo.offsetWidth + flyerW * 0.35,
      width: flyerW,
      height: flyerH,
      x: 0,
      y: 0,
      autoAlpha: 1,
      transformOrigin: '50% 50%',
    });

    const lastMarker = markers[markers.length - 1];
    const lastRect = lastMarker.getBoundingClientRect();

    gsap.set(exit, {
      top: lastRect.top - cuerpoRect.top + lastRect.height / 2,
    });

    const boxStartRect = flyer.getBoundingClientRect();
    const toPoint = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - (boxStartRect.left + boxStartRect.width / 2),
        y: r.top + r.height / 2 - (boxStartRect.top + boxStartRect.height / 2),
      };
    };

    const points = markers.map(toPoint);
    points.push(toPoint(exit));

    gsap
      .timeline({
        scrollTrigger: {
          trigger: start,
          start: 'clamp(top center)',
          endTrigger: end,
          end: 'clamp(top center)',
          scrub: 1,
          invalidateOnRefresh: true,
        },
      })
      .to(flyer, {
        duration: 1,
        ease: 'none',
        motionPath: {
          path: points,
          curviness: 1.5,
          autoRotate: 90,
        },
      });
  }
}
