import {
  PDFCheckBox,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFTextField,
  StandardFonts,
  type PDFDocument,
  type PDFField,
} from 'pdf-lib';
import { safeText } from '../../lib/fontText';
import { loadPdf, saveOptions } from '../../lib/pdf';

export type FieldKind = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'list' | 'other';

export interface FormFieldInfo {
  name: string;
  /** Nombre legible (última parte del nombre completo) */
  label: string;
  kind: FieldKind;
  value: string | boolean | string[];
  options: string[];
  multiline: boolean;
  multiSelect: boolean;
  readOnly: boolean;
  required: boolean;
  maxLength?: number;
  /** Página (1-based) donde aparece; 0 si no se pudo determinar */
  page: number;
}

export interface FormInfo {
  fields: FormFieldInfo[];
  hasXfa: boolean;
}

function fieldPage(doc: PDFDocument, field: PDFField): number {
  const pages = doc.getPages();
  for (const w of field.acroField.getWidgets()) {
    const p = w.P();
    if (p) {
      const i = pages.findIndex((pg) => pg.ref === p);
      if (i >= 0) return i + 1;
    }
    // Sin /P: buscar el widget en las anotaciones de cada página
    const ref = doc.context.getObjectRef(w.dict);
    if (ref) {
      for (let i = 0; i < pages.length; i++) {
        const annots = pages[i].node.Annots();
        if (annots && annots.asArray().some((a) => a instanceof PDFRef && a === ref)) return i + 1;
      }
    }
  }
  return 0;
}

export function readFormFrom(doc: PDFDocument): FormInfo {
  const form = doc.getForm();
  const acro = doc.catalog.lookup(PDFName.of('AcroForm'));
  const hasXfa = !!(acro && 'get' in acro && (acro as { get: (n: PDFName) => unknown }).get(PDFName.of('XFA')));
  const fields: FormFieldInfo[] = form.getFields().map((f) => {
    const name = f.getName();
    const base = {
      name,
      label: name.split('.').pop() || name,
      readOnly: f.isReadOnly(),
      required: f.isRequired(),
      page: fieldPage(doc, f),
      multiline: false,
      multiSelect: false,
      options: [] as string[],
    };
    if (f instanceof PDFTextField) {
      return { ...base, kind: 'text' as const, value: f.getText() ?? '', multiline: f.isMultiline(), maxLength: f.getMaxLength() };
    }
    if (f instanceof PDFCheckBox) return { ...base, kind: 'checkbox' as const, value: f.isChecked() };
    if (f instanceof PDFDropdown) return { ...base, kind: 'dropdown' as const, value: f.getSelected()[0] ?? '', options: f.getOptions() };
    if (f instanceof PDFRadioGroup) return { ...base, kind: 'radio' as const, value: f.getSelected() ?? '', options: f.getOptions() };
    if (f instanceof PDFOptionList) {
      return { ...base, kind: 'list' as const, value: f.getSelected(), options: f.getOptions(), multiSelect: f.isMultiselect() };
    }
    return { ...base, kind: 'other' as const, value: '' };
  });
  return { fields: fields.sort((a, b) => (a.page || 1e9) - (b.page || 1e9)), hasXfa };
}

export async function readForm(bytes: Uint8Array): Promise<FormInfo> {
  return readFormFrom(await loadPdf(bytes));
}

export type FormValues = Record<string, string | boolean | string[]>;

export async function fillForm(bytes: Uint8Array, values: FormValues, flatten: boolean): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Los formularios XFA no se pueden editar con pdf-lib: se usa su versión AcroForm equivalente
  form.deleteXFA();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values) || field.isReadOnly()) continue;
    const v = values[name];
    try {
      if (field instanceof PDFTextField) {
        let text = safeText(font, String(v ?? '')).replace(/ {2,}/g, ' ');
        if (field.isMultiline()) text = String(v ?? '').split(/\r?\n/).map((l) => safeText(font, l)).join('\n');
        const max = field.getMaxLength();
        field.setText(max ? text.slice(0, max) : text);
      } else if (field instanceof PDFCheckBox) {
        if (v) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        if (v) field.select(String(v));
        else field.clear();
      } else if (field instanceof PDFRadioGroup) {
        if (v) field.select(String(v));
        else field.clear();
      } else if (field instanceof PDFOptionList) {
        const list = (Array.isArray(v) ? v : [String(v)]).filter(Boolean);
        if (list.length) field.select(list);
        else field.clear();
      }
    } catch {
      /* un valor no válido para un campo no debe impedir guardar los demás */
    }
  }
  form.updateFieldAppearances(font);
  if (flatten) form.flatten();
  return doc.save(saveOptions);
}
