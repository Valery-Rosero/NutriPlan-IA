import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PrivacySection } from '@/features/profile/ui/privacy-section';
import { fakeProfile, fakeServices, withServices } from '@/test/fakes';

describe('Privacidad: estadísticas anónimas (US-131)', () => {
  it('se pueden apagar desde Privacidad', async () => {
    const profile = fakeProfile();
    await render(<PrivacySection onDone={jest.fn()} />, { wrapper: withServices(fakeServices({ profile })) });

    const toggle = await screen.findByLabelText('Compartir estadísticas anónimas');
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await fireEvent(toggle, 'valueChange', false);
    await waitFor(() => expect(profile.updateProfile).toHaveBeenCalledWith({ analyticsEnabled: false }));
  });
});
