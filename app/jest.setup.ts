import '@/infrastructure/i18n';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Router simulado: las pruebas verifican a dónde se navega sin montar Expo Router.
// Reconocimiento de voz (nativo): las pruebas disparan los eventos con __emit.
jest.mock('expo-speech-recognition', () => {
  const { useEffect } = jest.requireActual('react');
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const emit = (name: string, event: unknown) => (listeners[name] ?? []).slice().forEach((listener) => listener(event));
  const ExpoSpeechRecognitionModule = {
    isRecognitionAvailable: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    start: jest.fn(() => emit('start', {})),
    stop: jest.fn(() => emit('end', {})),
    abort: jest.fn(),
  };
  return {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent: (name: string, listener: (event: unknown) => void) => {
      useEffect(() => {
        (listeners[name] ??= []).push(listener);
        return () => {
          listeners[name] = (listeners[name] ?? []).filter((l) => l !== listener);
        };
      }, [name, listener]);
    },
    __emit: emit,
  };
});

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => false) };
  return {
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
  };
});
