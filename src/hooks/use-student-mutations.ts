// hooks/use-student-mutations.ts
import { useCreate, useUpdate, useDelete } from './use-mutations';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Student, CreateStudentInput, UpdateStudentInput, BalanceUpdateInput } from '@/types';

const ENDPOINT = "/api/students";
const QUERY_KEY = ["students"];

export function useCreateStudent() {
  return useCreate<Student, CreateStudentInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Student created successfully",
    errorMessage: "Failed to create student",
  });
}

export function useUpdateStudent() {
  return useUpdate<Student, UpdateStudentInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Student updated successfully",
    errorMessage: "Failed to update student",
  });
}

export function useDeleteStudent() {
  return useDelete<Student>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Student deleted successfully",
    errorMessage: "Failed to delete student",
  });
}

export function useToggleStudentStatus() {
  return useUpdate<Student, { _id: string; isActive: boolean }>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Student status updated successfully",
    errorMessage: "Failed to update student status",
  });
}

// Custom hook for balance updates (top-up or deduct)
export function useUpdateStudentBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, amount, reason }: BalanceUpdateInput) => {
      const response = await fetch(`/api/students/${studentId}/balance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to update balance" }));
        throw new Error(error.message || "Failed to update balance");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      const { rollNumber, newBalance, action } = data.data;
      toast.success(`Balance ${action} successfully`, {
        description: `Roll No: ${rollNumber}  |  New Balance: ₹${newBalance}`,
      });
    },
    onError: (error: Error) => {
      console.error("Balance update error:", error);
      toast.error(`Failed to update balance: ${error.message}`);
    },
  });
}