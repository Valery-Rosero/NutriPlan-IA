import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAnalyticsRepository } from '@/features/analytics/data/supabase-analytics-repository';
import type { Database } from '@/types/database';

const clientWith = (insert: jest.Mock) => ({ from: jest.fn(() => ({ insert })) }) as unknown as SupabaseClient<Database>;

describe('analítica anónima (US-131)', () => {
  it('registra solo tipo, identificador anónimo, versión y plataforma', async () => {
    const insert = jest.fn(async () => ({ error: null }));
    await new SupabaseAnalyticsRepository(clientWith(insert), async () => 'anon-1', '1.0.0').track('plan_generated');
    expect(insert).toHaveBeenCalledWith({ anonymous_id: 'anon-1', event_type: 'plan_generated', app_version: '1.0.0', platform: 'android' });
  });

  it('nunca rompe la acción de la persona (sin conexión o analítica desactivada)', async () => {
    const insert = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    await expect(new SupabaseAnalyticsRepository(clientWith(insert), async () => 'anon-1', null).track('meal_cooked')).resolves.toBeUndefined();
  });
});
