/**
 * Plugin de Vite que, al compilar, genera un HTML estático por herramienta
 * (título, descripción, canonical, Open Graph, schema.org, H1, introducción y FAQ),
 * además de sitemap.xml, robots.txt y 404.html. El sitio sigue siendo 100 % estático.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { HOME_SEO, absolute, homeJsonLd, toolFaq, toolJsonLd, toolPath } from '../src/seo/seo';
import { COMMON_FAQ, readyTools, type Faq } from '../src/tools/registry';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (data: unknown[]) =>
  data.map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`).join('\n    ');

function faqHtml(items: Faq[]) {
  return `<section><h2>Preguntas frecuentes</h2>${items.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>`;
}

interface Page {
  path: string;
  title: string;
  description: string;
  jsonLd: unknown[];
  body: string;
}

function render(template: string, page: Page, siteUrl: string, base: string, noindex = false) {
  const url = absolute(siteUrl, page.path === '/' ? '/' : `${page.path}`);
  const head = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(absolute(siteUrl, '/icons/icon-512.png'))}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : '',
    jsonLd(page.jsonLd),
  ]
    .filter(Boolean)
    .join('\n    ');
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace('<!--seo-head-->', head)
    .replace('<div id="root"></div>', `<div id="root"><main style="max-width:56rem;margin:0 auto;padding:1rem;font-family:system-ui,sans-serif">${page.body.replaceAll('href="/', `href="${base}`)}</main></div>`);
}

export function prerenderPlugin(): Plugin {
  let outDir = 'dist';
  let base = '/';
  return {
    name: 'pdf-libre-prerender',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
      base = c.base;
    },
    writeBundle: {
      sequential: true,
      handler() {
        const siteUrl = (process.env.SITE_URL || 'https://pdf-libre.example').replace(/\/$/, '');
        if (!process.env.SITE_URL) {
          console.warn('\n⚠ SITE_URL no definido: el sitemap y las URL canónicas usarán https://pdf-libre.example\n');
        }
        const template = readFileSync(join(outDir, 'index.html'), 'utf8');
        const tools = readyTools();
        const links = `<nav><ul>${tools.map((t) => `<li><a href="/${t.slug}">${esc(t.es.name)}</a></li>`).join('')}</ul></nav>`;

        const home: Page = {
          path: '/',
          title: HOME_SEO.title,
          description: HOME_SEO.description,
          jsonLd: homeJsonLd(siteUrl),
          body: `<h1>${esc(HOME_SEO.h1)}</h1><p><strong>Tus archivos nunca salen de tu dispositivo.</strong> ${esc(HOME_SEO.intro)}</p>${links}${faqHtml(COMMON_FAQ.es)}`,
        };
        writeFileSync(join(outDir, 'index.html'), render(template, home, siteUrl, base));
        // GitHub Pages usa 404.html como respaldo para rutas de la app
        writeFileSync(join(outDir, '404.html'), render(template, { ...home, title: 'PDF Libre', jsonLd: [] }, siteUrl, base, true));

        for (const t of tools) {
          const page: Page = {
            path: toolPath(t.slug),
            title: t.es.title,
            description: t.es.description,
            jsonLd: toolJsonLd(t, siteUrl),
            body: `<nav><a href="/">PDF Libre</a> › ${esc(t.es.name)}</nav><h1>${esc(t.es.h1)}</h1><p>${esc(t.es.intro)}</p><p><strong>Tus archivos nunca salen de tu dispositivo.</strong></p>${faqHtml(toolFaq(t))}${links}`,
          };
          mkdirSync(join(outDir, t.slug), { recursive: true });
          writeFileSync(join(outDir, t.slug, 'index.html'), render(template, page, siteUrl, base));
        }

        const today = new Date().toISOString().slice(0, 10);
        const urls = ['/', ...tools.map((t) => toolPath(t.slug))];
        writeFileSync(
          join(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
            .map((u) => `  <url><loc>${esc(absolute(siteUrl, u))}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${u === '/' ? '1.0' : '0.8'}</priority></url>`)
            .join('\n')}\n</urlset>\n`,
        );
        writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${absolute(siteUrl, '/sitemap.xml')}\n`);
        console.log(`Prerenderizadas ${tools.length + 1} páginas + sitemap.xml`);
      },
    },
  };
}
