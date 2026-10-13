import '@/infrastructure/i18n';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Router simulado: las pruebas verifican a dónde se navega sin montar Expo Router.
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return {
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
  };
});
