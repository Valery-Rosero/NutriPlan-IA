import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { canDelete } from '@/features/account/domain/account';
import { DeleteAccountScreen } from '@/features/account/ui/delete-account-screen';
import { fakeServices, withServices } from '@/test/fakes';

describe('eliminar cuenta (US-133)', () => {
  it('exige escribir ELIMINAR (sin importar mayúsculas ni espacios)', () => {
    expect(canDelete(' eliminar ')).toBe(true);
    expect(canDelete('borrar')).toBe(false);
  });

  it('el botón solo se habilita con la confirmación y entonces elimina', async () => {
    const services = fakeServices();
    await render(<DeleteAccountScreen />, { wrapper: withServices(services) });
    const button = screen.getByRole('button', { name: 'Eliminar mi cuenta para siempre' });
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Para confirmar, escribe ELIMINAR'), 'ELIMINAR');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta para siempre' }));
    await waitFor(() => expect(services.account.deleteAccount).toHaveBeenCalledWith('ELIMINAR'));
  });
});
