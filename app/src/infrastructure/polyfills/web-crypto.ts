import 'react-native-get-random-values'; // crypto.getRandomValues

import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

/**
 * React Native no trae `crypto.subtle`. Supabase Auth lo usa para el desafío PKCE con SHA-256 de los
 * enlaces de correo; sin él cae a "plain" (menos seguro) y muestra una advertencia.
 * Aquí se aporta SOLO `digest`, con la implementación nativa de expo-crypto.
 */
const ALGORITHMS: Record<string, CryptoDigestAlgorithm> = {
  'SHA-1': CryptoDigestAlgorithm.SHA1,
  'SHA-256': CryptoDigestAlgorithm.SHA256,
  'SHA-384': CryptoDigestAlgorithm.SHA384,
  'SHA-512': CryptoDigestAlgorithm.SHA512,
};

type DigestFn = (algorithm: CryptoDigestAlgorithm, data: BufferSource) => Promise<ArrayBuffer>;

export function installWebCryptoDigest(target: { crypto?: object }, digestFn: DigestFn = digest) {
  if (!target.crypto) target.crypto = {};
  if ('subtle' in target.crypto && target.crypto.subtle) return;
  const subtle = {
    digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
      const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
      const supported = ALGORITHMS[name];
      if (!supported) return Promise.reject(new Error(`digest: algoritmo no soportado (${name})`));
      return digestFn(supported, data);
    },
  };
  Object.defineProperty(target.crypto, 'subtle', { value: subtle, configurable: true });
}

installWebCryptoDigest(globalThis as { crypto?: object });
