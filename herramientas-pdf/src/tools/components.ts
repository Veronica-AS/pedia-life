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
};
