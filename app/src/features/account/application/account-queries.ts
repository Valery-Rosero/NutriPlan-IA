import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Share } from 'react-native';

import { useServices } from '@/di/services';

/** Exportar: se entrega con la hoja de compartir del sistema (correo, Drive, WhatsApp…). */
export function useExportMyData(title: string) {
  const { account } = useServices();
  return useMutation({
    mutationFn: async () => {
      const json = await account.exportData();
      await Share.share({ title, message: json });
    },
  });
}

export function useDeleteAccount() {
  const { account } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => account.deleteAccount(confirmation),
    onSuccess: () => queryClient.clear(),
  });
}
