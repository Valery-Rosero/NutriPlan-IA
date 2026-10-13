import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** ¿Hay conexión? Lo que sabe TanStack Query (alimentado por NetInfo). */
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
