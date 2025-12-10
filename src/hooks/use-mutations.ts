// hooks/use-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiResponse } from "@/types/category";

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




// import { useMutation, useQueryClient } from "@tanstack/react-query"
// import { toast } from "sonner"
// import type { ApiSuccessResponse, ApiErrorResponse } from "@/types"

// // =============================================
// // Mutation Configuration Interface
// // =============================================
// interface MutationConfig<TData, TVariables> {
//   queryKey: string[]
//   successMessage?: string // Fallback if API doesn't provide message
//   errorMessage?: string // Fallback if API doesn't provide message
//   invalidateQueries?: string[][] // Additional queries to invalidate
//   onSuccess?: (data: TData, response: ApiSuccessResponse<TData>) => void
//   onError?: (error: Error) => void
// }

// // =============================================
// // Generic Create Hook
// // =============================================
// export function useCreate<TData = unknown, TVariables = unknown>(
//   endpoint: string,
//   config: MutationConfig<TData, TVariables>
// ) {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async (data: TVariables): Promise<ApiSuccessResponse<TData>> => {
//       const response = await fetch(endpoint, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data),
//       })

//       const result = await response.json()

//       if (!response.ok) {
//         const errorData = result as ApiErrorResponse
//         throw new Error(
//           errorData.error?.message || 
//           config.errorMessage || 
//           "Failed to create resource"
//         )
//       }

//       return result as ApiSuccessResponse<TData>
//     },
//     onSuccess: (response) => {
//       // Invalidate main query
//       queryClient.invalidateQueries({ queryKey: config.queryKey })
      
//       // Invalidate additional queries if specified
//       config.invalidateQueries?.forEach((key) => {
//         queryClient.invalidateQueries({ queryKey: key })
//       })

//       // Show success message from API or fallback
//       const message = response.message || config.successMessage || "Resource created successfully"
//       toast.success(message)

//       // Call custom onSuccess if provided
//       config.onSuccess?.(response.data, response)
//     },
//     onError: (error: Error) => {
//       toast.error(error.message || config.errorMessage || "An error occurred")
//       config.onError?.(error)
//     },
//   })
// }

// // =============================================
// // Generic Update Hook
// // =============================================
// export function useUpdate<TData = unknown, TVariables extends { id: string } = { id: string }>(
//   endpoint: string,
//   config: MutationConfig<TData, TVariables>
// ) {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async ({ id, ...data }: TVariables): Promise<ApiSuccessResponse<TData>> => {
//       const response = await fetch(`${endpoint}/${id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data),
//       })

//       const result = await response.json()

//       if (!response.ok) {
//         const errorData = result as ApiErrorResponse
//         throw new Error(
//           errorData.error?.message || 
//           config.errorMessage || 
//           "Failed to update resource"
//         )
//       }

//       return result as ApiSuccessResponse<TData>
//     },
//     onSuccess: (response) => {
//       queryClient.invalidateQueries({ queryKey: config.queryKey })
      
//       config.invalidateQueries?.forEach((key) => {
//         queryClient.invalidateQueries({ queryKey: key })
//       })

//       const message = response.message || config.successMessage || "Resource updated successfully"
//       toast.success(message)

//       config.onSuccess?.(response.data, response)
//     },
//     onError: (error: Error) => {
//       toast.error(error.message || config.errorMessage || "An error occurred")
//       config.onError?.(error)
//     },
//   })
// }

// // =============================================
// // Generic Delete Hook
// // =============================================
// export function useDelete<TData = unknown>(
//   endpoint: string,
//   config: MutationConfig<TData, string>
// ) {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async (id: string): Promise<ApiSuccessResponse<TData>> => {
//       const response = await fetch(`${endpoint}/${id}`, {
//         method: "DELETE",
//       })

//       const result = await response.json()

//       if (!response.ok) {
//         const errorData = result as ApiErrorResponse
//         throw new Error(
//           errorData.error?.message || 
//           config.errorMessage || 
//           "Failed to delete resource"
//         )
//       }

//       return result as ApiSuccessResponse<TData>
//     },
//     onSuccess: (response) => {
//       queryClient.invalidateQueries({ queryKey: config.queryKey })
      
//       config.invalidateQueries?.forEach((key) => {
//         queryClient.invalidateQueries({ queryKey: key })
//       })

//       const message = response.message || config.successMessage || "Resource deleted successfully"
//       toast.success(message)

//       config.onSuccess?.(response.data, response)
//     },
//     onError: (error: Error) => {
//       toast.error(error.message || config.errorMessage || "An error occurred")
//       config.onError?.(error)
//     },
//   })
// }

// // =============================================
// // Generic Toggle Status Hook (for isActive fields)
// // =============================================
// export function useToggleStatus<TData = unknown>(
//   endpoint: string,
//   config: MutationConfig<TData, { id: string; isActive: boolean }>
// ) {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async ({ 
//       id, 
//       isActive 
//     }: { 
//       id: string
//       isActive: boolean 
//     }): Promise<ApiSuccessResponse<TData>> => {
//       const response = await fetch(`${endpoint}/${id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ isActive }),
//       })

//       const result = await response.json()

//       if (!response.ok) {
//         const errorData = result as ApiErrorResponse
//         throw new Error(
//           errorData.error?.message || 
//           config.errorMessage || 
//           "Failed to update status"
//         )
//       }

//       return result as ApiSuccessResponse<TData>
//     },
//     onSuccess: (response) => {
//       queryClient.invalidateQueries({ queryKey: config.queryKey })
      
//       config.invalidateQueries?.forEach((key) => {
//         queryClient.invalidateQueries({ queryKey: key })
//       })

//       const message = response.message || config.successMessage || "Status updated successfully"
//       toast.success(message)

//       config.onSuccess?.(response.data, response)
//     },
//     onError: (error: Error) => {
//       toast.error(error.message || config.errorMessage || "An error occurred")
//       config.onError?.(error)
//     },
//   })
// }