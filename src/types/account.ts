// types/account.ts

export interface Account {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  currentBalance: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

export interface AccountsPaginatedResponse {
  success: boolean;
  data: AccountsResponse;
  pagination: PaginationMetadata;
}

export interface CreateAccountInput {
  name: string;
  description?: string;
  isActive?: boolean;
  ownerId: string;
}

export interface UpdateAccountInput {
  _id: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface AccountFormData {
  name: string;
  description: string;
  isActive: boolean;
}

export interface AccountFormErrors {
  name?: string;
  description?: string;
}

//---------- // types/account.ts

// export interface Account {
//   _id: string;
//   name: string;
//   description?: string;
//   ownerId: string
//   currentBalance: number;
//   isActive: boolean;
//   isDeleted: boolean;
//   createdAt: string;
//   updatedAt: string;
// }

// export interface CreateAccountInput {
//   name: string;
//   description?: string;
//   isActive?: boolean;
// }

// export interface UpdateAccountInput {
//   _id: string;
//   name?: string;
//   description?: string;
//   isActive?: boolean;
// }

// // types/account.ts

// // export interface Account {
// //   _id: string;
// //   name: string;
// //   description: string;
// //   ownerId: string;
// //   currentBalance: number;
// //   isActive: boolean;
// //   isDeleted: boolean;
// //   createdAt: string;
// //   updatedAt: string;
// // }

// export interface AccountsResponse {
//   accounts: Account[];
// }

// export interface AccountsPaginatedResponse {
//   success: boolean;
//   data: AccountsResponse;
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

// export interface CreateAccountInput {
//   name: string;
//   description?: string;
//   isActive?: boolean;
// }

// export interface UpdateAccountInput {
//   name?: string;
//   description?: string;
//   isActive?: boolean;
// }

// export interface AccountFormData {
//   name: string;
//   description: string;
//   isActive: boolean;
// }

// export interface AccountFormErrors {
//   name?: string;
//   description?: string;
// }