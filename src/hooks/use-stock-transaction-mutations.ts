// hooks/use-stock-transaction-mutations.ts
import { CreateStockTransactionDto } from "@/lib/validations/stockTransaction";
import { useCreate, useUpdate, useDelete } from "./use-mutations";
import type {
  StockTransaction,
  CreateStockTransactionInput
} from "@/types/seller/stock-transaction";

const ENDPOINT = "/api/stock-transactions";
const QUERY_KEY = ["stock-transactions"];

export function useCreateStockTransaction() {
  return useCreate<StockTransaction, CreateStockTransactionInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Stock entry added successfully",
    errorMessage: "Failed to add stock entry",
  });
}

// export function useUpdateStockTransaction() {
//   return useUpdate<StockTransaction, { _id: string } & Partial<CreateStockTransactionInput>>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     successMessage: "Stock entry updated successfully",
//     errorMessage: "Failed to update stock entry",
//   });
// }

export function useUpdateStockTransaction() {
  return useUpdate<StockTransaction, { _id: string } & Partial<CreateStockTransactionDto>>(
    ENDPOINT,
    {
      queryKey: QUERY_KEY,
      successMessage: "Stock transaction updated successfully",
      errorMessage: "Failed to update stock transaction",
    }
  );
}

export function useDeleteStockTransaction() {
  return useDelete<null>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Stock entry deleted successfully",
    errorMessage: "Failed to delete stock entry",
  });
}