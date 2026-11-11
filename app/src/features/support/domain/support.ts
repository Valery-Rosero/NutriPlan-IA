import { z } from 'zod';

/** US-151: reporte de un problema o una sugerencia. Inmutable una vez enviado (lo garantiza la base). */
export type TicketCategory = 'bug' | 'suggestion';

export const MESSAGE_MAX = 500;

export const ticketSchema = z.object({
  category: z.enum(['bug', 'suggestion']),
  message: z.string().trim().min(1, { error: 'validation.required' }).max(MESSAGE_MAX, { error: 'validation.messageLength' }),
});

export type NewTicket = z.infer<typeof ticketSchema> & {
  /** Captura opcional elegida por la persona (uri local + tipo que informa el selector de imágenes). */
  screenshot?: { uri: string; mimeType: string } | null;
};

/**
 * Lo único que se adjunta automáticamente: versión de la app y modelo del teléfono.
 * Nunca datos de salud ni de perfil (criterio de US-151).
 */
export type DeviceInfo = { appVersion: string | null; deviceModel: string | null };

/** Puerto de soporte. Falla con AppError. */
export interface SupportRepository {
  send(ticket: NewTicket): Promise<void>;
}
