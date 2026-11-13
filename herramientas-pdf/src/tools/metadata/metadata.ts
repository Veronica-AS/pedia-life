import { PDFDict, PDFName, PDFRawStream, PDFRef, PDFString, PDFHexString, type PDFDocument } from 'pdf-lib';
import { loadPdf, saveOptions } from '../../lib/pdf';

export interface MetadataInfo {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  /** Otras claves presentes en el diccionario Info (p. ej. datos de la empresa) */
  extra: { key: string; value: string }[];
  /** Hay metadatos XMP (XML) incrustados en el documento */
  hasXmp: boolean;
  /** Páginas con metadatos o datos de aplicación propios */
  pageMetadata: number;
}

const STD = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const ref = doc.context.trailerInfo.Info;
  const obj = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
  return obj instanceof PDFDict ? obj : undefined;
}

function decode(v: unknown): string {
  if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText();
  if (v instanceof PDFName) return v.decodeText();
  return v ? String(v) : '';
}

const iso = (d: Date | undefined) => (d && !isNaN(d.getTime()) ? d.toISOString() : undefined);

export function readMetadataFrom(doc: PDFDocument): MetadataInfo {
  const info = infoDict(doc);
  const extra: { key: string; value: string }[] = [];
  if (info) {
    for (const [k, v] of info.entries()) {
      const key = k.decodeText();
      if (!STD.includes(key)) extra.push({ key, value: decode(doc.context.lookup(v)).slice(0, 200) });
    }
  }
  const safe = <T,>(fn: () => T) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  const pageMetadata = doc.getPages().filter((p) => p.node.get(PDFName.of('Metadata')) || p.node.get(PDFName.of('PieceInfo'))).length;
  return {
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
    creationDate: iso(safe(() => doc.getCreationDate())),
    modDate: iso(safe(() => doc.getModificationDate())),
    extra,
    hasXmp: !!doc.catalog.get(PDFName.of('Metadata')),
    pageMetadata,
  };
}

export async function readMetadata(bytes: Uint8Array): Promise<MetadataInfo> {
  return readMetadataFrom(await loadPdf(bytes));
}

export interface MetadataEdits {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}

/**
 * Elimina todos los metadatos (Info, XMP, metadatos por página, PieceInfo) y,
 * opcionalmente, escribe los valores que el usuario quiera conservar.
 */
export async function cleanMetadata(bytes: Uint8Array, keep: MetadataEdits = {}): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const info = infoDict(doc);
  if (info) for (const k of [...info.keys()]) info.delete(k);
  else doc.context.trailerInfo.Info = doc.context.register(doc.context.obj({}));

  const xmp = doc.catalog.get(PDFName.of('Metadata'));
  doc.catalog.delete(PDFName.of('Metadata'));
  if (xmp instanceof PDFRef) doc.context.delete(xmp);
  doc.catalog.delete(PDFName.of('PieceInfo'));
  for (const p of doc.getPages()) {
    p.node.delete(PDFName.of('Metadata'));
    p.node.delete(PDFName.of('PieceInfo'));
  }
  // Metadatos XMP sueltos en otros objetos (imágenes, fuentes…)
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Type')) !== PDFName.of('Metadata')) obj.dict.delete(PDFName.of('Metadata'));
  }
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Type')) === PDFName.of('Metadata')) doc.context.delete(ref);
  }
  doc.context.trailerInfo.ID = undefined;

  if (keep.title) doc.setTitle(keep.title);
  if (keep.author) doc.setAuthor(keep.author);
  if (keep.subject) doc.setSubject(keep.subject);
  if (keep.keywords) doc.setKeywords([keep.keywords]);
  return doc.save({ ...saveOptions, updateFieldAppearances: false });
}
