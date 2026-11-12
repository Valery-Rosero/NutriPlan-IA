import { useServices } from '@/di/services';
import type { AnalyticsEvent } from '@/features/analytics/domain/analytics';

/** Registra un evento sin esperar respuesta (fire-and-forget): medir nunca frena a la persona. */
export function useTrack() {
  const { analytics } = useServices();
  return (event: AnalyticsEvent) => void analytics.track(event);
}
