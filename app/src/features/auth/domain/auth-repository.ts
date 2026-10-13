/** Sesión mínima que necesita la app: nada de tokens ni datos personales fuera de la capa de datos. */
export type AuthSession = { userId: string; email: string | null };

export type Credentials = { email: string; password: string };

export type SignUpInput = Credentials & {
  privacyPolicyDocumentId: number;
  termsDocumentId: number;
  isAdult: true;
};

/** Con confirmación de correo activa, el registro termina en 'confirmation_sent'. */
export type SignUpOutcome = 'confirmation_sent' | 'signed_in';

/**
 * Puerto de autenticación (arquitectura hexagonal). La UI y los casos de uso dependen de esta
 * interfaz, no de Supabase: se puede cambiar el proveedor o usar un doble en pruebas.
 * Todas las operaciones fallan con AppError.
 */
export interface AuthRepository {
  getSession(): Promise<AuthSession | null>;
  /** Observador de cambios de sesión. Devuelve la función para desuscribirse. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
  signUp(input: SignUpInput): Promise<SignUpOutcome>;
  signIn(credentials: Credentials): Promise<void>;
  signOut(): Promise<void>;
  resendConfirmation(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Canjea el código de un enlace de correo (confirmación o recuperación, flujo PKCE). */
  exchangeCode(code: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
}
