// Pruebas de integración: los adaptadores REALES de la app contra Supabase local (Docker).
// Uso: (cd ../backend && npx supabase start) y luego `npm run test:integration`.
// Sin el preset jest-expo: aquí se necesita el fetch nativo de Node para hablar con Supabase.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.int.test.ts'],
  testTimeout: 60000,
  transform: { '^.+\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
