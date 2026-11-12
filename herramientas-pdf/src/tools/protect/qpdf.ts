/**
 * Cifrado y descifrado con qpdf (compilado a WebAssembly). Cifra con AES-256,
 * el estándar más fuerte que admiten los lectores de PDF.
 * Recibe una "fábrica" del módulo para poder usarse en un Worker del navegador o en Node (pruebas).
 */
import { AppError } from '../../lib/errors';

export interface QpdfInstance {
  callMain(args: string[]): number;
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
}
export type QpdfFactory = () => Promise<QpdfInstance>;

async function run(factory: QpdfFactory, input: Uint8Array, args: (inp: string, out: string) => string[]): Promise<{ code: number; out?: Uint8Array }> {
  const q = await factory(); // instancia nueva por operación: qpdf no está pensado para llamarse dos veces
  q.FS.writeFile('/in.pdf', input);
  let code: number;
  try {
    code = q.callMain(args('/in.pdf', '/out.pdf'));
  } catch (e) {
    code = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 2;
  }
  let out: Uint8Array | undefined;
  try {
    out = q.FS.readFile('/out.pdf');
  } catch {
    out = undefined;
  }
  return { code, out };
}

export interface ProtectOptions {
  userPassword: string;
  allowPrint: boolean;
  allowCopy: boolean;
  allowModify: boolean;
}

function randomPassword(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function encryptPdf(factory: QpdfFactory, bytes: Uint8Array, o: ProtectOptions): Promise<Uint8Array> {
  if (!o.userPassword) throw new AppError('weak-password');
  // Contraseña de propietario aleatoria: así los permisos (imprimir, copiar…) no se pueden saltar con la de apertura
  const { code, out } = await run(factory, bytes, (inp, outp) => [
    '--encrypt',
    `--user-password=${o.userPassword}`,
    `--owner-password=${randomPassword()}`,
    '--bits=256',
    `--print=${o.allowPrint ? 'full' : 'none'}`,
    `--extract=${o.allowCopy ? 'y' : 'n'}`,
    `--modify=${o.allowModify ? 'all' : 'none'}`,
    '--',
    inp,
    outp,
  ]);
  if ((code !== 0 && code !== 3) || !out) throw new AppError(code === 2 ? 'corrupt' : 'unknown', { detail: `qpdf ${code}` });
  return out;
}

/** Quita la contraseña. Sin contraseña solo funciona si el PDF se abre sin pedirla (restricciones de propietario). */
export async function decryptPdf(factory: QpdfFactory, bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const { code, out } = await run(factory, bytes, (inp, outp) => [...(password ? [`--password=${password}`] : []), '--decrypt', inp, outp]);
  if ((code === 0 || code === 3) && out) return out;
  throw new AppError(code === 2 ? 'wrong-password' : 'unknown', { detail: `qpdf ${code}` });
}
