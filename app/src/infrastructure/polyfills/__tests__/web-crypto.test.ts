import { installWebCryptoDigest } from '@/infrastructure/polyfills/web-crypto';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512' },
  digest: jest.fn(),
}));

type WithSubtle = { crypto?: { subtle?: { digest: (a: string, d: BufferSource) => Promise<ArrayBuffer> } } };

describe('polyfill de crypto.subtle.digest (PKCE con SHA-256)', () => {
  it('aporta digest cuando el entorno no lo tiene, delegando en expo-crypto', async () => {
    const target: WithSubtle = { crypto: {} };
    const digestFn = jest.fn(async () => new ArrayBuffer(32));
    installWebCryptoDigest(target, digestFn);

    const data = new TextEncoder().encode('verificador');
    await target.crypto!.subtle!.digest('sha-256', data);
    expect(digestFn).toHaveBeenCalledWith('SHA-256', data);
  });

  it('rechaza algoritmos no soportados', async () => {
    const target: WithSubtle = {};
    installWebCryptoDigest(target, jest.fn());
    await expect(target.crypto!.subtle!.digest('MD5', new Uint8Array())).rejects.toThrow('no soportado');
  });

  it('no reemplaza un crypto.subtle real', () => {
    const real = { digest: jest.fn() };
    const target = { crypto: { subtle: real } };
    installWebCryptoDigest(target, jest.fn());
    expect(target.crypto.subtle).toBe(real);
  });
});
