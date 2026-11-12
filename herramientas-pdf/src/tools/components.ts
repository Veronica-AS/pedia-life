import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ComponentId } from './registry';
import type { ToolProps } from './types';

/** Cada herramienta se descarga solo cuando el usuario la abre (lazy loading) */
export const TOOL_COMPONENTS: Record<ComponentId, LazyExoticComponent<ComponentType<ToolProps>>> = {
  merge: lazy(() => import('./merge/MergeTool')),
  split: lazy(() => import('./split/SplitTool')),
  compress: lazy(() => import('./compress/CompressTool')),
  organize: lazy(() => import('./organize/OrganizeTool')),
  imagesToPdf: lazy(() => import('./images-to-pdf/ImagesToPdfTool')),
  pdfToImages: lazy(() => import('./pdf-to-images/PdfToImagesTool')),
  ocr: lazy(() => import('./ocr/OcrTool')),
  pdfToText: lazy(() => import('./pdf-to-text/PdfToTextTool')),
  pageNumbers: lazy(() => import('./page-numbers/PageNumbersTool')),
  sign: lazy(() => import('./sign/SignTool')),
  fillForm: lazy(() => import('./fill-form/FillFormTool')),
  protect: lazy(() => import('./protect/ProtectTool')),
  unlock: lazy(() => import('./protect/UnlockTool')),
  redact: lazy(() => import('./redact/RedactTool')),
  metadata: lazy(() => import('./metadata/MetadataTool')),
};
