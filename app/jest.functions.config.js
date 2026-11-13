// Lógica pura de las Edge Functions (Deno) probada con Jest en Node, sin Deno ni Docker.
// Solo para módulos sin red ni base (p. ej. assistant-chat/logic.ts); los imports `npm:` de Deno
// se redirigen al mismo paquete instalado en la app.
// Uso: `npm run test:functions`.
module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/../backend/supabase/functions'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: { '^npm:zod@4$': '<rootDir>/node_modules/zod' },
  // Las funciones viven fuera de app/: los ayudantes que inserta Babel (@babel/runtime) se buscan aquí.
  modulePaths: ['<rootDir>/node_modules'],
};
