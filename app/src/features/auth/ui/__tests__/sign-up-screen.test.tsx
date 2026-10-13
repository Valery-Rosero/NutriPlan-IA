import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { AppError } from '@/core/errors/app-error';
import { SignUpScreen } from '@/features/auth/ui/sign-up-screen';
import { fakeAuth, fakeServices, withServices } from '@/test/fakes';

async function fillForm() {
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Arepa2026');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Soy mayor de 18 años.' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Acepto los Términos y Condiciones.' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: /Acepto la Política de Tratamiento/ }));
}

describe('SignUpScreen (US-104, US-113)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('las casillas de consentimiento empiezan sin marcar', async () => {
    await render(<SignUpScreen />, { wrapper: withServices(fakeServices()) });
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).not.toBeChecked();
    }
  });

  it('sin aceptar los documentos no envía nada y explica qué falta', async () => {
    const auth = fakeAuth();
    await render(<SignUpScreen />, { wrapper: withServices(fakeServices({ auth })) });
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Arepa2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findAllByText('Debes marcar esta casilla para continuar.')).toHaveLength(3);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('registra con las versiones vigentes y lleva a confirmar el correo', async () => {
    const auth = fakeAuth();
    await render(<SignUpScreen />, { wrapper: withServices(fakeServices({ auth })) });
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    await screen.findByRole('button', { name: 'Crear cuenta' });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ana@correo.com',
      password: 'Arepa2026',
      privacyPolicyDocumentId: 1,
      termsDocumentId: 2,
      isAdult: true,
    });
    expect(useRouter().replace).toHaveBeenCalledWith({ pathname: '/verify-email', params: { email: 'ana@correo.com' } });
  });

  it('si el correo ya existe, lo dice y ofrece iniciar sesión', async () => {
    const auth = fakeAuth({ signUp: jest.fn(async () => Promise.reject(new AppError('email_taken'))) });
    await render(<SignUpScreen />, { wrapper: withServices(fakeServices({ auth })) });
    await fillForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Este correo ya tiene una cuenta.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Iniciar sesión con este correo' }));
    expect(useRouter().replace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { email: 'ana@correo.com' } });
  });
});
