import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { LoadingState } from '@/shared/ui';
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
