/** US-141: gasto del mes calendario frente al presupuesto mensual (el semanal lo convierte la base). */
export type MonthlySpend = {
  monthStart: string;
  spent: number;
  purchases: number;
  /** Null si la persona no fijó presupuesto. */
  monthlyBudget: number | null;
  percent: number | null;
};

export type SpendLevel = 'none' | 'ok' | 'near' | 'over';

/** Igual que el presupuesto del plan (US-132): aviso al 90 %, alerta al pasar del 100 %. */
export function spendLevel(spend: MonthlySpend): SpendLevel {
  if (spend.monthlyBudget === null || spend.percent === null) return 'none';
  if (spend.percent > 100) return 'over';
  return spend.percent >= 90 ? 'near' : 'ok';
}

/** Puerto del gasto. Falla con AppError. */
export interface SpendingRepository {
  monthly(): Promise<MonthlySpend>;
  /** Lo que la persona pagó de verdad (no una suma de precios estimados). */
  recordPurchase(total: number, listId?: string): Promise<void>;
}
