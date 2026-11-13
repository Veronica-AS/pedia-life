import { OptionGroup } from '../../components/OptionGroup';
import { useL } from '../../i18n/I18nProvider';
import type { LevelId } from '../compress/levels';
import type { NumberFormat, Position } from '../page-numbers/format';
import type { Step } from './steps';

/** Opciones de un paso (la contraseña no se configura aquí: se pide al ejecutar) */
export function StepEditor({ step, onChange, idPrefix }: { step: Step; onChange: (s: Step) => void; idPrefix: string }) {
  const L = useL();
  switch (step.type) {
    case 'compress':
      return (
        <OptionGroup<LevelId>
          label={L('Nivel', 'Level')}
          value={step.level}
          name={`${idPrefix}-level`}
          onChange={(level) => onChange({ ...step, level })}
          options={[
            { value: 'light', label: L('Ligera', 'Light') },
            { value: 'recommended', label: L('Recomendada', 'Recommended') },
            { value: 'strong', label: L('Fuerte', 'Strong') },
          ]}
        />
      );
    case 'rotate':
      return (
        <OptionGroup<'90' | '180' | '270'>
          label={L('Giro', 'Rotation')}
          value={String(step.degrees) as '90'}
          name={`${idPrefix}-rot`}
          onChange={(d) => onChange({ ...step, degrees: +d as 90 })}
          options={[
            { value: '90', label: L('90° derecha', '90° right') },
            { value: '180', label: '180°' },
            { value: '270', label: L('90° izquierda', '90° left') },
          ]}
        />
      );
    case 'pageNumbers':
      return (
        <div className="space-y-3">
          <OptionGroup<NumberFormat>
            label={L('Formato', 'Format')}
            value={step.format}
            name={`${idPrefix}-fmt`}
            onChange={(format) => onChange({ ...step, format })}
            options={[
              { value: 'n', label: '1, 2, 3' },
              { value: 'page-n-of-total', label: L('Página 1 de 10', 'Page 1 of 10') },
              { value: 'none', label: L('Sin número', 'No number') },
            ]}
          />
          <OptionGroup<Position>
            label={L('Posición', 'Position')}
            value={step.position}
            name={`${idPrefix}-pos`}
            onChange={(position) => onChange({ ...step, position })}
            options={[
              { value: 'bl', label: L('Abajo izq.', 'Bottom left') },
              { value: 'bc', label: L('Abajo centro', 'Bottom center') },
              { value: 'br', label: L('Abajo der.', 'Bottom right') },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${idPrefix}-h`}>
                {L('Encabezado', 'Header')}
              </label>
              <input id={`${idPrefix}-h`} className="input" value={step.header} onChange={(e) => onChange({ ...step, header: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={`${idPrefix}-f`}>
                {L('Pie de página', 'Footer')}
              </label>
              <input id={`${idPrefix}-f`} className="input" value={step.footer} onChange={(e) => onChange({ ...step, footer: e.target.value })} />
            </div>
          </div>
        </div>
      );
    case 'protect':
      return (
        <div className="space-y-1">
          {(
            [
              ['allowPrint', L('Permitir imprimir', 'Allow printing')],
              ['allowCopy', L('Permitir copiar', 'Allow copying')],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={step[k]} onChange={(e) => onChange({ ...step, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
          <p className="text-xs muted">{L('La contraseña se pide al ejecutar y nunca se guarda.', 'The password is asked when running and never saved.')}</p>
        </div>
      );
    case 'unlock':
      return <p className="text-sm muted">{L('La contraseña se pide al ejecutar. Los archivos sin contraseña pasan sin cambios.', 'The password is asked when running.')}</p>;
    case 'metadata':
      return <p className="text-sm muted">{L('Borra autor, fechas, programa y metadatos XMP.', 'Removes author, dates, software and XMP.')}</p>;
  }
}
