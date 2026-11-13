import { authLinkTarget, isRecoveryPending, RECOVERY_WINDOW_MS, routeOf } from '@/features/auth/domain/auth-links';

describe('enlaces de correo (recuperar contraseña y verificar cuenta)', () => {
  it('reconoce la pantalla de la dirección', () => {
    expect(routeOf('nutriplan://reset-password?code=abc')).toBe('reset-password');
    expect(routeOf('/auth-callback?code=abc')).toBe('auth-callback');
    expect(routeOf('exp://192.168.0.5:8081/--/reset-password?code=abc')).toBe('reset-password');
    expect(routeOf('nutriplan://?code=abc')).toBe('');
  });

  it('si el enlace ya apunta a su pantalla, no se toca', () => {
    expect(authLinkTarget('nutriplan://reset-password?code=abc', true)).toBeNull();
    expect(authLinkTarget('nutriplan://auth-callback?code=abc', false)).toBeNull();
  });

  it('si Supabase devolvió a la dirección principal, el código va a "Nueva contraseña" cuando se pidió recuperar', () => {
    expect(authLinkTarget('nutriplan://?code=abc', true)).toBe('/reset-password?code=abc');
    expect(authLinkTarget('/?code=abc', true)).toBe('/reset-password?code=abc');
  });

  it('sin recuperación pedida, el código es de verificar la cuenta', () => {
    expect(authLinkTarget('nutriplan://?code=abc', false)).toBe('/auth-callback?code=abc');
  });

  it('los errores del enlace (vencido) también llegan a su pantalla, desde la consulta o el fragmento', () => {
    expect(authLinkTarget('nutriplan://#error=access_denied&error_code=otp_expired', true)).toBe(
      '/reset-password?error=access_denied&error_code=otp_expired',
    );
  });

  it('los demás enlaces (avisos, recetas) no se tocan', () => {
    expect(authLinkTarget('nutriplan://recipe/123?mealId=9', true)).toBeNull();
    expect(authLinkTarget('/week', false)).toBeNull();
  });

  it('la marca de recuperación vence a las 2 horas', () => {
    const now = 1_000_000_000;
    expect(isRecoveryPending(now - 60_000, now)).toBe(true);
    expect(isRecoveryPending(now - RECOVERY_WINDOW_MS - 1, now)).toBe(false);
    expect(isRecoveryPending(null, now)).toBe(false);
  });
});
