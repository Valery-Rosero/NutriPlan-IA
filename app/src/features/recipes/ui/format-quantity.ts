import type { TFunction } from 'i18next';

import { formatGrams } from '@/core/format';

const number = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

/** "300 g", "1,2 kg", "2 unidades", "0,5 cdta". Solo formatea: la cantidad la calcula la base. */
export function formatQuantity(quantity: number, unitCode: string, t: TFunction): string {
  if (unitCode === 'g') return formatGrams(quantity);
  if (unitCode === 'ml') return quantity >= 1000 ? `${number(quantity / 1000)} L` : `${number(quantity)} ml`;
  return `${number(quantity)} ${t(`units.${unitCode}`, { count: quantity })}`;
}
