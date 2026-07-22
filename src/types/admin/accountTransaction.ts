// types/accountTransaction.ts

import type { PaginationMetadata } from './account';

export type { PaginationMetadata };

export interface AccountTransaction {
  _id: string;
  accountId: string | { _id: string; name: string };
  type: "CREDIT" | "DEBIT";
  amount: number;
  note: string;
  billUrl?: string | null;
  balanceBefore: number;
  balanceAfter: number;
  performedBy: string;
  enteredAt: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountTransactionsResponse {
  transactions: AccountTransaction[];
}

export interface AccountTransactionsPaginatedResponse {
  success: boolean;
  data: AccountTransactionsResponse;
  pagination: PaginationMetadata;
}

export interface AccountTransactionSummary {
  accountId: string;
  accountName: string;
  currentBalance: number;
  totalCredit: number;
  totalDebit: number;
  netFlow: number;
  totalEntries: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

export interface CreateAccountTransactionInput {
  accountId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  enteredAt: Date;
  billUrl?: string | null;
  note: string;
}

export interface UpdateAccountTransactionInput {
  _id: string;
  enteredAt: Date;
  billUrl?: string | null;
  note: string;
}

export interface TransactionFormData {
  type: "CREDIT" | "DEBIT";
  amount: string;
  note: string;
  billUrl: string;
  enteredAt: string;
}

export interface TransactionFormErrors {
  type?: string;
  amount?: string;
  note?: string;
  billUrl?: string;
  enteredAt?: string;
}

//------- // types/accountTransaction.ts

// export interface AccountTransaction {
//   _id: string;
//   accountId: string
//   type: 'CREDIT' | 'DEBIT';
//   amount: number;
//   note: string;
//   billUrl?: string | null;
//   balanceBefore: number;
//   balanceAfter: number;
//   performedBy: string
//   enteredAt: string;
//   isDeleted: boolean;
//   createdAt: string;
//   updatedAt: string;
// }

// export interface CreateAccountTransactionInput {
//   accountId: string;
//   type: 'CREDIT' | 'DEBIT';
//   amount: number;
//   note?: string;
//   billUrl?: string | null;
//   enteredAt?: Date;
// }

// export interface UpdateAccountTransactionInput {
//   _id: string;
//   note?: string;
//   billUrl?: string | null;
// }

// export interface AccountTransactionSummary {
//   accountId: string;
//   accountName: string;
//   totalCredit: number;
//   totalDebit: number;
//   currentBalance: number;
//   totalEntries: number;
// }

// // types/accountTransaction.ts

// // export interface AccountTransaction {
// //   _id: string;
// //   accountId: string | { _id: string; name: string };
// //   type: "CREDIT" | "DEBIT";
// //   amount: number;
// //   note: string;
// //   billUrl?: string | null;
// //   balanceBefore: number;
// //   balanceAfter: number;
// //   performedBy: string;
// //   enteredAt: string;
// //   isDeleted: boolean;
// //   createdAt: string;
// //   updatedAt: string;
// // }

// export interface AccountTransactionsResponse {
//   transactions: AccountTransaction[];
// }

// export interface AccountTransactionsPaginatedResponse {
//   success: boolean;
//   data: AccountTransactionsResponse;
//   pagination: PaginationMetadata;
// }

// export interface PaginationMetadata {
//   page: number;
//   limit: number;
//   totalCount: number;
//   totalPages: number;
//   hasNextPage: boolean;
//   hasPreviousPage: boolean;
//   startIndex: number;
//   endIndex: number;
// }

// export interface AccountTransactionSummary {
//   accountId: string;
//   accountName: string;
//   currentBalance: number;
//   totalCredit: number;
//   totalDebit: number;
//   netFlow: number;
//   totalEntries: number;
//   firstEntryDate: string | null;
//   lastEntryDate: string | null;
// }

// // export interface CreateAccountTransactionInput {
// //   accountId: string;
// //   type: "CREDIT" | "DEBIT";
// //   amount: number;
// //   note?: string;
// //   billUrl?: string | null;
// //   enteredAt?: string;
// // }

// export interface UpdateAccountTransactionInput {
//   note?: string;
//   billUrl?: string | null;
// }

// export interface TransactionFormData {
//   type: "CREDIT" | "DEBIT";
//   amount: string;
//   note: string;
//   billUrl: string;
//   enteredAt: string;
// }

// export interface TransactionFormErrors {
//   type?: string;
//   amount?: string;
//   note?: string;
//   billUrl?: string;
//   enteredAt?: string;
// }