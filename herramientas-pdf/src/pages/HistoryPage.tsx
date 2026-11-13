import { Download, History, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, useL } from '../i18n/I18nProvider';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/format';
import { clearHistory, deleteHistory, historyEnabled, listHistory, setHistoryEnabled, type HistoryEntry } from '../lib/history';
import { useMeta } from '../lib/useMeta';
import { findTool } from '../tools/registry';

export default function HistoryPage() {
  const L = useL();
  const { lang } = useI18n();
  useMeta(L('Historial local | PDF Libre', 'Local history | PDF Libre'), L('Tus archivos recientes, guardados solo en este dispositivo.', 'Your recent files, stored only on this device.'));
  const [enabled, setEnabled] = useState(historyEnabled);
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = () =>
    listHistory().then(setItems, () => {
      setUnavailable(true);
      setItems([]);
    });
  useEffect(() => {
    refresh();
  }, []);

  const total = (items ?? []).reduce((s, i) => s + i.size, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <History className="h-7 w-7" aria-hidden="true" />
        {L('Historial local', 'Local history')}
      </h1>
      <p className="muted">
        {L(
          'Si lo activas, cada archivo que descargues se guarda también en este navegador (IndexedDB) para que puedas volver a bajarlo. No se envía a ningún sitio y puedes borrarlo cuando quieras. Se conservan los 50 más recientes (máx. 300 MB).',
          'If enabled, every file you download is also stored in this browser (IndexedDB) so you can download it again. It is never sent anywhere and you can delete it any time. The 50 most recent are kept (max 300 MB).',
        )}
      </p>
      <label className="card flex min-h-[56px] cursor-pointer items-center justify-between gap-4 p-4">
        <span className="font-semibold">{L('Guardar mis descargas en este dispositivo', 'Keep my downloads on this device')}</span>
        <input
          type="checkbox"
          role="switch"
          className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-300 transition before:block before:h-5 before:w-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-brand-600 checked:before:translate-x-[22px] dark:bg-slate-600"
          checked={enabled}
          onChange={(e) => {
            setHistoryEnabled(e.target.checked);
            setEnabled(e.target.checked);
          }}
          aria-describedby="hist-state"
        />
      </label>
      <p id="hist-state" className="text-sm muted" role="status">
        {enabled ? L('Activado: las próximas descargas se guardarán aquí.', 'On: next downloads will be stored here.') : L('Desactivado: no se guarda nada.', 'Off: nothing is stored.')}
      </p>
      {unavailable && <p className="text-sm text-amber-800 dark:text-amber-300">{L('Este navegador no permite guardar datos (¿modo privado?).', 'This browser does not allow storing data (private mode?).')}</p>}

      {items && items.length > 0 && (
        <section aria-labelledby="hist-list" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="hist-list" className="font-semibold">
              {L('{n} archivo(s) · {size}', '{n} file(s) · {size}', { n: items.length, size: formatBytes(total, lang) })}
            </h2>
            {confirm ? (
              <div className="flex items-center gap-2" role="alertdialog" aria-label={L('Confirmar borrado', 'Confirm delete')}>
                <span className="text-sm">{L('¿Borrar todo el historial?', 'Delete all history?')}</span>
                <button type="button" className="btn rounded-xl bg-red-600 px-4 text-white" onClick={async () => (await clearHistory(), setConfirm(false), refresh())}>
                  {L('Sí, borrar todo', 'Yes, delete all')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                  {L('Cancelar', 'Cancel')}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secondary text-red-700 dark:text-red-400" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {L('Borrar todo', 'Delete all')}
              </button>
            )}
          </div>
          <ul className="space-y-2" data-testid="history-list">
            {items.map((it) => {
              const tool = findTool(it.tool.replace(/^\//, ''));
              return (
                <li key={it.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-sm muted">
                      {tool ? <Link to={it.tool} className="hover:underline">{tool[lang].name}</Link> : it.tool} · {new Date(it.date).toLocaleString(lang)} · {formatBytes(it.size, lang)}
                    </p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => downloadAgain(it)}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {L('Descargar', 'Download')}
                  </button>
                  <button type="button" className="btn-icon-sm" onClick={async () => (await deleteHistory(it.id!), refresh())} aria-label={`${L('Borrar', 'Delete')}: ${it.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {items && items.length === 0 && !unavailable && <p className="muted">{L('El historial está vacío.', 'History is empty.')}</p>}
    </div>
  );
}

/** Volver a descargar sin crear una entrada duplicada en el historial */
function downloadAgain(it: HistoryEntry) {
  const was = historyEnabled();
  if (was) setHistoryEnabled(false);
  downloadBlob(it.blob, it.name);
  if (was) setTimeout(() => setHistoryEnabled(true), 500);
}
