import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { CalendarDay } from '@/features/plan/domain/calendar';
import { DayPager } from '@/features/plan/ui/day-pager';
import { AppText } from '@/shared/ui';

const DAYS = [{ date: '2026-11-14' }, { date: '2026-11-15' }] as unknown as CalendarDay[];
const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height } } });

describe('Mi semana: el libro de días', () => {
  it('mide lo que mide el día que se ve, no el día más largo (sin hueco debajo)', async () => {
    const { rerender } = await render(
      <DayPager days={DAYS} index={0} onIndexChange={() => undefined} renderDay={(d) => <AppText>{d.date}</AppText>} />,
    );
    await fireEvent(screen.getByTestId('day-page-0'), 'layout', layout(240));
    await fireEvent(screen.getByTestId('day-page-1'), 'layout', layout(900));
    expect(StyleSheet.flatten(screen.getByTestId('day-pager').props.style)).toMatchObject({ height: 240 });

    await rerender(<DayPager days={DAYS} index={1} onIndexChange={() => undefined} renderDay={(d) => <AppText>{d.date}</AppText>} />);
    expect(StyleSheet.flatten(screen.getByTestId('day-pager').props.style)).toMatchObject({ height: 900 });
  });
});
