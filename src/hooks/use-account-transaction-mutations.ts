// hooks/use-account-transaction-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreate, useUpdate, useDelete } from './use-mutations';
import type {
  AccountTransaction,
  CreateAccountTransactionInput,
  UpdateAccountTransactionInput,
} from '@/types/accountTransaction';
import { toast } from 'sonner';

const ENDPOINT = '/api/account-transactions';
const QUERY_KEY = ['accountTransactions'];

export function useCreateAccountTransaction() {
  const queryClient = useQueryClient();

  return useCreate<AccountTransaction, CreateAccountTransactionInput>(ENDPOINT, {
    // queryKey: [...QUERY_KEY, 'accounts'], // Also invalidate accounts for balance update
    queryKey: QUERY_KEY, // Also invalidate accounts for balance update
    successMessage: 'Transaction recorded successfully',
    errorMessage: 'Failed to record transaction',
    onSuccess: () => {
      // Invalidate separately, not merged into one key
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-summary'] });
    },
  });
}

export function useUpdateAccountTransaction() {
  return useUpdate<AccountTransaction, UpdateAccountTransactionInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: 'Transaction updated successfully',
    errorMessage: 'Failed to update transaction',
  });
}

export function useDeleteAccountTransaction() {
  return useDelete<null>(ENDPOINT, {
    queryKey: [...QUERY_KEY, 'accounts'],
    successMessage: 'Transaction deleted successfully',
    errorMessage: 'Failed to delete transaction',
  });
}


// ✅ New: Cancel transaction (POST /api/account-transactions/[id]/cancel)
export function useCancelAccountTransaction() {
  const queryClient = useQueryClient();
 
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await fetch(`/api/account-transactions/${transactionId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to cancel transaction');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Transaction cancelled and balance recalculated');
      queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-summary'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to cancel transaction');
    },
  });
}