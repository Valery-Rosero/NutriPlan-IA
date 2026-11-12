import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NotificationsForm } from '@/features/notifications/ui/notifications-form';
import { fakeServices, withServices } from '@/test/fakes';

describe('Notificaciones (US-148, US-149, US-153)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pide el permiso en contexto y registra el teléfono', async () => {
    const services = fakeServices();
    await render(<NotificationsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(services) });

    expect(services.push.register).not.toHaveBeenCalled(); // nunca al abrir
    await fireEvent.press(await screen.findByRole('button', { name: 'Activar avisos' }));
    await waitFor(() => expect(services.notifications.registerDevice).toHaveBeenCalledWith('ExponentPushToken[test]'));
    expect(await screen.findByText('Activos en este teléfono')).toBeOnTheScreen();
  });

  it('en Expo Go explica que los avisos funcionan en la app instalada', async () => {
    const services = fakeServices();
    services.push.register = jest.fn(async () => ({ status: 'unavailable' as const }));
    await render(<NotificationsForm submitLabel="Guardar" onSaved={jest.fn()} />, { wrapper: withServices(services) });

    await fireEvent.press(await screen.findByRole('button', { name: 'Activar avisos' }));
    expect(await screen.findByText('Los avisos funcionan en la app instalada (APK), no en Expo Go.')).toBeOnTheScreen();
    expect(services.notifications.registerDevice).not.toHaveBeenCalled();
  });

  it('US-149: "Solo resumen semanal" quita los recordatorios diarios y se guarda', async () => {
    const services = fakeServices();
    const onSaved = jest.fn();
    await render(<NotificationsForm submitLabel="Guardar" onSaved={onSaved} />, { wrapper: withServices(services) });

    expect(await screen.findByRole('radio', { name: '30 min' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Solo resumen semanal' }));
    expect(screen.getByText('Solo un resumen los domingos. Sin recordatorios diarios.')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: '30 min' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(services.notifications.savePreferences).toHaveBeenCalledWith({ frequency: 'weekly_summary', leadMinutes: 30, expiryAlerts: true }),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
