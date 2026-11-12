# PDF Libre

Herramientas PDF y de conversión de archivos que **funcionan 100 % en tu navegador**.
Tus archivos nunca salen de tu dispositivo: no hay servidor, ni base de datos, ni cuentas.

- Sin límites artificiales (solo los de la memoria del dispositivo)
- Sin marcas de agua, sin anuncios y sin muros de pago
- Funciona sin internet después de la primera visita (PWA instalable)
- Vista previa del resultado **antes** de descargar
- Español primero, inglés como segunda opción. Modo oscuro. Accesible con teclado y lector de pantalla

## Herramientas disponibles (fase 1)

| URL | Herramienta |
|---|---|
| `/unir-pdf` | Unir PDF (arrastrar o flechas para reordenar) |
| `/dividir-pdf` | Dividir por rangos, cada N páginas o extraer páginas |
| `/comprimir-pdf` | 3 niveles + "Máxima", tamaño real antes/después y comparación visual |
| `/organizar-pdf`, `/rotar-pdf`, `/eliminar-paginas-pdf` | Rotar, reordenar y eliminar páginas con miniaturas |
| `/imagenes-a-pdf`, `/jpg-a-pdf` | JPG, PNG, HEIC, WEBP, GIF, BMP → PDF (A4/Carta/ajustada, orientación, márgenes) |
| `/pdf-a-imagenes`, `/pdf-a-jpg`, `/pdf-a-png` | PDF → JPG/PNG a 72, 150 o 300 ppp |

## Herramientas de la fase 2

| URL | Herramienta |
|---|---|
| `/ocr-pdf` | OCR (español por defecto, inglés o ambos) de PDF escaneados y fotos → PDF buscable. Revisión línea por línea con recorte del original; las líneas dudosas se marcan |
| `/pdf-a-texto`, `/pdf-a-word` | Texto plano editable antes de descargar, o .docx básico (títulos, párrafos, negritas) con aviso honesto de formato |
| `/numerar-paginas`, `/encabezado-pie-pagina-pdf` | Números (6 posiciones, 4 formatos), desde qué página y con qué número; encabezado/pie con `{n}`, `{total}`, `{fecha}` |
| `/proteger-pdf` | Contraseña con AES-256 (qpdf en WebAssembly) y permisos de impresión/copia/edición |
| `/desbloquear-pdf` | Quita la contraseña si la conoces; también las restricciones de propietario |
| `/firmar-pdf` | Firma dibujada (con presión de lápiz), escrita (3 estilos) o desde foto (quita el fondo); se coloca y ajusta con el dedo, ratón o teclado; rúbrica en todas las páginas |
| `/rellenar-formulario-pdf` | Campos de texto, casillas, listas y opciones; acentos; opción de fijar respuestas |
| `/ocultar-datos-pdf` | Redacción real: búsqueda (sin importar acentos), correos, teléfonos, identificaciones o zonas a mano; verificación final de que el texto ya no existe |
| `/eliminar-metadatos-pdf` | Muestra y borra autor, fechas, programa, XMP y datos por página |

## Correr en local

Requisitos: Node.js 20 o superior.

```bash
cd herramientas-pdf
npm install
npm run dev          # http://localhost:5173
```

Para probarla tal como quedará publicada (con Service Worker y páginas prerenderizadas):

```bash
npm run build
npm run preview      # http://localhost:4173
```

Para probar desde tu celular en la misma red Wi‑Fi: `npm run dev -- --host` y abre la IP que aparece.
Nota: el modo sin conexión (Service Worker) solo funciona en `localhost` o con HTTPS.

## Pruebas

```bash
npm test             # pruebas unitarias (Vitest): lógica de cada herramienta
npm run test:e2e     # pruebas en navegador (Playwright): Chromium escritorio + celular emulado
ALL_BROWSERS=1 npm run test:e2e   # además Firefox, WebKit (Safari) e iPhone emulado
```

Para `ALL_BROWSERS=1` primero instala esos navegadores: `npx playwright install firefox webkit`.

Los archivos de prueba están en `tests/fixtures/files` y se regeneran con `npm run fixtures`
(requiere Python 3 con `Pillow`, `pypdf` y `pillow-heif`). Incluyen: un PDF escaneado, uno con formulario,
uno protegido con contraseña, uno solo con contraseña de propietario, uno de 150 páginas, uno dañado,
un archivo que no es PDF y fotos JPG (con rotación EXIF), PNG con transparencia, WEBP y HEIC.

