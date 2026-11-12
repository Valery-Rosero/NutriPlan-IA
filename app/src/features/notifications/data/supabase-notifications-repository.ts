import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { NotificationPreferences, NotificationsRepository } from '@/features/notifications/domain/notifications';
import type { Database } from '@/types/database';

export class SupabaseNotificationsRepository implements NotificationsRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async preferences(): Promise<NotificationPreferences> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .select('frequency, meal_reminder_lead_minutes, expiry_alerts_enabled')
      .single();
    if (error) throw toAppError(error);
    return { frequency: data.frequency, leadMinutes: data.meal_reminder_lead_minutes, expiryAlerts: data.expiry_alerts_enabled };
  }

  async savePreferences(prefs: NotificationPreferences) {
    const { data } = await this.client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new AppError('unknown');
    const { error } = await this.client
      .from('notification_preferences')
      .update({ frequency: prefs.frequency, meal_reminder_lead_minutes: prefs.leadMinutes, expiry_alerts_enabled: prefs.expiryAlerts })
      .eq('user_id', userId);
    if (error) throw toAppError(error);
  }

  async registerDevice(token: string) {
    const { error } = await this.client.rpc('register_push_device', { p_token: token });
    if (error) throw toAppError(error);
  }

  async unregisterDevice(token: string) {
    const { error } = await this.client.rpc('unregister_push_device', { p_token: token });
    if (error) throw toAppError(error);
  }
}
