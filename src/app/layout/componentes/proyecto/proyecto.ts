import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import gsap from 'gsap';
import SplitType from 'split-type';
import { galleryImageUrl, galleryItems, type GalleryItem } from './data';

type ShowcaseContext = gsap.Context & {
  handleItemClick: (index: number) => void;
};

function createSplitText(element: HTMLElement): void {
  const split = new SplitType(element, { types: 'lines' });
  element.innerHTML = '';
  split.lines?.forEach((line) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'line';
    const span = document.createElement('span');
    span.textContent = line.textContent ?? '';
    lineEl.appendChild(span);
    element.appendChild(lineEl);
  });
}

function createEl(tag: string, className: string): HTMLElement {
  const el = document.createElement(tag);
  el.classList.add(className);
  return el;
}

const TEXT_SELECTOR =
  '.title h1, .title .title-logo, .info p .line span, .credits p, .director p';

const TEXT_MASK = '.title, .credits, .director, .line';

function maskOffset(el: Element): number {
  const node = el as HTMLElement;
  const mask = node.closest(TEXT_MASK);
  return mask instanceof HTMLElement ? mask.offsetHeight : node.offsetHeight;
}

@Component({
  selector: 'app-proyecto',
  imports: [],
  templateUrl: './proyecto.html',
  styleUrl: './proyecto.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Proyecto implements AfterViewInit, OnDestroy {
  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  readonly initialItem: GalleryItem = galleryItems[0];
  readonly initialImage = galleryImageUrl(0);

  private ctx?: ShowcaseContext;
  private cancelled = false;
  private infoText = '';

  ngAfterViewInit() {
    const root = this.rootRef.nativeElement;
    const infoP = root.querySelector<HTMLElement>('.info p');
    this.infoText = infoP?.textContent ?? '';
    this.cancelled = false;

    this.ctx = gsap.context((self) => {
      const gallery = root.querySelector<HTMLElement>('.gallery');
      const blurryPrev = root.querySelector<HTMLElement>('.blurry-prev');
      const projectPreview = root.querySelector<HTMLElement>('.project-preview');
      if (!gallery || !blurryPrev || !projectPreview) return;

      let activeItemIndex = 0;
      let isAnimating = false;

      const fillTitle = (parent: HTMLElement, item: GalleryItem) => {
        parent.replaceChildren();
        if (item.logo) {
          const logo = document.createElement('img');
          logo.className = 'title-logo';
          logo.src = item.logo;
          logo.alt = item.title;
          parent.appendChild(logo);
        } else {
          const heading = document.createElement('h1');
          heading.className = 'title-kimera';
          heading.textContent = item.title;
          parent.appendChild(heading);
        }
      };

      const fillMark = (parent: HTMLElement, item: GalleryItem) => {
        parent.replaceChildren();
        if (item.markLogo) {
          const logo = document.createElement('img');
          logo.className = 'title-logo';
          logo.src = item.markLogo;
          logo.alt = item.title;
          parent.appendChild(logo);
        } else if (item.markText) {
          const heading = document.createElement('h1');
          heading.className = 'title-kimera';
          heading.textContent = item.markText;
          parent.appendChild(heading);
        } else {
          fillTitle(parent, item);
        }
      };

      const appendTitle = (parent: HTMLElement, item: GalleryItem) => {
        const wrap = createEl('div', 'title');
        fillTitle(wrap, item);
        parent.appendChild(wrap);
      };

      const buildProject = (item: GalleryItem, index: number) => {
        const newProjectDetails = createEl('div', 'project-details');
        appendTitle(newProjectDetails, item);
        (
          [
            { className: 'info', tag: 'p', content: item.copy },
            { className: 'credits', tag: 'p', content: 'VALOR' },
            { className: 'director', tag: 'p', content: item.director },
          ] as const
        ).forEach(({ className, tag, content }) => {
          const wrap = createEl('div', className);
          const node = document.createElement(tag);
          node.textContent = content;
          wrap.appendChild(node);
          newProjectDetails.appendChild(wrap);
        });

        const newProjectImg = item.url
          ? (createEl('a', 'project-img') as HTMLAnchorElement)
          : createEl('div', 'project-img');
        if (item.url && newProjectImg instanceof HTMLAnchorElement) {
          newProjectImg.href = item.url;
          newProjectImg.target = '_blank';
          newProjectImg.rel = 'noopener noreferrer';
          newProjectImg.classList.add('is-link');
        }
        const img = document.createElement('img');
        img.className = 'project-photo';
        img.src = galleryImageUrl(index);
        img.alt = item.title;
        newProjectImg.appendChild(img);
        const mark = createEl('div', 'project-mark');
        mark.setAttribute('aria-hidden', 'true');
        fillMark(mark, item);
        newProjectImg.appendChild(mark);

        return {
          newProjectDetails,
          newProjectImg,
          infoP: newProjectDetails.querySelector<HTMLElement>('.info p'),
        };
      };

      self.add('handleItemClick', (index: number) => {
        if (index === activeItemIndex || isAnimating) return;
        isAnimating = true;

        const item = galleryItems[index];
        gallery.children[activeItemIndex]?.classList.remove('active');
        gallery.children[index]?.classList.add('active');
        activeItemIndex = index;

        const elementsToAnimate = root.querySelectorAll(TEXT_SELECTOR);
        const projectImg = root.querySelector<HTMLElement>('.project-img');
        if (!projectImg) {
          isAnimating = false;
          return;
        }
        const newBackdrop = document.createElement('img');
        newBackdrop.src = galleryImageUrl(index);
        newBackdrop.alt = item.title;
        gsap.set(newBackdrop, {
          autoAlpha: 0,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          scale: 1.18,
        });
        blurryPrev.insertBefore(newBackdrop, blurryPrev.firstChild);

        // Keep GSAP ticking even when the page isn't scrolling (scrub lag / idle frames).
        gsap.ticker.lagSmoothing(0);

        const prevImg = blurryPrev.querySelector<HTMLImageElement>('img:nth-child(2)');
        if (prevImg) {
          gsap.to(prevImg, {
            autoAlpha: 0,
            duration: 1,
            delay: 0.5,
            ease: 'power2.inOut',
            onComplete: () => {
              if (prevImg.parentNode === blurryPrev) blurryPrev.removeChild(prevImg);
            },
          });
        }
        gsap.to(newBackdrop, {
          delay: 0.5,
          autoAlpha: 1,
          duration: 1,
          ease: 'power2.inOut',
          onComplete: () => {
            gsap.ticker.lagSmoothing(500, 33);
          },
        });

        gsap.to(elementsToAnimate, {
          y: (_, el) => -maskOffset(el),
          yPercent: 0,
          duration: 1,
          ease: 'power4.in',
          stagger: 0.05,
        });

        const currentPhoto = projectImg.querySelector<HTMLElement>('.project-photo');
        const restBottom = window
          .matchMedia('(max-width: 768px) and (orientation: portrait)')
          .matches
          ? '1.25em'
          : '3.5em';

        gsap.to(projectImg, {
          scale: 0,
          bottom: '10em',
          duration: 1,
          ease: 'power4.in',
          onStart: () => {
            self.add(() => {
              if (!currentPhoto) return;
              gsap.to(currentPhoto, {
                scale: 2,
                duration: 1,
                ease: 'power4.in',
              });
            });
          },
          onComplete: () => {
            self.add(() => {
              root.querySelector('.project-details')?.remove();
              projectImg.remove();

              const { newProjectDetails, newProjectImg, infoP: newInfoP } = buildProject(
                item,
                index,
              );
              projectPreview.appendChild(newProjectDetails);
              projectPreview.appendChild(newProjectImg);
              if (newInfoP) createSplitText(newInfoP);

              const newTextEls = newProjectDetails.querySelectorAll(TEXT_SELECTOR);
              const newPhoto = newProjectImg.querySelector<HTMLElement>('.project-photo');

              gsap.fromTo(
                newTextEls,
                { y: (_, el) => maskOffset(el), yPercent: 0 },
                { y: 0, yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.05 },
              );

              gsap.fromTo(
                newProjectImg,
                { scale: 0, bottom: '-10em' },
                {
                  scale: 1,
                  bottom: restBottom,
                  duration: 1,
                  ease: 'power4.out',
                },
              );

              if (!newPhoto) {
                isAnimating = false;
                return;
              }

              gsap.fromTo(
                newPhoto,
                { scale: 2 },
                {
                  scale: 1,
                  duration: 1,
                  ease: 'power4.out',
                  onComplete: () => {
                    gsap.set(newProjectImg, { clearProps: 'transform' });
                    gsap.set(newPhoto, { clearProps: 'transform' });
                    isAnimating = false;
                  },
                },
              );
            });
          },
        });
      });

      for (let i = 0; i < galleryItems.length; i++) {
        const itemEl = document.createElement('div');
        itemEl.classList.add('item');
        if (i === 0) itemEl.classList.add('active');
        const img = document.createElement('img');
        img.src = galleryImageUrl(i);
        img.alt = galleryItems[i].title;
        itemEl.appendChild(img);
        itemEl.dataset['index'] = String(i);
        gallery.appendChild(itemEl);
      }
    }, root) as ShowcaseContext;

    root.querySelectorAll('.gallery .item').forEach((el, i) => {
      el.addEventListener('click', () => this.ctx!.handleItemClick(i));
    });

    document.fonts.ready.then(() => {
      if (this.cancelled || !this.ctx) return;
      this.ctx.add(() => {
        const p = root.querySelector<HTMLElement>('.info p');
        if (!p) return;
        createSplitText(p);
        gsap.set(root.querySelectorAll(TEXT_SELECTOR), { y: 0, yPercent: 0 });
      });
    });
  }

  ngOnDestroy() {
    this.cancelled = true;
    const root = this.rootRef?.nativeElement;
    if (root) {
      const p = root.querySelector<HTMLElement>('.info p');
      if (p) p.textContent = this.infoText;
      root.querySelector('.gallery')?.replaceChildren();
    }
    this.ctx?.revert();
  }
}
