/**
 * Catálogo de herramientas. Solo datos (sin React) para poder importarlo
 * desde la app, el buscador, el prerenderizado SEO y la generación del sitemap.
 */

export type Lang = 'es' | 'en';

export type CategoryId = 'organizar' | 'optimizar' | 'convertir' | 'seguridad' | 'editar' | 'avanzado';

export type ComponentId =
  | 'merge'
  | 'split'
  | 'compress'
  | 'organize'
  | 'imagesToPdf'
  | 'pdfToImages'
  | 'ocr'
  | 'pdfToText'
  | 'pageNumbers'
  | 'sign'
  | 'fillForm'
  | 'protect'
  | 'unlock'
  | 'redact'
  | 'metadata'
  | 'batch'
  | 'flows'
  | 'scan'
  | 'compare'
  | 'imageConvert';

export interface Faq {
  q: string;
  a: string;
}

export interface ToolText {
  name: string;
  /** Descripción corta para la tarjeta */
  short: string;
  /** <title> de la página */
  title: string;
  /** <meta name="description"> */
  description: string;
  h1: string;
  intro: string;
  faq: Faq[];
  /** Sinónimos para el buscador */
  keywords: string[];
}

export interface ToolDef {
  slug: string;
  category: CategoryId;
  icon: string;
  status: 'ready' | 'soon';
  phase: 1 | 2 | 3;
  component?: ComponentId;
  /** Opciones preseleccionadas (p. ej. /pdf-a-png abre la herramienta con PNG elegido) */
  preset?: Record<string, string>;
  /** Si es true, no aparece como tarjeta en la portada (solo URL para SEO) */
  alias?: boolean;
  es: ToolText;
  en: ToolText;
}

export const CATEGORIES: { id: CategoryId; es: string; en: string }[] = [
  { id: 'organizar', es: 'Organizar', en: 'Organize' },
  { id: 'optimizar', es: 'Optimizar', en: 'Optimize' },
  { id: 'convertir', es: 'Convertir', en: 'Convert' },
  { id: 'editar', es: 'Editar', en: 'Edit' },
  { id: 'seguridad', es: 'Seguridad', en: 'Security' },
  { id: 'avanzado', es: 'Avanzado', en: 'Advanced' },
];

export const SITE_NAME = 'PDF Libre';

/** Preguntas comunes que se añaden a todas las herramientas */
export const COMMON_FAQ: Record<Lang, Faq[]> = {
  es: [
    {
      q: '¿Mis archivos se suben a algún servidor?',
      a: 'No. Todo el procesamiento ocurre dentro de tu navegador. Tus archivos nunca salen de tu dispositivo, por eso puedes usar PDF Libre incluso con documentos confidenciales.',
    },
    {
      q: '¿Hay límites de tamaño o de uso diario?',
      a: 'No hay límites artificiales ni de tareas por día. El único límite es la memoria de tu dispositivo: en celulares, archivos de varios cientos de MB pueden tardar más.',
    },
    {
      q: '¿Funciona sin internet?',
      a: 'Sí. Después de la primera visita la aplicación queda guardada en tu navegador y puedes usarla sin conexión. También puedes instalarla como app desde el menú del navegador.',
    },
    {
      q: '¿Es gratis? ¿Agrega marca de agua?',
      a: 'Es completamente gratis, sin registro, sin anuncios y nunca agrega marcas de agua.',
    },
  ],
  en: [
    {
      q: 'Are my files uploaded to a server?',
      a: 'No. Everything is processed inside your browser. Your files never leave your device, so you can safely use PDF Libre with confidential documents.',
    },
    {
      q: 'Are there size or daily limits?',
      a: 'There are no artificial limits. The only limit is your device memory: very large files may take longer on phones.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes. After your first visit the app is stored in your browser and works without a connection. You can also install it as an app.',
    },
    {
      q: 'Is it free? Does it add a watermark?',
      a: 'It is completely free, with no sign-up, no ads and never any watermark.',
    },
  ],
};

function tool(
  slug: string,
  category: CategoryId,
  icon: string,
  component: ComponentId,
  text: { es: ToolText; en: ToolText },
  preset?: Record<string, string>,
  alias = false,
  phase: 1 | 2 | 3 = 2,
): ToolDef {
  return { slug, category, icon, status: 'ready', phase, component, preset, alias, ...text };
}

