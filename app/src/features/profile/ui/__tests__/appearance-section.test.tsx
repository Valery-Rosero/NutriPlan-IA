import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { AppearanceSection } from '@/features/profile/ui/appearance-section';

describe('Apariencia', () => {
  it('parte de "Como el teléfono" y fija el modo oscuro, guardándolo', async () => {
    const setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    await render(<AppearanceSection />);
    expect(await screen.findByRole('radio', { name: 'Como el teléfono' })).toBeSelected();

    await fireEvent.press(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(setScheme).toHaveBeenCalledWith('dark');
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith('nutriplan-theme', 'dark'));

    await fireEvent.press(screen.getByRole('radio', { name: 'Como el teléfono' }));
    expect(setScheme).toHaveBeenLastCalledWith('unspecified');
  });
});
