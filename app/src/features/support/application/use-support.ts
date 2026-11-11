import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/di/services';
import type { NewTicket } from '@/features/support/domain/support';

export function useSendTicket() {
  const { support } = useServices();
  return useMutation({ mutationFn: (ticket: NewTicket) => support.send(ticket) });
}
