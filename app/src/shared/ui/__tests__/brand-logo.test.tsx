import { render, screen } from '@testing-library/react-native';

import { SignInScreen } from '@/features/auth/ui/sign-in-screen';
import { WelcomeScreen } from '@/features/auth/ui/welcome-screen';
import { TodayScreen } from '@/features/today/ui/today-screen';
import { fakeServices, withServices } from '@/test/fakes';
import { BrandLogo, BrandSplash } from '@/shared/ui';

describe('Logo de NutriPlan IA', () => {
  it('se anuncia como "NutriPlan IA" (y el lema, si va)', async () => {
    await render(<BrandLogo variant="stacked" tagline />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByRole('image', { name: 'NutriPlan IA. Alimenta tu mejor versión' })).toBeOnTheScreen();
    expect(screen.getByText('ALIMENTA TU MEJOR VERSIÓN')).toBeOnTheScreen();
  });

  it('al iniciar: el logo principal con el lema', async () => {
    await render(<BrandSplash />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByRole('image', { name: 'NutriPlan IA. Alimenta tu mejor versión' })).toBeOnTheScreen();
  });

  it('en el ingreso: el logo principal arriba', async () => {
    await render(<SignInScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByRole('image', { name: 'NutriPlan IA. Alimenta tu mejor versión' })).toBeOnTheScreen();
  });

  it('en la bienvenida y en Hoy: el logo pequeño', async () => {
    await render(<WelcomeScreen />, { wrapper: withServices(fakeServices()) });
    expect(screen.getByRole('image', { name: 'NutriPlan IA' })).toBeOnTheScreen();

    await render(<TodayScreen />, { wrapper: withServices(fakeServices()) });
    expect(await screen.findByRole('image', { name: 'NutriPlan IA' })).toBeOnTheScreen();
    expect(screen.getByText(/^Buen(os|as) (días|tardes|noches) · /)).toBeOnTheScreen(); // el saludo sigue, junto a la fecha
  });
});