### Lista de verificación manual en iPhone (Safari)

Las pruebas automáticas no sustituyen a un iPhone real. Verifica:

1. Abrir el sitio, convertir una foto HEIC de la galería con "Imágenes a PDF" y comprobar que sale derecha.
2. Unir dos PDF desde la app Archivos y descargar: debe abrirse el visor de iOS con el botón Compartir.
3. Comprimir un PDF escaneado y ampliar la comparación para revisar la firma.
4. Compartir → "Agregar a pantalla de inicio", activar el modo avión y abrir la app: debe funcionar.
5. Con VoiceOver activado, recorrer una herramienta: los botones deben leerse en español.

## Desplegar

Es un sitio 100 % estático: `npm run build` genera la carpeta `dist/`.
Define **`SITE_URL`** con la URL pública (sin barra final) para que el sitemap y las URL canónicas sean correctas.

- **Netlify**: nuevo sitio desde el repositorio, *Base directory* `herramientas-pdf`, variable `SITE_URL`. `netlify.toml` ya está configurado.
- **Vercel**: nuevo proyecto, *Root Directory* `herramientas-pdf`, variable `SITE_URL`. `vercel.json` ya está configurado.
- **GitHub Pages** (en una subcarpeta, p. ej. `https://usuario.github.io/pdf-libre/`):
  ```bash
  BASE_PATH=/pdf-libre/ SITE_URL=https://usuario.github.io/pdf-libre npm run build
  ```
  y publica `dist/` (se genera `404.html` para que funcionen las rutas de la app).

## Estructura

```
src/
  tools/registry.ts     catálogo de herramientas: URL, textos SEO, FAQ, sinónimos del buscador
  tools/<herramienta>/  interfaz (*Tool.tsx, carga diferida) + lógica pura (probada con Vitest)
  workers/              Web Worker (pdf-lib) para no congelar la interfaz; alternativa en la página si falla
  lib/                  pdf.js bajo demanda, errores en español, imágenes (EXIF, HEIC), descargas/ZIP
  components/           zona para soltar archivos, miniaturas diferidas, vista previa, progreso, etc.
  i18n/                 textos en español e inglés
scripts/prerender.ts    HTML por herramienta + schema.org + sitemap.xml + robots.txt al compilar
tests/                  unitarias, e2e y archivos de prueba
```

## Decisiones técnicas y límites honestos

- **Compresión**: se vuelven a codificar las imágenes internas (JPEG y PNG/Flate en RGB o escala de grises);
  el texto y los vectores no se tocan. Las imágenes CMYK, indexadas o con máscara de color se dejan intactas.
  Si el resultado no es más pequeño, se ofrece el original. El nivel "Máxima" convierte las páginas en imágenes y lo avisa.
- **Unir / organizar**: los campos rellenables de un formulario pueden dejar de ser editables tras unir.
- **PDF protegidos**: las demás herramientas los detectan y remiten a "Quitar contraseña" (qpdf en WebAssembly).
- **OCR**: tesseract.js con los modelos `best_int` de español e inglés, servidos por la propia app (`public/tesseract`, ~13 MB que se
  descargan solo al usar el OCR por primera vez y quedan en caché). Las páginas que ya tienen texto se saltan para no duplicarlo.
  El texto se añade como capa invisible sobre la página original (no cambia su aspecto).
- **Redacción**: las páginas con zonas ocultas se rehacen como imagen con las zonas en negro (el texto original desaparece);
  el documento final es nuevo y no conserva metadatos, marcadores ni adjuntos. Tras generarlo se vuelve a leer y se comprueba
  que los datos buscados ya no aparecen. Opcionalmente, OCR del texto visible de esas páginas.
- **PDF a Word**: reconstruye párrafos, títulos (por tamaño de letra) y negritas; no reproduce columnas, tablas complejas ni imágenes.
- **Firmar**: es una firma visual (imagen), no una firma digital con certificado (e.firma, DNIe…).
- **Formularios**: AcroForm completo; los formularios XFA se rellenan en su versión estándar. Los textos usan Helvetica,
  que cubre el español; caracteres de otros alfabetos se sustituyen.
- **HEIC**: Safari lo lee de forma nativa; en otros navegadores se usa `heic2any` (se descarga solo al necesitarlo).
- **Memoria**: los PDF de más de 60 MB solo calculan el nivel de compresión elegido. En iPhone las imágenes se limitan
  a ~16,7 megapíxeles (límite de Safari) y se avisa si una página se generó con menor resolución.
