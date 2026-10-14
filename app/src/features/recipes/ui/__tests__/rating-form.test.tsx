import { fireEvent, render, screen } from '@testing-library/react-native';

import { RatingForm } from '@/features/recipes/ui/rating-form';
import { fakeRecipes, fakeServices, withServices } from '@/test/fakes';

describe('RatingForm (US-128)', () => {
  it('no envía sin estrellas; con estrellas y etiquetas, califica una vez', async () => {
    const recipes = fakeRecipes();
    const onRated = jest.fn();
    await render(<RatingForm plannedMealId="pm1" onRated={onRated} />, { wrapper: withServices(fakeServices({ recipes })) });

    expect(screen.getByRole('button', { name: 'Enviar calificación' })).toBeDisabled();
    // Se explica por qué está deshabilitado, no solo se deshabilita.
    expect(screen.getByText('Toca una estrella para calificar (1 a 5).')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '4 estrellas' }));
    expect(screen.getByText('4 de 5 · Muy rica')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar calificación' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Muy salado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar calificación' }));

    expect(await screen.findByText('¡Gracias! Lo tendremos en cuenta en tus próximas sugerencias.')).toBeOnTheScreen();
    expect(recipes.rate).toHaveBeenCalledWith('pm1', 4, ['too_salty'], '');
    expect(onRated).toHaveBeenCalled();
  });
});
