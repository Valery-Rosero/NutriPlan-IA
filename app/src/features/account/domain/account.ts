/** Derechos del titular (Ley 1581): acceso/portabilidad y supresión (US-133). */
export interface AccountRepository {
  /** Todos los datos de la persona en JSON legible (RPC export_my_data). */
  exportData(): Promise<string>;
  /** Borra la cuenta y todos sus datos (Edge Function delete-account) y cierra la sesión local. */
  deleteAccount(confirmation: string): Promise<void>;
}

/** Confirmación reforzada: hay que escribir la palabra exacta. */
export const DELETE_CONFIRMATION = 'ELIMINAR';

export function canDelete(typed: string) {
  return typed.trim().toUpperCase() === DELETE_CONFIRMATION;
}
