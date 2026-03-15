// hooks/use-account-mutations.ts
import { useCreate, useUpdate, useDelete } from './use-mutations';
import type { Account, CreateAccountInput, UpdateAccountInput } from '@/types/account';

const ENDPOINT = '/api/accounts';
const QUERY_KEY = ['accounts'];

export function useCreateAccount() {
  return useCreate<Account, CreateAccountInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: 'Account created successfully',
    errorMessage: 'Failed to create account',
  });
}

export function useUpdateAccount() {
  return useUpdate<Account, UpdateAccountInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: 'Account updated successfully',
    errorMessage: 'Failed to update account',
  });
}

export function useDeleteAccount() {
  return useDelete<null>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: 'Account deleted successfully',
    errorMessage: 'Failed to delete account',
  });
}