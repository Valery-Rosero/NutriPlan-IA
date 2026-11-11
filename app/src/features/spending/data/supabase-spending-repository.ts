import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/core/errors/app-error';
import type { MonthlySpend, SpendingRepository } from '@/features/spending/domain/spending';
import type { Database } from '@/types/database';

export class SupabaseSpendingRepository implements SpendingRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async monthly(): Promise<MonthlySpend> {
    const { data, error } = await this.client.rpc('monthly_spend').single();
    if (error) throw toAppError(error);
    return {
      monthStart: data.month_start,
      spent: Number(data.spent),
      purchases: data.purchases,
      monthlyBudget: data.monthly_budget === null ? null : Number(data.monthly_budget),
      percent: data.percent,
    };
  }

  async recordPurchase(total: number, listId?: string) {
    const { error } = await this.client.rpc('record_purchase', { p_total: total, p_list_id: listId });
    if (error) throw toAppError(error);
  }
}
