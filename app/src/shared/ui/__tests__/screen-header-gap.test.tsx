import { render, screen } from '@testing-library/react-native';
import { HeaderShownContext } from 'expo-router/react-navigation';

import { AppText, Screen } from '@/shared/ui';

// Receta y Perfil (y las demás con flecha de volver) dejaban una franja vacía arriba: el encabezado del sistema ya
// deja el espacio de la barra de estado y la pantalla lo repetía.
describe('Screen bajo el encabezado del sistema', () => {
  it('sin encabezado (pestañas): deja el espacio de la barra de estado', async () => {
    await render(<Screen><AppText>Hola</AppText></Screen>);
    expect(screen.getByTestId('screen-root').props.edges.top).toBe('additive');
  });

  it('con encabezado (flecha de volver): no lo repite', async () => {
    await render(
      <HeaderShownContext.Provider value>
        <Screen scroll><AppText>Hola</AppText></Screen>
      </HeaderShownContext.Provider>,
    );
    expect(screen.getByTestId('screen-root').props.edges.top).toBe('off');
    expect(screen.getByText('Hola')).toBeOnTheScreen();
  });
});
