import { createLoginThrottle } from '@/features/auth/domain/login-throttle';
import { passwordSchema, signUpFormSchema } from '@/features/auth/domain/schemas';

const issues = (value: string) => passwordSchema.safeParse(value).error?.issues.map((i) => i.message) ?? [];

describe('contraseña (US-104)', () => {
  it('acepta ≥ 8 caracteres con minúscula, mayúscula y número', () => {
    expect(passwordSchema.safeParse('Arepa2026').success).toBe(true);
  });

  it.each([
    ['Ab1', 'validation.passwordLength'],
    ['arepa2026', 'validation.passwordUpper'],
    ['AREPA2026', 'validation.passwordLower'],
    ['ArepaRica', 'validation.passwordDigit'],
  ])('rechaza %s con %s', (password, expected) => {
    expect(issues(password)).toContain(expected);
  });
});

describe('formulario de registro (US-113)', () => {
  const valid = { email: ' Ana@Correo.COM ', password: 'Arepa2026', isAdult: true, acceptTerms: true, acceptPrivacy: true };

  it('normaliza el correo', () => {
    expect(signUpFormSchema.parse(valid).email).toBe('ana@correo.com');
  });

  it.each(['isAdult', 'acceptTerms', 'acceptPrivacy'] as const)('exige marcar %s', (field) => {
    const result = signUpFormSchema.safeParse({ ...valid, [field]: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: [field], message: 'validation.mustAccept' });
  });
});

describe('freno de intentos de inicio de sesión', () => {
  it('bloquea 15 minutos tras 5 fallos y se libera al pasar el tiempo', () => {
    let now = 0;
    const throttle = createLoginThrottle({ now: () => now });
    for (let i = 0; i < 4; i++) throttle.recordFailure('ana@correo.com');
    expect(throttle.remainingLockMs('ana@correo.com')).toBe(0);

    throttle.recordFailure('ANA@correo.com ');
    expect(throttle.remainingLockMs('ana@correo.com')).toBe(15 * 60_000);

    now += 15 * 60_000;
    expect(throttle.remainingLockMs('ana@correo.com')).toBe(0);
    throttle.recordFailure('ana@correo.com');
    expect(throttle.remainingLockMs('ana@correo.com')).toBe(0); // el conteo reinicia tras el bloqueo
  });

  it('un inicio exitoso limpia los fallos', () => {
    const throttle = createLoginThrottle({ maxAttempts: 2, now: () => 0 });
    throttle.recordFailure('a@b.co');
    throttle.recordSuccess('a@b.co');
    throttle.recordFailure('a@b.co');
    expect(throttle.remainingLockMs('a@b.co')).toBe(0);
  });
});
