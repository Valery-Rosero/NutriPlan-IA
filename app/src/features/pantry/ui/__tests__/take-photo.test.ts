import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { takePantryPhoto } from '@/features/pantry/ui/take-photo';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const mockSaveAsync = jest.fn(async () => ({ uri: 'file://reducida.jpg', width: 1024, height: 768, base64: 'BASE64' }));
const mockResize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn(() => ({ resize: mockResize, renderAsync: jest.fn(async () => ({ saveAsync: mockSaveAsync })) })) },
}));

const asset = (width: number) => ({ canceled: false, assets: [{ uri: 'file://foto.jpg', width, height: 3000 }] });

describe('takePantryPhoto (ADR-032)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('con permiso, toma la foto, la reduce a 1024 px y la envía como JPEG comprimido en base64', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue(asset(4000) as unknown as ImagePicker.ImagePickerResult);

    expect(await takePantryPhoto('camera')).toEqual({ kind: 'photo', photo: { base64: 'BASE64', mimeType: 'image/jpeg' } });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file://foto.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 1024, height: null });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.6, base64: true });
  });

  it('una foto pequeña no se agranda', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset(800) as unknown as ImagePicker.ImagePickerResult);
    await takePantryPhoto('library');
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('la galería no pide permiso de cámara', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(asset(2000) as unknown as ImagePicker.ImagePickerResult);
    await takePantryPhoto('library');
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('si se cancela, no envía nada', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true, assets: null } as ImagePicker.ImagePickerResult);
    expect(await takePantryPhoto('camera')).toEqual({ kind: 'canceled' });
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });
});
