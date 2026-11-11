import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { DeviceInfo, NewTicket, SupportRepository } from '@/features/support/domain/support';
import type { Database } from '@/types/database';

const BUCKET = 'support-screenshots';

export class SupabaseSupportRepository implements SupportRepository {
  private readonly client: SupabaseClient<Database>;
  private readonly device: () => DeviceInfo;

  constructor(client: SupabaseClient<Database>, device: () => DeviceInfo) {
    this.client = client;
    this.device = device;
  }

  async send({ category, message, screenshot }: NewTicket) {
    const { data } = await this.client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new AppError('unknown');

    // La captura va primero a la carpeta propia (bucket privado); el reporte guarda solo la ruta.
    let screenshotPath: string | null = null;
    if (screenshot) {
      const { uri, mimeType: contentType } = screenshot;
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      screenshotPath = `${userId}/${Date.now()}.${extension}`;
      const bytes = await (await fetch(uri)).arrayBuffer();
      const upload = await this.client.storage.from(BUCKET).upload(screenshotPath, bytes, { contentType });
      if (upload.error) throw toAppError(upload.error);
    }

    const { appVersion, deviceModel } = this.device();
    const { error } = await this.client.from('support_tickets').insert({
      user_id: userId,
      category,
      message: message.trim(),
      app_version: appVersion,
      device_model: deviceModel,
      screenshot_path: screenshotPath,
    });
    if (error) throw toAppError(error);
  }
}
