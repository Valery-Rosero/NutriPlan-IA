import { z } from 'zod';

// Los mensajes son claves i18n: el dominio no conoce el idioma.
// Primero se normaliza (espacios y mayúsculas que dejan los teclados) y luego se valida el formato.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: 'validation.email' }));

/** Igual que la configuración de Supabase Auth: ≥ 8, minúscula, mayúscula y número (US-104). */
export const passwordSchema = z
  .string()
  .min(8, { error: 'validation.passwordLength' })
  .regex(/[a-z]/, { error: 'validation.passwordLower' })
  .regex(/[A-Z]/, { error: 'validation.passwordUpper' })
  .regex(/\d/, { error: 'validation.passwordDigit' });

const mustAccept = z.boolean().refine((v) => v, { error: 'validation.mustAccept' });

/** Las casillas nunca vienen marcadas: el formulario arranca en false (checklist legal). */
export const signUpFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  isAdult: mustAccept,
  acceptTerms: mustAccept,
  acceptPrivacy: mustAccept,
});
export type SignUpForm = z.infer<typeof signUpFormSchema>;

export const signInFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'validation.required' }),
});
export type SignInForm = z.infer<typeof signInFormSchema>;

export const emailFormSchema = z.object({ email: emailSchema });
export type EmailForm = z.infer<typeof emailFormSchema>;

export const newPasswordFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: 'validation.passwordsMatch', path: ['confirm'] });
export type NewPasswordForm = z.infer<typeof newPasswordFormSchema>;
