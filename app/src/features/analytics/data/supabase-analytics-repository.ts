import type { SupabaseClient } from '@supabase/supabase-js';

import type { AnalyticsEvent, AnalyticsRepository } from '@/features/analytics/domain/analytics';
import type { Database } from '@/types/database';

/** Identificador anónimo del dispositivo: no se relaciona con la cuenta (la tabla no tiene user_id). */
export type AnonymousId = () => Promise<string>;

export class SupabaseAnalyticsRepository implements AnalyticsRepository {
  private readonly client: SupabaseClient<Database>;
  private readonly anonymousId: AnonymousId;
  private readonly appVersion: string | null;

  constructor(client: SupabaseClient<Database>, anonymousId: AnonymousId, appVersion: string | null) {
    this.client = client;
    this.anonymousId = anonymousId;
    this.appVersion = appVersion;
  }

  async track(event: AnalyticsEvent) {
    try {
      await this.client.from('analytics_events').insert({
        anonymous_id: await this.anonymousId(),
        event_type: event,
        app_version: this.appVersion,
        platform: 'android',
      });
      // Si la persona desactivó la analítica, la base (RLS) rechaza el evento: se ignora a propósito.
    } catch {
      // Sin conexión u otro error: se pierde el evento, nunca la acción de la persona.
    }
  }
}
