import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, toAppError } from '@/core/errors/app-error';
import type { AccountRepository } from '@/features/account/domain/account';
import type { Database } from '@/types/database';

export class SupabaseAccountRepository implements AccountRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async exportData() {
    const { data, error } = await this.client.rpc('export_my_data');
    if (error) throw toAppError(error);
    return JSON.stringify(data, null, 2);
  }

  async deleteAccount(confirmation: string) {
    const { error } = await this.client.functions.invoke('delete-account', {
      body: { confirm: confirmation.trim().toUpperCase() },
    });
    if (error) throw new AppError('unknown', error);
    // La sesión ya no es válida en el servidor: se borra también en el teléfono.
    await this.client.auth.signOut({ scope: 'local' });
  }
}
