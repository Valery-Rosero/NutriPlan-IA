import '@/infrastructure/i18n';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Router simulado: las pruebas verifican a dónde se navega sin montar Expo Router.
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => false) };
  return {
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
  };
});
