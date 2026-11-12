import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useL } from '../i18n/I18nProvider';

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  autoFocus,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  const L = useL();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="input pr-12"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="off"
        />
        <button
          type="button"
          className="btn-icon-sm absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? L('Ocultar contraseña', 'Hide password') : L('Mostrar contraseña', 'Show password')}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** Estimación sencilla de la fortaleza (longitud y variedad de caracteres) */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  const variety = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^\w\sáéíóúñÁÉÍÓÚÑ]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 14 || (pw.length >= 10 && variety >= 3)) return 3;
  if (pw.length >= 8 && variety >= 2) return 2;
  return 1;
}
