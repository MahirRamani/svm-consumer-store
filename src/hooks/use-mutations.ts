// hooks/use-mutations.ts
import { ApiResponse } from '@/lib/api/base-handler';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface MutationConfig<TData, TVariables> {
  queryKey: string[];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

interface ApiErrorResponse {
  success: false;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  message?: string;
}

// Generic Create Hook
export function useCreate<TData, TVariables>(
  endpoint: string,
  config: MutationConfig<TData, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TVariables): Promise<TData> => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<TData> | ApiErrorResponse = await response.json();

      if (!response.ok) {
        const errorMsg =
          (result as ApiErrorResponse).error?.message ||
          (result as ApiErrorResponse).message ||
          "Failed to create resource";
        throw new Error(errorMsg);
      }

      const successResult = result as ApiResponse<TData>;
      if (!successResult.success || !successResult.data) {
        throw new Error("Invalid response from server");
      }

      return successResult.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      if (config.successMessage) {
        toast.success(config.successMessage);
      }
      config.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message || config.errorMessage || "An error occurred");
      config.onError?.(error);
    },
  });
}

// Generic Update Hook - Updated to use _id
export function useUpdate<TData, TVariables extends { _id: string }>(
  endpoint: string,
  config: MutationConfig<TData, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ _id, ...data }: TVariables): Promise<TData> => {
      const response = await fetch(`${endpoint}/${_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<TData> | ApiErrorResponse = await response.json();

      if (!response.ok) {
        const errorMsg =
          (result as ApiErrorResponse).error?.message ||
          (result as ApiErrorResponse).message ||
          "Failed to update resource";
        throw new Error(errorMsg);
      }

      const successResult = result as ApiResponse<TData>;
      if (!successResult.success || !successResult.data) {
        throw new Error("Invalid response from server");
      }

      return successResult.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      if (config.successMessage) {
        toast.success(config.successMessage);
      }
      config.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message || config.errorMessage || "An error occurred");
      config.onError?.(error);
    },
  });
}

// Generic Delete Hook
export function useDelete<TData>(
  endpoint: string,
  config: MutationConfig<TData, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<TData> => {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
      });

      const result: ApiResponse<TData> | ApiErrorResponse = await response.json();

      if (!response.ok) {
        const errorMsg =
          (result as ApiErrorResponse).error?.message ||
          (result as ApiErrorResponse).message ||
          "Failed to delete resource";
        throw new Error(errorMsg);
      }

      const successResult = result as ApiResponse<TData>;

      // For delete, data might be null
      return successResult.data as TData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      if (config.successMessage) {
        toast.success(config.successMessage);
      }
      config.onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message || config.errorMessage || "An error occurred");
      config.onError?.(error);
    },
  });
}