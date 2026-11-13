// Expo Router: reescribe los enlaces que abren la app (también con la app ya abierta) antes de navegar.
// Caso que arregla: el enlace de "recuperar contraseña" volvía a nutriplan:// sin pantalla y la app abría
// donde se había quedado. Ver features/auth/domain/auth-links.ts.
import { readRecoveryMark } from '@/features/auth/application/recovery-mark';
import { authLinkTarget, isRecoveryPending } from '@/features/auth/domain/auth-links';

export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  try {
    if (authLinkTarget(path, false) === null) return path; // no es un enlace de correo: no se toca
    const pending = isRecoveryPending(await readRecoveryMark(), Date.now());
    return authLinkTarget(path, pending) ?? path;
  } catch {
    return path; // nunca romper la apertura de la app
  }
}
