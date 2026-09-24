export interface GalleryItem {
  title: string;
  copy: string;
  director: string;
  image: string;
  logo?: string;
  markLogo?: string;
  markText?: string;
  url?: string;
}

export function galleryImageUrl(index: number): string {
  return galleryItems[index]?.image ?? galleryItems[0].image;
}

export const galleryItems: GalleryItem[] = [
  {
    title: 'KIMERA',
    copy: 'Barber & Tattoo Studio',
    director: 'Dirección visual, interacción y diseño de interfaz para una experiencia digital con carácter propio.',
    image: '/assets/img/kimera.jpg',
    markText: 'K',
    url: 'https://kimera-studio.vercel.app',
  },
  {
    title: 'KUCHE',
    copy: 'DISEÑO DE COCINAS INTELIGENTES',
    director: 'Diseños que equilibran funcionalidad, calma visual y detalles de autor.',
    image: '/assets/img/kuche.jpg',
    logo: '/assets/img/kuchelogo.png',
    markLogo: '/assets/img/kucheweb.png',
    url: 'https://www.kuchecocinasinteligentes.com/catalogo?categoria=Cocinas&subcategoria=Todos',
  },
  {
    title: 'MOTORMEXA',
    copy: 'GRUPO MOTORMEXA',
    director: 'Gestión y control logístico para optimizar operaciones, seguimiento y coordinación en un mismo entorno digital.',
    image: '/assets/img/motormexa.jpg',
    logo: '/assets/img/motormexalogo.png',
  },
];
