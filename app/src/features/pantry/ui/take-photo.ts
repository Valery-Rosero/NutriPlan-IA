import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PantryPhoto } from '@/features/pantry/domain/pantry';

/** Lado mayor de la foto que se envía: suficiente para leer un recibo, unos 150 KB (ADR-032). */
const MAX_WIDTH = 1024;

export type PhotoOutcome = { kind: 'photo'; photo: PantryPhoto } | { kind: 'canceled' } | { kind: 'denied' };

/**
 * F-1: el permiso de cámara se pide aquí, al tocar el botón (nunca antes). Si lo niega, quien llama ofrece la
 * galería. La foto se reduce y se comprime en el teléfono y solo vive en memoria: no se guarda en ningún lado.
 */
export async function takePantryPhoto(source: 'camera' | 'library'): Promise<PhotoOutcome> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return { kind: 'canceled' };

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH || asset.width === 0) context.resize({ width: MAX_WIDTH, height: null });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  if (!saved.base64) return { kind: 'canceled' };
  return { kind: 'photo', photo: { base64: saved.base64, mimeType: 'image/jpeg' } };
}
