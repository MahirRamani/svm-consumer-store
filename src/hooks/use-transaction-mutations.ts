// hooks/use-transaction-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Transaction, Student } from "@/types";

const ENDPOINT = "/api/transactions";
const QUERY_KEYS = {
  transactions: ["transactions"],
  students: ["students"],
  products: ["products"],
  dashboard: ["dashboard-stats"],
  fifoStocks: ["fifo-stocks"],
};

interface CreateTransactionInput {
  studentId: string;
  items: Array<{
    productId?: string;
    // subProductId?: string;
    quantity: number;
    price: number;
    stockTransactionId?: string;
  }>;
}

interface TransactionResponse {
  success: boolean;
  data?: Transaction;
  message?: string;
}

interface ErrorResponse {
  message?: string;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionData: CreateTransactionInput): Promise<TransactionResponse> => {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({
          message: "Failed to create transaction",
        }))) as ErrorResponse;
        throw new Error(error.message || "Failed to process transaction");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries
      Object.values(QUERY_KEYS).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      toast.success("Transaction completed successfully!");
    },
    onError: (error: Error) => {
      console.error("Transaction error:", error);
      toast.error(`Transaction failed: ${error.message}`);
    },
  });
}

// Hook for searching student by roll number
export function useSearchStudent() {
  return useMutation({
    mutationFn: async (rollNumber: string): Promise<Student> => {
      const response = await fetch(`/api/students/${rollNumber.trim()}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No student found with this roll number");
        }
        throw new Error("Failed to search for student");
      }

      return response.json();
    },
  });
}