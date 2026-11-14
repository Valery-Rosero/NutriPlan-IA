import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Entrega 2 del asistente v2 · dictar con un botón propio (junto a enviar, como WhatsApp). El reconocimiento es el
 * del teléfono: en el mismo teléfono cuando se puede (el audio no sale), si no, el servicio de voz del teléfono.
 * NutriPlan no graba ni guarda la voz: solo recibe el texto, que la persona revisa antes de enviar.
 */
export type DictationError = 'denied' | 'unavailable' | 'noSpeech' | 'network' | 'failed';

/** Un solo reconocedor en el teléfono: solo el campo que empezó a dictar recibe el texto. */
let owner: string | null = null;

/** ¿El teléfono tiene reconocimiento de voz? Si no, se muestra la pista del micrófono del teclado. */
export function dictationAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

const ERRORS: Record<string, DictationError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'unavailable',
  'language-not-supported': 'unavailable',
  'no-speech': 'noSpeech',
  'speech-timeout': 'noSpeech',
  network: 'network',
};

/**
 * `onText(texto, final)`: llega mientras se habla (texto parcial) y al terminar (final). Quien lo usa decide cómo
 * juntarlo con lo que ya estaba escrito.
 */
export function useDictation(onText: (text: string, final: boolean) => void) {
  const id = useId();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<DictationError | null>(null);
  const onDevice = useRef(false);
  const retried = useRef(false);
  const pendingRetryEnd = useRef(false);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  const begin = (preferOnDevice: boolean) => {
    onDevice.current = preferOnDevice;
    ExpoSpeechRecognitionModule.start({
      lang: 'es-CO',
      interimResults: true,
      continuous: false,
      // Privacidad: en el teléfono cuando se puede (el audio no sale del teléfono).
      requiresOnDeviceRecognition: preferOnDevice,
      addsPunctuation: true,
    });
  };

  useSpeechRecognitionEvent('start', () => {
    if (owner === id) setListening(true);
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (owner !== id) return;
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (text) callback.current(text, event.isFinal);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (owner !== id || event.error === 'aborted') return;
    // El español de Colombia aún no está descargado en el teléfono: se intenta con el servicio de voz.
    if (event.error === 'language-not-supported' && onDevice.current && !retried.current) {
      retried.current = true;
      pendingRetryEnd.current = true;
      begin(false);
      return;
    }
    setError(ERRORS[event.error] ?? 'failed');
    setListening(false);
  });
  useSpeechRecognitionEvent('end', () => {
    // Tras reintentar con el servicio de voz llega el "end" del primer intento: se sigue escuchando.
    if (owner !== id) return;
    if (retried.current && !onDevice.current && pendingRetryEnd.current) {
      pendingRetryEnd.current = false;
      return;
    }
    setListening(false);
  });

  const start = async () => {
    setError(null);
    retried.current = false;
    pendingRetryEnd.current = false;
    if (!dictationAvailable()) {
      setError('unavailable');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('denied');
      return;
    }
    owner = id;
    let preferOnDevice = false;
    try {
      preferOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      preferOnDevice = false;
    }
    begin(preferOnDevice);
  };

  const stop = () => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  };

  return { listening, error, start, stop };
}

/** Junta lo que ya estaba escrito con lo dictado ("Algo para el almuerzo" + "con pollo"). */
export const joinDictation = (before: string, spoken: string) => (before.trim() ? `${before.trim()} ${spoken}` : spoken);