export const TOOLS: ToolDef[] = [
  // ───────────── Fase 1 ─────────────
  {
    slug: 'unir-pdf',
    category: 'organizar',
    icon: 'merge',
    status: 'ready',
    phase: 1,
    component: 'merge',
    es: {
      name: 'Unir PDF',
      short: 'Combina varios PDF en uno y ordénalos arrastrando.',
      title: 'Unir PDF gratis, sin subir archivos | PDF Libre',
      description:
        'Une varios archivos PDF en uno solo directamente en tu navegador. Sin límites, sin marcas de agua y sin subir tus documentos a ningún servidor.',
      h1: 'Unir PDF',
      intro:
        'Combina varios PDF en un solo documento. Arrastra para cambiar el orden y revisa el resultado antes de descargarlo.',
      faq: [
        {
          q: '¿Cuántos PDF puedo unir a la vez?',
          a: 'Los que quieras. No hay un límite de archivos ni de páginas; solo depende de la memoria de tu dispositivo.',
        },
        {
          q: '¿Se pierde la calidad al unir?',
          a: 'No. Las páginas se copian tal cual, sin volver a comprimir imágenes ni texto.',
        },
        {
          q: '¿Puedo unir un PDF protegido con contraseña?',
          a: 'Primero debes quitarle la contraseña. Esa herramienta llegará en la próxima actualización.',
        },
      ],
      keywords: ['juntar', 'combinar', 'fusionar', 'merge', 'pegar', 'agrupar', 'unificar'],
    },
    en: {
      name: 'Merge PDF',
      short: 'Combine several PDFs into one and drag to reorder.',
      title: 'Merge PDF free, without uploading | PDF Libre',
      description: 'Merge PDF files in your browser. No limits, no watermark, no uploads.',
      h1: 'Merge PDF',
      intro: 'Combine several PDFs into a single document. Drag to reorder and preview the result before downloading.',
      faq: [
        { q: 'How many PDFs can I merge?', a: 'As many as you want. The only limit is your device memory.' },
        { q: 'Does merging reduce quality?', a: 'No. Pages are copied as they are, without recompression.' },
      ],
      keywords: ['combine', 'join', 'merge'],
    },
  },
  {
    slug: 'dividir-pdf',
    category: 'organizar',
    icon: 'split',
    status: 'ready',
    phase: 1,
    component: 'split',
    es: {
      name: 'Dividir PDF',
      short: 'Separa por rangos, página por página o extrae páginas.',
      title: 'Dividir PDF gratis: por rangos o páginas | PDF Libre',
      description:
        'Divide un PDF por rangos, separa cada página o extrae solo las que necesitas. Gratis, sin límites y sin subir archivos.',
      h1: 'Dividir PDF',
      intro: 'Separa un PDF en varios archivos por rangos de páginas, en archivos de una página, o extrae solo las páginas que elijas.',
      faq: [
        {
          q: '¿Cómo escribo los rangos?',
          a: 'Usa números y guiones separados por comas. Por ejemplo, "1-3, 5, 8-10" crea tres archivos: páginas 1 a 3, la página 5 y las páginas 8 a 10.',
        },
        {
          q: '¿Cómo descargo varios archivos a la vez?',
          a: 'Cuando el resultado tiene más de un archivo, se descargan juntos en un único archivo ZIP.',
        },
      ],
      keywords: ['separar', 'cortar', 'extraer', 'partir', 'split', 'sacar páginas', 'rangos'],
    },
    en: {
      name: 'Split PDF',
      short: 'Split by ranges, every page, or extract pages.',
      title: 'Split PDF free | PDF Libre',
      description: 'Split a PDF by ranges, into single pages, or extract selected pages. No uploads.',
      h1: 'Split PDF',
      intro: 'Split a PDF into several files by page ranges, into single pages, or extract just the pages you choose.',
      faq: [{ q: 'How do I write ranges?', a: 'Use commas and hyphens, e.g. "1-3, 5, 8-10".' }],
      keywords: ['separate', 'extract', 'cut'],
    },
  },
  {
    slug: 'comprimir-pdf',
    category: 'optimizar',
    icon: 'compress',
    status: 'ready',
    phase: 1,
    component: 'compress',
    es: {
      name: 'Comprimir PDF',
      short: 'Reduce el tamaño con vista previa y tamaño real antes de descargar.',
      title: 'Comprimir PDF sin perder calidad, gratis | PDF Libre',
      description:
        'Reduce el peso de tu PDF eligiendo entre varios niveles de compresión. Compara la calidad y el tamaño final antes de descargar. Sin subir archivos.',
      h1: 'Comprimir PDF',
      intro:
        'Elige un nivel de compresión y compara el antes y el después: verás el tamaño final real y cómo quedan las imágenes y firmas antes de descargar.',
      faq: [
        {
          q: '¿Por qué mi PDF casi no se reduce?',
          a: 'La compresión actúa sobre las imágenes del documento. Si tu PDF solo tiene texto, ya está optimizado y la reducción será pequeña. En ese caso no te obligamos a descargar un archivo más pesado.',
        },
        {
          q: '¿Qué nivel elijo para documentos con firma?',
          a: 'Usa "Ligera" o "Recomendada" y revisa la firma en la vista previa ampliada antes de descargar.',
        },
        {
          q: '¿Qué hace el nivel "Máxima"?',
          a: 'Convierte cada página en una imagen. Logra el menor tamaño, pero el texto deja de ser seleccionable. Úsalo solo si no necesitas copiar ni buscar texto.',
        },
      ],
      keywords: ['reducir', 'comprimir', 'achicar', 'bajar peso', 'optimizar', 'aligerar', 'compress', 'tamaño', 'pesa mucho'],
    },
    en: {
      name: 'Compress PDF',
      short: 'Reduce size with a before/after preview and the real final size.',
      title: 'Compress PDF free | PDF Libre',
      description: 'Reduce PDF size with several levels and a quality preview. No uploads.',
      h1: 'Compress PDF',
      intro: 'Choose a compression level and compare before and after: real final size and image quality before you download.',
      faq: [{ q: 'Why is my PDF barely smaller?', a: 'Compression works on images. Text-only PDFs are already small.' }],
      keywords: ['reduce', 'shrink', 'optimize', 'size'],
    },
  },
  {
    slug: 'organizar-pdf',
    category: 'organizar',
    icon: 'organize',
    status: 'ready',
    phase: 1,
    component: 'organize',
    es: {
      name: 'Organizar páginas',
      short: 'Rota, reordena y elimina páginas con miniaturas.',
      title: 'Organizar PDF: rotar, ordenar y eliminar páginas | PDF Libre',
      description:
        'Reordena páginas arrastrando las miniaturas, rótalas o elimina las que sobran. Gratis, en tu navegador, sin subir el PDF.',
      h1: 'Organizar páginas del PDF',
      intro: 'Arrastra las miniaturas para cambiar el orden, gira las páginas que estén de lado y elimina las que no necesites.',
      faq: [
        {
          q: '¿Puedo usarlo con el teclado?',
          a: 'Sí. Cada página tiene botones para mover, rotar y eliminar, y también puedes reordenar con Espacio y las flechas.',
        },
      ],
      keywords: ['ordenar', 'reordenar', 'rotar', 'girar', 'eliminar', 'borrar', 'quitar páginas', 'mover páginas'],
    },
    en: {
      name: 'Organize pages',
      short: 'Rotate, reorder and delete pages with thumbnails.',
      title: 'Organize PDF pages | PDF Libre',
      description: 'Reorder, rotate and delete PDF pages in your browser.',
      h1: 'Organize PDF pages',
      intro: 'Drag thumbnails to reorder, rotate sideways pages and delete the ones you do not need.',
      faq: [],
      keywords: ['reorder', 'rotate', 'delete', 'sort'],
    },
  },
  {
    slug: 'rotar-pdf',
    category: 'organizar',
    icon: 'rotate',
    status: 'ready',
    phase: 1,
    component: 'organize',
    preset: { focus: 'rotate' },
    es: {
      name: 'Rotar PDF',
      short: 'Gira una o todas las páginas de tu PDF.',
      title: 'Rotar PDF gratis: girar páginas | PDF Libre',
      description: 'Gira páginas de un PDF de forma individual o todas a la vez. Sin subir archivos y sin marcas de agua.',
      h1: 'Rotar PDF',
      intro: 'Gira las páginas que estén de lado o al revés, una por una o todas juntas.',
      faq: [{ q: '¿Puedo girar solo algunas páginas?', a: 'Sí, cada miniatura tiene sus propios botones para girar.' }],
      keywords: ['girar', 'voltear', 'rotar', 'de lado', 'al revés'],
    },
    en: {
      name: 'Rotate PDF',
      short: 'Rotate one or all pages.',
      title: 'Rotate PDF free | PDF Libre',
      description: 'Rotate PDF pages in your browser.',
      h1: 'Rotate PDF',
      intro: 'Rotate sideways or upside-down pages, individually or all at once.',
      faq: [],
      keywords: ['rotate', 'turn'],
    },
  },
  {
    slug: 'eliminar-paginas-pdf',
    category: 'organizar',
    icon: 'trash',
    status: 'ready',
    phase: 1,
    component: 'organize',
    preset: { focus: 'delete' },
    alias: true,
    es: {
      name: 'Eliminar páginas de un PDF',
      short: 'Quita las páginas que no necesitas.',
      title: 'Eliminar páginas de un PDF gratis | PDF Libre',
      description: 'Borra páginas de un PDF seleccionándolas con miniaturas. Sin subir archivos.',
      h1: 'Eliminar páginas de un PDF',
      intro: 'Toca las páginas que quieres quitar y descarga el PDF sin ellas.',
      faq: [],
      keywords: ['borrar', 'quitar', 'eliminar'],
    },
    en: {
      name: 'Delete PDF pages',
      short: 'Remove the pages you do not need.',
      title: 'Delete PDF pages | PDF Libre',
      description: 'Delete pages from a PDF in your browser.',
      h1: 'Delete PDF pages',
      intro: 'Select the pages to remove and download the PDF without them.',
      faq: [],
      keywords: ['delete', 'remove'],
    },
  },
  {
    slug: 'imagenes-a-pdf',
    category: 'convertir',
    icon: 'imageToPdf',
    status: 'ready',
    phase: 1,
    component: 'imagesToPdf',
    es: {
      name: 'Imágenes a PDF',
      short: 'JPG, PNG, HEIC o WEBP a PDF, con tamaño de página y márgenes.',
      title: 'Convertir imágenes a PDF (JPG, PNG, HEIC, WEBP) | PDF Libre',
      description:
        'Convierte fotos JPG, PNG, HEIC del iPhone o WEBP en un PDF. Elige tamaño de página, orientación y márgenes. Gratis y sin subir tus fotos.',
      h1: 'Imágenes a PDF',
      intro:
        'Convierte tus fotos e imágenes en un PDF. Funciona con las fotos HEIC del iPhone y respeta la orientación con la que las tomaste.',
      faq: [
        {
          q: '¿Funciona con fotos HEIC del iPhone?',
          a: 'Sí. Las fotos HEIC se convierten dentro de tu navegador, sin subirlas a ningún sitio.',
        },
        {
          q: '¿Puedo poner cada foto del tamaño de la página?',
          a: 'Sí. Elige "Ajustar a la imagen" para que cada página tenga exactamente el tamaño de su foto, o A4/Carta para un documento uniforme.',
        },
      ],
      keywords: ['jpg a pdf', 'png a pdf', 'heic a pdf', 'webp a pdf', 'foto a pdf', 'fotos', 'imagen', 'convertir imagen', 'jpeg'],
    },
    en: {
      name: 'Images to PDF',
      short: 'JPG, PNG, HEIC or WEBP to PDF with page size and margins.',
      title: 'Images to PDF (JPG, PNG, HEIC, WEBP) | PDF Libre',
      description: 'Convert JPG, PNG, HEIC or WEBP images to PDF in your browser.',
      h1: 'Images to PDF',
      intro: 'Turn your photos into a PDF. Works with iPhone HEIC photos and respects their orientation.',
      faq: [],
      keywords: ['jpg to pdf', 'png to pdf', 'heic to pdf', 'photo'],
    },
  },
  {
    slug: 'jpg-a-pdf',
    category: 'convertir',
    icon: 'imageToPdf',
    status: 'ready',
    phase: 1,
    component: 'imagesToPdf',
    alias: true,
    es: {
      name: 'JPG a PDF',
      short: 'Convierte fotos JPG en un PDF.',
      title: 'JPG a PDF gratis y sin subir fotos | PDF Libre',
      description: 'Convierte una o varias imágenes JPG en un PDF directamente en tu navegador. Sin límites ni marcas de agua.',
      h1: 'Convertir JPG a PDF',
      intro: 'Añade tus fotos JPG, ordénalas y crea un PDF en segundos.',
      faq: [],
      keywords: ['jpg', 'jpeg'],
    },
    en: {
      name: 'JPG to PDF',
      short: 'Convert JPG photos into a PDF.',
      title: 'JPG to PDF free | PDF Libre',
      description: 'Convert JPG images to PDF in your browser.',
      h1: 'JPG to PDF',
      intro: 'Add your JPG photos, reorder them and create a PDF.',
      faq: [],
      keywords: ['jpg'],
    },
  },
  {
    slug: 'pdf-a-imagenes',
    category: 'convertir',
    icon: 'pdfToImage',
    status: 'ready',
    phase: 1,
    component: 'pdfToImages',
    es: {
      name: 'PDF a imágenes',
      short: 'Convierte páginas a JPG o PNG eligiendo la resolución.',
      title: 'PDF a JPG o PNG en alta resolución | PDF Libre',
      description:
        'Convierte cada página de un PDF en una imagen JPG o PNG. Elige la resolución (hasta 300 ppp) y las páginas. Gratis y sin subir archivos.',
      h1: 'PDF a imágenes',
      intro: 'Convierte las páginas de tu PDF en imágenes JPG o PNG con la resolución que necesites.',
      faq: [
        {
          q: '¿Qué resolución elijo?',
          a: '72 ppp es suficiente para pantallas y redes sociales, 150 ppp para la mayoría de usos y 300 ppp para imprimir.',
        },
        { q: '¿JPG o PNG?', a: 'JPG pesa menos y es ideal para fotos. PNG conserva mejor el texto nítido y los gráficos.' },
      ],
      keywords: ['pdf a jpg', 'pdf a png', 'pdf a foto', 'pdf a imagen', 'exportar imagen', 'captura'],
    },
    en: {
      name: 'PDF to images',
      short: 'Convert pages to JPG or PNG with your chosen resolution.',
      title: 'PDF to JPG or PNG | PDF Libre',
      description: 'Convert PDF pages into JPG or PNG images in your browser.',
      h1: 'PDF to images',
      intro: 'Convert your PDF pages into JPG or PNG images at the resolution you need.',
      faq: [],
      keywords: ['pdf to jpg', 'pdf to png'],
    },
  },
  {
    slug: 'pdf-a-jpg',
    category: 'convertir',
    icon: 'pdfToImage',
    status: 'ready',
    phase: 1,
    component: 'pdfToImages',
    preset: { format: 'jpg' },
    alias: true,
    es: {
      name: 'PDF a JPG',
      short: 'Convierte un PDF en imágenes JPG.',
      title: 'PDF a JPG gratis, en alta calidad | PDF Libre',
      description: 'Convierte las páginas de un PDF en imágenes JPG en tu navegador, sin subir archivos.',
      h1: 'Convertir PDF a JPG',
      intro: 'Cada página de tu PDF se convierte en una imagen JPG.',
      faq: [],
      keywords: ['jpg'],
    },
    en: {
      name: 'PDF to JPG',
      short: 'Convert a PDF into JPG images.',
      title: 'PDF to JPG free | PDF Libre',
      description: 'Convert PDF pages to JPG.',
      h1: 'PDF to JPG',
      intro: 'Each page becomes a JPG image.',
      faq: [],
      keywords: ['jpg'],
    },
  },
  {
    slug: 'pdf-a-png',
    category: 'convertir',
    icon: 'pdfToImage',
    status: 'ready',
    phase: 1,
    component: 'pdfToImages',
    preset: { format: 'png' },
    alias: true,
    es: {
      name: 'PDF a PNG',
      short: 'Convierte un PDF en imágenes PNG.',
      title: 'PDF a PNG gratis, en alta calidad | PDF Libre',
      description: 'Convierte las páginas de un PDF en imágenes PNG nítidas en tu navegador, sin subir archivos.',
      h1: 'Convertir PDF a PNG',
      intro: 'Cada página de tu PDF se convierte en una imagen PNG.',
      faq: [],
      keywords: ['png'],
    },
    en: {
      name: 'PDF to PNG',
      short: 'Convert a PDF into PNG images.',
      title: 'PDF to PNG free | PDF Libre',
      description: 'Convert PDF pages to PNG.',
      h1: 'PDF to PNG',
      intro: 'Each page becomes a PNG image.',
      faq: [],
      keywords: ['png'],
    },
  },

  // ───────────── Fase 2 ─────────────
  tool('ocr-pdf', 'convertir', 'ocr', 'ocr', {
    es: {
      name: 'OCR: PDF buscable',
      short: 'Convierte escaneos y fotos en texto seleccionable, con revisión antes de exportar.',
      title: 'OCR en español gratis: PDF escaneado a texto | PDF Libre',
      description: 'Reconoce el texto de PDF escaneados y fotos (español e inglés) y crea un PDF buscable. Corrige el texto antes de descargar. Sin subir archivos.',
      h1: 'OCR: convierte un escaneo en PDF buscable',
      intro: 'Reconoce el texto de un PDF escaneado o de fotos. Revisa y corrige cada línea (los acentos incluidos) antes de crear el PDF buscable.',
      faq: [
        { q: '¿Reconoce bien los acentos y la ñ?', a: 'Sí. El OCR usa el modelo de español por defecto y puedes corregir cualquier línea antes de exportar. Las líneas dudosas se marcan en amarillo.' },
        { q: '¿Necesita internet?', a: 'Solo la primera vez, para descargar el motor y el idioma (unos 10 MB) desde este mismo sitio. Después funciona sin conexión.' },
        { q: '¿Cambia el aspecto de mi documento?', a: 'No. El texto reconocido se añade como una capa invisible sobre la página original: se ve igual, pero ahora puedes buscar y copiar.' },
      ],
      keywords: ['reconocer texto', 'escaneado', 'escanear', 'buscable', 'seleccionable', 'ocr', 'foto a texto', 'imagen a texto'],
    },
    en: {
      name: 'OCR: searchable PDF', short: 'Turn scans and photos into selectable text, reviewed before export.', title: 'OCR PDF | PDF Libre',
      description: 'Recognize text in scanned PDFs and photos and create a searchable PDF.', h1: 'OCR: make a scan searchable',
      intro: 'Recognize text in a scanned PDF or photos. Review and fix each line before creating the searchable PDF.', faq: [], keywords: ['ocr', 'scan'],
    },
  }),
  tool('pdf-a-word', 'convertir', 'word', 'pdfToText', {
    es: {
      name: 'PDF a Word',
      short: 'Exporta el texto a un .docx editable (diseño básico).',
      title: 'PDF a Word (.docx) gratis y sin subir archivos | PDF Libre',
      description: 'Convierte el texto de un PDF en un documento Word editable con títulos, párrafos y negritas. Vista previa antes de descargar. Gratis y privado.',
      h1: 'Convertir PDF a Word',
      intro: 'Extrae el texto de tu PDF a un documento .docx editable, con títulos, párrafos y negritas.',
      faq: [
        { q: '¿Se conserva el diseño exacto?', a: 'No siempre, y preferimos decírtelo antes: se conservan el texto, los párrafos, los títulos y las negritas, pero las columnas, tablas complejas e imágenes pueden perderse. Revisa la vista previa antes de descargar.' },
        { q: '¿Funciona con PDF escaneados?', a: 'Un escaneo es una imagen y no tiene texto. Usa primero la herramienta OCR y luego conviértelo a Word.' },
      ],
      keywords: ['docx', 'word', 'editable', 'doc', 'convertir a word'],
    },
    en: {
      name: 'PDF to Word', short: 'Export text to an editable .docx (basic layout).', title: 'PDF to Word | PDF Libre',
      description: 'Convert PDF text into an editable Word document.', h1: 'PDF to Word',
      intro: 'Extract your PDF text into an editable .docx with headings, paragraphs and bold.', faq: [], keywords: ['docx', 'word'],
    },
  }, { format: 'docx' }),
  tool('pdf-a-texto', 'convertir', 'text', 'pdfToText', {
    es: {
      name: 'PDF a texto',
      short: 'Extrae el texto plano, editable y listo para copiar.',
      title: 'PDF a texto (TXT) gratis | PDF Libre',
      description: 'Extrae todo el texto de un PDF a un archivo .txt. Edítalo o cópialo antes de descargar. Sin subir archivos.',
      h1: 'Extraer texto de un PDF',
      intro: 'Obtén el texto de tu PDF en orden de lectura. Puedes editarlo o copiarlo antes de descargar el .txt.',
      faq: [{ q: '¿Por qué no aparece texto?', a: 'Si el PDF es un escaneo, el texto es parte de una imagen. Usa la herramienta OCR para reconocerlo.' }],
      keywords: ['txt', 'copiar texto', 'extraer texto', 'texto plano'],
    },
    en: {
      name: 'PDF to text', short: 'Extract plain text, editable and ready to copy.', title: 'PDF to text | PDF Libre',
      description: 'Extract the text from a PDF into a .txt file.', h1: 'Extract text from PDF', intro: 'Get your PDF text in reading order.', faq: [], keywords: ['txt'],
    },
  }, { format: 'txt' }),
  tool('numerar-paginas', 'editar', 'numbers', 'pageNumbers', {
    es: {
      name: 'Numerar páginas',
      short: 'Añade números, encabezados y pies de página.',
      title: 'Numerar páginas de un PDF y añadir encabezado | PDF Libre',
      description: 'Añade números de página, encabezados y pies de página a tu PDF. Elige posición, formato y desde qué página empezar. Gratis y sin subir archivos.',
      h1: 'Numerar páginas y añadir encabezado o pie',
      intro: 'Elige dónde y cómo numerar, desde qué página empezar, y añade un encabezado o pie de página con texto propio.',
      faq: [
        { q: '¿Puedo no numerar la portada?', a: 'Sí. Indica "Empezar en la página 2" y elige con qué número comienza.' },
        { q: '¿Qué puedo poner en el encabezado?', a: 'Cualquier texto. Usa {n} para el número de página, {total} para el total y {fecha} para la fecha de hoy.' },
      ],
      keywords: ['paginar', 'números de página', 'encabezado', 'pie de página', 'foliar', 'enumerar'],
    },
    en: {
      name: 'Page numbers', short: 'Add numbers, headers and footers.', title: 'Add page numbers to PDF | PDF Libre',
      description: 'Add page numbers, headers and footers to a PDF.', h1: 'Page numbers, header and footer', intro: 'Choose where and how to number pages and add your own header or footer.', faq: [], keywords: ['numbers', 'header', 'footer'],
    },
  }),
  tool('firmar-pdf', 'editar', 'sign', 'sign', {
    es: {
      name: 'Firmar PDF',
      short: 'Dibuja, escribe o sube tu firma y colócala donde quieras.',
      title: 'Firmar PDF gratis: dibuja o sube tu firma | PDF Libre',
      description: 'Firma documentos PDF dibujando tu firma, escribiéndola o subiendo una imagen. Colócala y ajústala en cualquier página. Tu firma nunca sale de tu dispositivo.',
      h1: 'Firmar PDF',
      intro: 'Crea tu firma (dibujada, escrita o desde una foto) y colócala en las páginas que necesites.',
      faq: [
        { q: '¿Es una firma electrónica avanzada?', a: 'Es una firma visual (imagen de tu firma), válida para la mayoría de trámites cotidianos. No es una firma digital con certificado (como la e.firma del SAT o el DNIe).' },
        { q: '¿Puedo usar una foto de mi firma en papel?', a: 'Sí. Sube la foto y activa "Quitar fondo blanco" para que solo quede el trazo.' },
      ],
      keywords: ['firma', 'firmar', 'rubricar', 'firma digital', 'firma electrónica'],
    },
    en: {
      name: 'Sign PDF', short: 'Draw, type or upload your signature and place it anywhere.', title: 'Sign PDF | PDF Libre',
      description: 'Sign PDF documents by drawing, typing or uploading your signature.', h1: 'Sign PDF', intro: 'Create your signature and place it on the pages you need.', faq: [], keywords: ['sign', 'signature'],
    },
  }),
  tool('rellenar-formulario-pdf', 'editar', 'form', 'fillForm', {
    es: {
      name: 'Rellenar formularios',
      short: 'Completa los campos de un formulario PDF.',
      title: 'Rellenar formularios PDF gratis | PDF Libre',
      description: 'Completa formularios PDF rellenables desde el navegador, incluso en el celular. Opción para fijar las respuestas. Sin subir archivos.',
      h1: 'Rellenar un formulario PDF',
      intro: 'Completa los campos del formulario en una lista cómoda, incluso desde el celular, y revisa el resultado antes de descargar.',
      faq: [
        { q: '¿Qué significa "fijar las respuestas"?', a: 'Convierte los campos en texto normal: nadie podrá cambiarlos, y se verán igual en cualquier lector.' },
        { q: 'Mi PDF no muestra campos', a: 'Si el formulario es solo una imagen o un documento normal, no tiene campos interactivos. Puedes firmarlo con "Firmar PDF".' },
      ],
      keywords: ['formulario', 'llenar', 'completar', 'campos', 'solicitud'],
    },
    en: {
      name: 'Fill PDF forms', short: 'Fill in the fields of a PDF form.', title: 'Fill PDF forms | PDF Libre',
      description: 'Fill in PDF forms in your browser.', h1: 'Fill a PDF form', intro: 'Fill in form fields comfortably, even on your phone.', faq: [], keywords: ['form', 'fill'],
    },
  }),
  tool('proteger-pdf', 'seguridad', 'lock', 'protect', {
    es: {
      name: 'Proteger con contraseña',
      short: 'Cifra tu PDF con AES-256 y limita impresión o copia.',
      title: 'Proteger PDF con contraseña (AES-256) | PDF Libre',
      description: 'Pon contraseña a tu PDF con cifrado AES-256 y decide si se puede imprimir o copiar. La contraseña nunca sale de tu dispositivo.',
      h1: 'Proteger PDF con contraseña',
      intro: 'Cifra tu PDF con AES-256: solo podrá abrirse con la contraseña. También puedes impedir que se imprima o se copie el texto.',
      faq: [
        { q: '¿Qué pasa si olvido la contraseña?', a: 'No hay forma de recuperarla: ni nosotros la conocemos, porque nunca sale de tu dispositivo. Guárdala en un lugar seguro.' },
        { q: '¿Qué tan seguro es?', a: 'Usamos AES-256, el cifrado más fuerte que admite el formato PDF. La seguridad depende sobre todo de que la contraseña sea larga.' },
      ],
      keywords: ['contraseña', 'cifrar', 'encriptar', 'clave', 'bloquear', 'proteger'],
    },
    en: {
      name: 'Protect PDF', short: 'Encrypt with AES-256 and restrict printing or copying.', title: 'Protect PDF with password | PDF Libre',
      description: 'Encrypt your PDF with AES-256.', h1: 'Protect PDF with a password', intro: 'Encrypt your PDF so it only opens with the password.', faq: [], keywords: ['password', 'encrypt'],
    },
  }),
  tool('desbloquear-pdf', 'seguridad', 'unlock', 'unlock', {
    es: {
      name: 'Quitar contraseña',
      short: 'Si conoces la contraseña, guarda una copia sin ella.',
      title: 'Quitar contraseña a un PDF (si la conoces) | PDF Libre',
      description: 'Elimina la contraseña de un PDF del que conoces la clave y obtén una copia sin protección. En tu navegador, sin subir el documento.',
      h1: 'Quitar la contraseña de un PDF',
      intro: 'Escribe la contraseña del PDF y obtén una copia que se abre sin pedirla. También quita las restricciones de impresión y copia.',
      faq: [
        { q: '¿Pueden descifrar un PDF sin la contraseña?', a: 'No. Esta herramienta es para quien ya conoce la contraseña y no quiere escribirla cada vez.' },
      ],
      keywords: ['desbloquear', 'quitar contraseña', 'eliminar contraseña', 'desproteger', 'desencriptar'],
    },
    en: {
      name: 'Unlock PDF', short: 'If you know the password, save a copy without it.', title: 'Unlock PDF | PDF Libre',
      description: 'Remove the password from a PDF you know the password of.', h1: 'Remove a PDF password', intro: 'Enter the password and get a copy that opens without it.', faq: [], keywords: ['unlock', 'decrypt'],
    },
  }),
  tool('ocultar-datos-pdf', 'seguridad', 'redact', 'redact', {
    es: {
      name: 'Ocultar datos sensibles',
      short: 'Redacción real: el texto tapado se elimina del archivo.',
      title: 'Ocultar datos de un PDF (redacción real) | PDF Libre',
      description: 'Tacha datos sensibles de un PDF de verdad: el texto oculto se elimina del archivo, no solo se cubre. Busca correos, teléfonos o cualquier palabra. Sin subir archivos.',
      h1: 'Ocultar datos sensibles (redacción real)',
      intro: 'Marca zonas a mano o busca palabras, correos y teléfonos. Lo que ocultes se elimina del archivo: no basta con poner un rectángulo negro encima.',
      faq: [
        { q: '¿Por qué no basta con un rectángulo negro?', a: 'Porque el texto sigue debajo y se puede copiar o buscar. Aquí, las páginas con datos ocultos se rehacen como imagen con las zonas ya en negro: el texto original deja de existir. Al terminar verificamos que no queda rastro.' },
        { q: '¿Las páginas siguen siendo buscables?', a: 'Las páginas sin cambios, sí. En las páginas con datos ocultos puedes activar el OCR para recuperar el texto visible que no tapaste.' },
      ],
      keywords: ['tachar', 'censurar', 'redactar', 'anonimizar', 'borrar datos', 'ocultar', 'datos personales'],
    },
    en: {
      name: 'Redact PDF', short: 'True redaction: hidden text is removed from the file.', title: 'Redact PDF | PDF Libre',
      description: 'Redact sensitive data from a PDF for real.', h1: 'Redact sensitive data', intro: 'Mark areas or search for words; what you hide is removed from the file.', faq: [], keywords: ['redact'],
    },
  }),
  tool('eliminar-metadatos-pdf', 'seguridad', 'metadata', 'metadata', {
    es: {
      name: 'Eliminar metadatos',
      short: 'Mira y borra autor, fechas y software ocultos en el PDF.',
      title: 'Eliminar metadatos de un PDF (autor, fechas) | PDF Libre',
      description: 'Descubre qué datos ocultos guarda tu PDF (autor, empresa, fechas, programa usado) y bórralos antes de compartirlo. Gratis y sin subir archivos.',
      h1: 'Eliminar metadatos de un PDF',
      intro: 'Mira qué información oculta guarda tu PDF —autor, fechas, programa usado— y elimínala antes de compartirlo.',
      faq: [{ q: '¿Qué son los metadatos?', a: 'Datos que los programas guardan dentro del PDF sin que se vean: quién lo creó, cuándo, con qué programa, y a veces el nombre de la empresa o de la computadora.' }],
      keywords: ['metadatos', 'autor', 'privacidad', 'propiedades', 'datos ocultos', 'anonimizar'],
    },
    en: {
      name: 'Remove metadata', short: 'See and remove author, dates and software.', title: 'Remove PDF metadata | PDF Libre',
      description: 'See and remove hidden PDF metadata.', h1: 'Remove PDF metadata', intro: 'See what hidden information your PDF contains and remove it.', faq: [], keywords: ['metadata'],
    },
  }),
  tool('encabezado-pie-pagina-pdf', 'editar', 'numbers', 'pageNumbers', {
    es: {
      name: 'Encabezado y pie de página',
      short: 'Añade un encabezado o pie a todas las páginas.',
      title: 'Añadir encabezado y pie de página a un PDF | PDF Libre',
      description: 'Añade un encabezado o pie de página con tu texto, número de página y fecha. Gratis y sin subir archivos.',
      h1: 'Añadir encabezado y pie de página',
      intro: 'Escribe el texto del encabezado o pie, con número de página y fecha si quieres.',
      faq: [],
      keywords: ['encabezado', 'pie de página', 'membrete'],
    },
    en: {
      name: 'Header and footer', short: 'Add a header or footer to every page.', title: 'Add header and footer | PDF Libre',
      description: 'Add a header or footer to a PDF.', h1: 'Add header and footer', intro: 'Type your header or footer text.', faq: [], keywords: ['header', 'footer'],
    },
  }, { focus: 'header' }, true),

  // ───────────── Fase 3 ─────────────
  tool('heic-a-jpg', 'convertir', 'image', 'imageConvert', {
    es: {
      name: 'HEIC a JPG',
      short: 'Convierte las fotos del iPhone a JPG, en lote.',
      title: 'HEIC a JPG: convertir fotos del iPhone gratis | PDF Libre',
      description: 'Convierte fotos HEIC del iPhone a JPG (o PNG) en tu navegador, varias a la vez, sin subirlas a internet. Elige calidad y tamaño.',
      h1: 'Convertir HEIC a JPG',
      intro: 'Pasa tus fotos HEIC del iPhone a JPG para abrirlas en cualquier computadora o app. Puedes convertir muchas a la vez.',
      faq: [
        { q: '¿Por qué mis fotos del iPhone son HEIC?', a: 'Es el formato que usa el iPhone para ahorrar espacio. Muchas computadoras y páginas web no lo abren, por eso conviene pasarlas a JPG.' },
        { q: '¿Pierden calidad?', a: 'Con calidad 90% la diferencia no se nota. Si necesitas la máxima calidad, elige PNG (sin pérdida, pero más pesado).' },
        { q: '¿Se conservan las fotos derechas?', a: 'Sí, se aplica la orientación con la que tomaste la foto.' },
      ],
      keywords: ['heic', 'iphone', 'heif', 'fotos iphone', 'convertir heic', 'abrir heic'],
    },
    en: {
      name: 'HEIC to JPG', short: 'Convert iPhone photos to JPG, in batch.', title: 'HEIC to JPG | PDF Libre',
      description: 'Convert iPhone HEIC photos to JPG in your browser.', h1: 'Convert HEIC to JPG', intro: 'Turn iPhone HEIC photos into JPG. Convert many at once.', faq: [], keywords: ['heic', 'iphone'],
    },
  }, { format: 'jpg' }, false, 3),
  tool('convertir-imagenes', 'convertir', 'image', 'imageConvert', {
    es: {
      name: 'Convertir imágenes',
      short: 'Entre JPG, PNG y WEBP, con calidad y tamaño a elegir.',
      title: 'Convertir imágenes: JPG, PNG, WEBP, HEIC | PDF Libre',
      description: 'Convierte imágenes entre JPG, PNG y WEBP (también desde HEIC, GIF, BMP y AVIF). Ajusta calidad y tamaño. En lote y sin subir archivos.',
      h1: 'Convertir imágenes',
      intro: 'Convierte una o muchas imágenes a JPG, PNG o WEBP. También puedes reducir su tamaño para enviarlas más rápido.',
      faq: [{ q: '¿Qué formato elijo?', a: 'JPG para fotos y máxima compatibilidad; PNG para capturas, logos o si necesitas transparencia; WEBP para web (pesa menos, pero Safari no puede crearlo).' }],
      keywords: ['webp', 'png', 'jpg', 'jpeg', 'convertir foto', 'cambiar formato', 'reducir imagen', 'redimensionar', 'avif', 'gif', 'bmp'],
    },
    en: {
      name: 'Convert images', short: 'Between JPG, PNG and WEBP with quality and size options.', title: 'Convert images | PDF Libre',
      description: 'Convert images between JPG, PNG and WEBP.', h1: 'Convert images', intro: 'Convert one or many images to JPG, PNG or WEBP.', faq: [], keywords: ['webp', 'png', 'jpg'],
    },
  }, undefined, false, 3),
  tool('webp-a-jpg', 'convertir', 'image', 'imageConvert', {
    es: {
      name: 'WEBP a JPG', short: 'Convierte imágenes WEBP a JPG.', title: 'WEBP a JPG gratis y sin subir archivos | PDF Libre',
      description: 'Convierte imágenes WEBP a JPG en tu navegador, varias a la vez.', h1: 'Convertir WEBP a JPG', intro: 'Pasa imágenes WEBP a JPG para abrirlas en cualquier programa.', faq: [], keywords: ['webp'],
    },
    en: { name: 'WEBP to JPG', short: 'Convert WEBP images to JPG.', title: 'WEBP to JPG | PDF Libre', description: 'Convert WEBP to JPG.', h1: 'WEBP to JPG', intro: 'Convert WEBP images to JPG.', faq: [], keywords: ['webp'] },
  }, { format: 'jpg' }, true, 3),
  tool('jpg-a-png', 'convertir', 'image', 'imageConvert', {
    es: {
      name: 'JPG a PNG', short: 'Convierte imágenes JPG a PNG.', title: 'JPG a PNG gratis | PDF Libre',
      description: 'Convierte imágenes JPG a PNG sin pérdida, en tu navegador.', h1: 'Convertir JPG a PNG', intro: 'Pasa imágenes JPG a PNG.', faq: [], keywords: ['png'],
    },
    en: { name: 'JPG to PNG', short: 'Convert JPG images to PNG.', title: 'JPG to PNG | PDF Libre', description: 'Convert JPG to PNG.', h1: 'JPG to PNG', intro: 'Convert JPG images to PNG.', faq: [], keywords: ['png'] },
  }, { format: 'png' }, true, 3),
  tool('escanear-documento', 'avanzado', 'camera', 'scan', {
    es: {
      name: 'Escanear con la cámara',
      short: 'Detecta bordes, endereza, mejora el contraste y crea un PDF.',
      title: 'Escanear documentos con el celular a PDF | PDF Libre',
      description: 'Usa la cámara del celular como escáner: detecta los bordes, corrige la perspectiva, mejora el contraste y crea un PDF de varias páginas. Sin apps ni registro.',
      h1: 'Escanear documentos con la cámara',
      intro: 'Toma fotos de tus documentos: detectamos los bordes, enderezamos la hoja y mejoramos el contraste para que se lean como un escaneo.',
      faq: [
        { q: '¿Necesito instalar una app?', a: 'No. Funciona en el navegador del celular. Si lo prefieres, puedes instalar PDF Libre en la pantalla de inicio desde el menú del navegador.' },
        { q: '¿Cómo consigo el mejor resultado?', a: 'Coloca la hoja sobre una superficie oscura, con buena luz y sin sombras fuertes. Si los bordes no se detectan bien, arrastra las esquinas.' },
        { q: '¿Puedo buscar texto en el PDF?', a: 'Sí: activa "Hacer el texto buscable" y aplicaremos OCR en español.' },
      ],
      keywords: ['escáner', 'escanear', 'cámara', 'foto a pdf', 'celular', 'documento', 'scanner'],
    },
    en: {
      name: 'Scan with camera', short: 'Detect edges, straighten, enhance and create a PDF.', title: 'Scan documents with your phone | PDF Libre',
      description: 'Use your phone camera as a scanner.', h1: 'Scan documents with your camera', intro: 'Take photos of documents; we detect edges, straighten and enhance them.', faq: [], keywords: ['scan', 'camera'],
    },
  }, undefined, false, 3),
  tool('comparar-pdf', 'avanzado', 'compare', 'compare', {
    es: {
      name: 'Comparar PDF',
      short: 'Resalta las diferencias de texto entre dos versiones.',
      title: 'Comparar dos PDF y ver las diferencias | PDF Libre',
      description: 'Compara dos versiones de un PDF y resalta qué texto se añadió o se eliminó, palabra por palabra. Descarga ambos PDF marcados. Sin subir archivos.',
      h1: 'Comparar dos PDF',
      intro: 'Sube la versión original y la nueva: verás palabra por palabra qué se añadió (verde) y qué se eliminó (rojo).',
      faq: [
        { q: '¿Compara también imágenes o diseño?', a: 'No: compara el texto. Es ideal para contratos, documentos legales y versiones de un mismo informe.' },
        { q: '¿Funciona con escaneos?', a: 'Primero conviértelos con la herramienta OCR para que tengan texto.' },
      ],
      keywords: ['comparar', 'diferencias', 'cambios', 'versiones', 'contrato', 'diff'],
    },
    en: {
      name: 'Compare PDF', short: 'Highlight text differences between two versions.', title: 'Compare two PDFs | PDF Libre',
      description: 'Compare two PDF versions and highlight text changes.', h1: 'Compare two PDFs', intro: 'See word by word what was added (green) and removed (red).', faq: [], keywords: ['compare', 'diff'],
    },
  }, undefined, false, 3),
  tool('procesar-por-lotes', 'avanzado', 'batch', 'batch', {
    es: {
      name: 'Procesar por lotes',
      short: 'Aplica una acción a muchos PDF y descarga un ZIP.',
      title: 'Procesar PDF por lotes: comprimir, numerar y más | PDF Libre',
      description: 'Comprime, numera, rota, protege o limpia metadatos de muchos PDF a la vez y descárgalos en un ZIP. Sin límites y sin subir archivos.',
      h1: 'Procesar PDF por lotes',
      intro: 'Elige una acción y aplícala a todos tus PDF de una vez. Los resultados se descargan juntos en un ZIP.',
      faq: [{ q: '¿Cuántos archivos puedo procesar?', a: 'Los que quieras: no hay límites artificiales. Se procesan uno tras otro para no saturar tu dispositivo.' }],
      keywords: ['lote', 'lotes', 'masivo', 'muchos archivos', 'zip', 'varios pdf', 'batch'],
    },
    en: {
      name: 'Batch processing', short: 'Apply one action to many PDFs and get a ZIP.', title: 'Batch process PDFs | PDF Libre',
      description: 'Apply one action to many PDFs.', h1: 'Batch process PDFs', intro: 'Choose an action and apply it to all your PDFs at once.', faq: [], keywords: ['batch'],
    },
  }, undefined, false, 3),
  tool('flujos', 'avanzado', 'flow', 'flows', {
    es: {
      name: 'Flujos',
      short: 'Encadena acciones (unir → comprimir → numerar) y guárdalas.',
      title: 'Flujos de trabajo PDF: encadena acciones | PDF Libre',
      description: 'Crea flujos que encadenan acciones (unir, comprimir, numerar, proteger…) y reutilízalos con un clic. Se guardan solo en tu dispositivo.',
      h1: 'Flujos: encadena acciones',
      intro: 'Crea una receta de pasos (por ejemplo: unir → numerar → comprimir) y úsala siempre que quieras con nuevos archivos.',
      faq: [{ q: '¿Dónde se guardan mis flujos?', a: 'Solo en este navegador. Se guarda la receta, nunca tus archivos ni tus contraseñas.' }],
      keywords: ['flujo', 'automatizar', 'encadenar', 'receta', 'workflow', 'acciones'],
    },
    en: {
      name: 'Workflows', short: 'Chain actions and save them for reuse.', title: 'PDF workflows | PDF Libre',
      description: 'Chain PDF actions and reuse them.', h1: 'Workflows', intro: 'Create a recipe of steps and reuse it with new files.', faq: [], keywords: ['workflow'],
    },
  }, undefined, false, 3),
];

export const readyTools = () => TOOLS.filter((t) => t.status === 'ready');

export const findTool = (slug: string) => TOOLS.find((t) => t.slug === slug && t.status === 'ready');

/** Normaliza para buscar sin acentos ni mayúsculas */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export function searchTools(query: string, lang: Lang, list: ToolDef[] = TOOLS): ToolDef[] {
  const q = normalize(query);
  if (!q) return list;
  const terms = q.split(/\s+/);
  return list
    .map((t) => {
      const text = t[lang];
      const hay = normalize(
        [text.name, text.short, ...text.keywords, ...t.es.keywords, t.es.name, t.slug.replace(/-/g, ' ')].join(' '),
      );
      const name = normalize(text.name);
      let score = 0;
      for (const term of terms) {
        if (!hay.includes(term)) return { t, score: -1 };
        score += name.includes(term) ? 3 : 1;
      }
      if (t.status === 'ready') score += 1;
      return { t, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
