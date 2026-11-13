import { ArrowDown, ArrowUp, Copy, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n, useL } from '../../i18n/I18nProvider';
import type { ToolProps } from '../types';
import { FlowRunner } from './FlowRunner';
import { StepEditor } from './StepEditor';
import { STEP_DEFAULTS, STEP_LABEL, STEP_ORDER, validateFlow, type Flow, type Step, type StepType } from './steps';
import { loadFlows, newFlowId, saveFlows } from './storage';

/** Encadenar acciones, guardarlas en el dispositivo y reutilizarlas */
export default function FlowsTool(_: ToolProps) {
  const L = useL();
  const { lang } = useI18n();
  const [flows, setFlows] = useState<Flow[]>(loadFlows);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [running, setRunning] = useState<Flow | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  const persist = (next: Flow[]) => {
    setFlows(next);
    setSavedMsg(saveFlows(next) ? L('Guardado en este dispositivo.', 'Saved on this device.') : L('No se pudo guardar (almacenamiento bloqueado).', 'Could not save (storage blocked).'));
  };

  if (running) {
    return (
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <Play className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{running.name}</p>
            <p className="text-sm muted">{describe(running, lang)}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => setRunning(null)}>
            {L('Cambiar de flujo', 'Change workflow')}
          </button>
        </div>
        <FlowRunner flow={running} actionLabel={L('Ejecutar flujo', 'Run workflow')} zipName={`${running.name.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.zip`} />
      </div>
    );
  }

  if (editing) {
    const invalid = validateFlow(editing.steps);
    const setSteps = (steps: Step[]) => setEditing({ ...editing, steps });
    const move = (i: number, d: -1 | 1) => {
      const s = [...editing.steps];
      const j = i + d;
      if (j < 0 || j >= s.length) return;
      [s[i], s[j]] = [s[j], s[i]];
      setSteps(s);
    };
    return (
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="flow-name">
            {L('Nombre del flujo', 'Workflow name')}
          </label>
          <input id="flow-name" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={80} />
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={editing.mergeFirst} onChange={(e) => setEditing({ ...editing, mergeFirst: e.target.checked })} />
          <span>
            {L('Unir todos los archivos en uno antes de empezar', 'Merge all files into one first')}
            <span className="block text-sm muted">{L('Si no, cada archivo se procesa por separado y se descargan en un ZIP.', 'Otherwise each file is processed separately and downloaded in a ZIP.')}</span>
          </span>
        </label>
        <ol className="space-y-3" aria-label={L('Pasos', 'Steps')}>
          {editing.steps.map((s, i) => (
            <li key={i} className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{i + 1}</span>
                <span className="flex-1 font-semibold">{STEP_LABEL[s.type][lang]}</span>
                <button type="button" className="btn-icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${L('Subir', 'Move up')}: ${STEP_LABEL[s.type][lang]}`}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="btn-icon-sm" disabled={i === editing.steps.length - 1} onClick={() => move(i, 1)} aria-label={`${L('Bajar', 'Move down')}: ${STEP_LABEL[s.type][lang]}`}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="btn-icon-sm" onClick={() => setSteps(editing.steps.filter((_, k) => k !== i))} aria-label={`${L('Quitar paso', 'Remove step')}: ${STEP_LABEL[s.type][lang]}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <StepEditor step={s} idPrefix={`s${i}`} onChange={(n) => setSteps(editing.steps.map((x, k) => (k === i ? n : x)))} />
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="add-step" className="text-sm font-semibold">
            {L('Añadir paso', 'Add step')}
          </label>
          <select
            id="add-step"
            className="input w-auto"
            value=""
            onChange={(e) => {
              const t = e.target.value as StepType;
              if (!t) return;
              // Quitar contraseña siempre al principio; proteger siempre al final
              const s = STEP_DEFAULTS[t];
              setSteps(insertStep(editing.steps, s));
            }}
          >
            <option value="">{L('— Elegir —', '— Choose —')}</option>
            {STEP_ORDER.map((t) => (
              <option key={t} value={t}>
                {STEP_LABEL[t][lang]}
              </option>
            ))}
          </select>
        </div>
        {invalid && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{invalid[lang]}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!!invalid || !editing.name.trim()}
            onClick={() => {
              const exists = flows.some((f) => f.id === editing.id);
              persist(exists ? flows.map((f) => (f.id === editing.id ? editing : f)) : [...flows, editing]);
              setEditing(null);
            }}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {L('Guardar flujo', 'Save workflow')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
            {L('Cancelar', 'Cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm muted">{L('Tus flujos se guardan solo en este navegador. Nunca se guardan archivos ni contraseñas.', 'Workflows are saved only in this browser. Files and passwords are never saved.')}</p>
      {savedMsg && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {savedMsg}
        </p>
      )}
      <ul className="space-y-2" data-testid="flow-list">
        {flows.map((f) => (
          <li key={f.id} className="card flex flex-wrap items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{f.name}</p>
              <p className="text-sm muted">{describe(f, lang)}</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setRunning(f)} aria-label={`${L('Usar', 'Use')}: ${f.name}`}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {L('Usar', 'Use')}
            </button>
            <button type="button" className="btn-icon-sm" onClick={() => setEditing(f)} aria-label={`${L('Editar', 'Edit')}: ${f.name}`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="btn-icon-sm" onClick={() => persist([...flows, { ...f, id: newFlowId(), name: `${f.name} (${L('copia', 'copy')})` }])} aria-label={`${L('Duplicar', 'Duplicate')}: ${f.name}`}>
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="btn-icon-sm text-red-600" onClick={() => persist(flows.filter((x) => x.id !== f.id))} aria-label={`${L('Eliminar', 'Delete')}: ${f.name}`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {flows.length === 0 && <p className="text-sm muted">{L('Aún no tienes flujos guardados.', 'No saved workflows yet.')}</p>}
      <button type="button" className="btn-secondary" onClick={() => setEditing({ id: newFlowId(), name: L('Mi flujo', 'My workflow'), mergeFirst: false, steps: [] })}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {L('Crear flujo', 'Create workflow')}
      </button>
    </div>
  );
}

function describe(f: Flow, lang: 'es' | 'en') {
  const steps = f.steps.map((s) => STEP_LABEL[s.type][lang]);
  if (f.mergeFirst) steps.unshift(lang === 'es' ? 'Unir' : 'Merge');
  return steps.join(' → ');
}

/** Inserta un paso respetando las reglas: quitar contraseña va primero y proteger va al final (sin duplicarlos) */
export function insertStep(steps: Step[], s: Step): Step[] {
  const rest = steps.filter((x) => x.type !== s.type || (s.type !== 'unlock' && s.type !== 'protect'));
  if (s.type === 'unlock') return [s, ...rest];
  const protect = rest.filter((x) => x.type === 'protect');
  const others = rest.filter((x) => x.type !== 'protect');
  return s.type === 'protect' ? [...others, s] : [...others, s, ...protect];
}
