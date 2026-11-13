/** Flujos guardados en este dispositivo (localStorage). Solo la configuración: nunca archivos ni contraseñas. */
import { EXAMPLE_FLOWS, type Flow } from './steps';

const KEY = 'pdflibre.flows';

export function loadFlows(): Flow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return EXAMPLE_FLOWS;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((f) => f && typeof f.name === 'string' && Array.isArray(f.steps)) : [];
  } catch {
    return EXAMPLE_FLOWS;
  }
}

export function saveFlows(flows: Flow[]): boolean {
  try {
    // Por seguridad, se eliminan campos inesperados (p. ej. una contraseña) antes de guardar
    const clean = flows.map((f) => ({
      id: f.id,
      name: f.name.slice(0, 80),
      mergeFirst: f.mergeFirst,
      steps: f.steps.map((s) => {
        const { password: _p, ...rest } = s as typeof s & { password?: string };
        return rest;
      }),
    }));
    localStorage.setItem(KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export const newFlowId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
