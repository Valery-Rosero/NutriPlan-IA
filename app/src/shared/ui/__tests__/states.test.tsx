import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CrashState, LoadingState } from '@/shared/ui';
import { fakeServices, withServices } from '@/test/fakes';

describe('cargando sin conexión (US-150)', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('con red muestra el indicador de carga', async () => {
    onlineManager.setOnline(true);
    await render(<LoadingState />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByLabelText('Cargando…')).toBeOnTheScreen();
  });

  it('sin red dice qué pasa y ofrece reintentar, nunca un spinner eterno ni una pantalla en blanco', async () => {
    onlineManager.setOnline(false);
    await render(<LoadingState />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByText('Sin conexión. Esto se cargará solo apenas vuelva internet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });
});

describe('si una pantalla falla (US-122)', () => {
  it('muestra un camino para seguir, sin detalles técnicos', async () => {
    const onRetry = jest.fn();
    await render(<CrashState onRetry={onRetry} />);
    expect(screen.getByText('Algo salió mal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
