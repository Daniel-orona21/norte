import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-cta',
  imports: [],
  templateUrl: './cta.html',
  styleUrl: './cta.scss',
})
export class Cta implements AfterViewInit, OnDestroy {
  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;
  @ViewChild('photo', { static: true }) photoRef!: ElementRef<HTMLImageElement>;

  readonly whatsappUrl =
    'https://wa.me/526185264244?text=' +
    encodeURIComponent(
      'Hola, quiero platicar de un proyecto.',
    );

  private ctx?: gsap.Context;

  ngAfterViewInit() {
    const photo = this.photoRef.nativeElement;

    if (photo.complete) {
      this.setupParallax();
      return;
    }

    photo.addEventListener('load', () => this.setupParallax(), { once: true });
  }

  ngOnDestroy() {
    this.ctx?.revert();
  }

  private setupParallax() {
    const root = this.rootRef.nativeElement;
    const photo = this.photoRef.nativeElement;

    this.ctx?.revert();
    this.ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          photo,
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.6,
            },
          },
        );
      });
    }, root);

    ScrollTrigger.refresh();
  }
}
