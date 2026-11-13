import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { capitalize, formatDay } from '@/core/format';
import { dayNumber, monthWeeks, weekdayIndex, type CalendarDay } from '@/features/plan/domain/calendar';
import { MinTouch, Spacing } from '@/shared/theme/colors';
import { Radius } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText } from '@/shared/ui';

/**
 * Calendario de Mi semana (B1). Hasta 7 días: tira; más: cuadrícula del mes (lunes a domingo).
 * Tocar un día abre su página en el libro de abajo.
 */
export function PlanCalendar({ days, layout, selected, today, onSelect }: {
  days: CalendarDay[];
  layout: 'strip' | 'month';
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const letters = t('plan.calendar.weekdays', { returnObjects: true }) as string[];

  if (layout === 'strip') {
    return (
      <View style={styles.strip} accessibilityRole="tablist" accessibilityLabel={t('plan.calendar.label')}>
        {days.map((day) => (
          <DayCell key={day.date} day={day} selected={day.date === selected} letter={letters[weekdayIndex(day.date)]} onSelect={onSelect} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.month} accessibilityLabel={t('plan.calendar.label')}>
      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {letters.map((letter, i) => (
          <AppText key={`${letter}${i}`} variant="caption" secondary style={styles.weekday}>{letter}</AppText>
        ))}
      </View>
      {monthWeeks(days, today).map((week) => (
        <View key={week[0].date} style={styles.week}>
          {week.map((day) => (
            <DayCell key={day.date} day={day} selected={day.date === selected} onSelect={onSelect} compact />
          ))}
        </View>
      ))}
      <Legend color={c.primary} />
    </View>
  );
}

function DayCell({ day, selected, letter, onSelect, compact }: {
  day: CalendarDay;
  selected: boolean;
  letter?: string;
  onSelect: (date: string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const fg = selected ? c.onPrimary : day.inPlan ? c.text : c.textSecondary;
  const label = `${capitalize(formatDay(day.date))}${day.isToday ? `, ${t('plan.today')}` : ''}. ${t(`plan.calendar.state.${day.state}`)}`;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !day.inPlan }}
      disabled={!day.inPlan}
      onPress={() => onSelect(day.date)}
      style={({ pressed }) => [
        styles.cell,
        compact && styles.cellCompact,
        {
          backgroundColor: selected ? c.primary : day.inPlan ? c.surface : 'transparent',
          borderColor: day.isToday ? c.accent : 'transparent',
          opacity: !day.inPlan ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}>
      {letter ? <AppText variant="caption" style={{ color: selected ? c.onPrimary : c.textSecondary }}>{letter}</AppText> : null}
      <AppText variant="label" style={{ color: fg }} maxFontSizeMultiplier={1.4}>{dayNumber(day.date)}</AppText>
      <StateDot state={day.state} selected={selected} />
    </Pressable>
  );
}

/** Punto del día: lleno = todo hecho; mitad = algo cocinado; aro = pendiente; nada = sin comidas. */
function StateDot({ state, selected }: { state: CalendarDay['state']; selected: boolean }) {
  const c = useTheme();
  const color = selected ? c.onPrimary : c.primary;
  if (state === 'empty') return <View style={styles.dotSpace} />;
  return (
    <View
      style={[
        styles.dot,
        { borderColor: color },
        state === 'done' && { backgroundColor: color },
        state === 'partial' && { backgroundColor: color, opacity: 0.55 },
      ]}
    />
  );
}

function Legend({ color }: { color: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.dot, { borderColor: color }]} />
      <AppText variant="caption" secondary>{t('plan.calendar.legendPending')}</AppText>
      <View style={[styles.dot, { borderColor: color, backgroundColor: color }]} />
      <AppText variant="caption" secondary>{t('plan.calendar.legendDone')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: Spacing.xs },
  month: { gap: Spacing.xs },
  week: { flexDirection: 'row', gap: Spacing.xs },
  weekday: { flex: 1, textAlign: 'center' },
  cell: {
    flex: 1,
    minHeight: MinTouch + 20,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingVertical: Spacing.xs,
  },
  cellCompact: { minHeight: MinTouch + 4 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
  dotSpace: { height: 7 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.xs },
});
