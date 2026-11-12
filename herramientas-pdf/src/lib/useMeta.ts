import { useEffect } from 'react';

/** Actualiza título y descripción al navegar entre herramientas (el HTML inicial ya viene prerenderizado) */
export function useMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [title, description]);
}
