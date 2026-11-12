/**
 * US-131 / ADR-015: analítica propia y anónima. Solo estos 4 eventos (el enum de la base); ningún evento
 * lleva alergias, salud ni datos que identifiquen a la persona: solo tipo, fecha, versión y plataforma.
 */
export type AnalyticsEvent = 'onboarding_completed' | 'plan_generated' | 'shopping_list_generated' | 'meal_cooked';

/** Puerto de analítica. NUNCA falla hacia la UI: medir no puede romper lo que la persona está haciendo. */
export interface AnalyticsRepository {
  track(event: AnalyticsEvent): Promise<void>;
}
