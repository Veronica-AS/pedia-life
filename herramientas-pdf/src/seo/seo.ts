/**
 * Datos SEO compartidos por la app (al navegar) y por el prerenderizado (al compilar).
 * Sin dependencias del DOM.
 */
import { COMMON_FAQ, SITE_NAME, type Faq, type ToolDef } from '../tools/registry';

export const HOME_SEO = {
  title: 'PDF Libre: herramientas PDF gratis, privadas y sin límites',
  description:
    'Une, divide, comprime y convierte PDF e imágenes gratis directamente en tu navegador. Tus archivos nunca salen de tu dispositivo. Sin límites, sin marcas de agua, sin registro y funciona sin internet.',
  h1: 'Herramientas PDF gratis y privadas',
  intro:
    'Todo se procesa en tu dispositivo: nada se sube a internet. Sin límites de tamaño ni de uso, sin marcas de agua y sin registro.',
};

export const toolPath = (slug: string) => `/${slug}`;

export function toolFaq(tool: ToolDef): Faq[] {
  return [...tool.es.faq, ...COMMON_FAQ.es];
}

export function absolute(siteUrl: string, path: string) {
  return `${siteUrl.replace(/\/$/, '')}${path === '/' ? '/' : path}`;
}

export function homeJsonLd(siteUrl: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: absolute(siteUrl, '/'),
      inLanguage: 'es',
      description: HOME_SEO.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: COMMON_FAQ.es.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];
}

export function toolJsonLd(tool: ToolDef, siteUrl: string) {
  const url = absolute(siteUrl, toolPath(tool.slug));
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `${tool.es.name} · ${SITE_NAME}`,
      url,
      description: tool.es.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Cualquiera (navegador web)',
      inLanguage: 'es',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: ['Procesamiento local en el navegador', 'Sin límites', 'Sin marcas de agua', 'Funciona sin conexión'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: toolFaq(tool).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absolute(siteUrl, '/') },
        { '@type': 'ListItem', position: 2, name: tool.es.name, item: url },
      ],
    },
  ];
}
