import { useMemo, useState } from 'react';
import { OptionGroup } from '../../components/OptionGroup';
import { useI18n, useL } from '../../i18n/I18nProvider';
import type { ToolProps } from '../types';
import { FlowRunner } from './FlowRunner';
import { StepEditor } from './StepEditor';
import { STEP_DEFAULTS, STEP_LABEL, STEP_ORDER, type Flow, type Step, type StepType } from './steps';

/** Aplica UNA acción a muchos archivos y descarga un ZIP */
export default function BatchTool(_: ToolProps) {
  const L = useL();
  const { lang } = useI18n();
  const [step, setStep] = useState<Step>(STEP_DEFAULTS.compress);
  const flow = useMemo<Flow>(() => ({ id: 'lote', name: 'Lote', mergeFirst: false, steps: [step] }), [step]);
  return (
    <div className="space-y-5">
      <OptionGroup<StepType>
        label={L('¿Qué quieres hacer con todos los archivos?', 'What should be done to every file?')}
        value={step.type}
        onChange={(t) => setStep(STEP_DEFAULTS[t])}
        options={STEP_ORDER.map((t) => ({ value: t, label: STEP_LABEL[t][lang] }))}
      />
      <div className="card p-4">
        <StepEditor step={step} onChange={setStep} idPrefix="batch" />
      </div>
      <FlowRunner flow={flow} actionLabel={L('Procesar archivos', 'Process files')} zipName="lote-pdf-libre.zip" />
    </div>
  );
}
