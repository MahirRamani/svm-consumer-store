// lib/api/base-handler.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

// =============================================
// Custom API Error Class
// =============================================
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// =============================================
// Response Interfaces
// =============================================
interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

// =============================================
// Success Response Helper
// =============================================
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status: statusCode }
  );
}

// =============================================
// Paginated Response Helper
// =============================================
export function paginatedResponse<T>(
  dataKey: string,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
  }
): NextResponse<ApiResponse<Record<string, T[]>>> {
  const { page, limit, totalCount } = pagination;
  
  return NextResponse.json({
    success: true,
    data: {
      [dataKey]: data,
    },
    metadata: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}

// =============================================
// Error Response Helper
// =============================================
export function errorResponse(
  message: string,
  statusCode: number = 400,
  code?: string,
  details?: Record<string, unknown>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: code || 'ERROR',
        message,
        details,
      },
    },
    { status: statusCode }
  );
}

// =============================================
// Global Error Handler Wrapper
// =============================================
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      console.error('API Error:', error);

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        const details = error.issues.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        return errorResponse(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          details
        );
      }

      // Handle custom API errors
      if (error instanceof ApiError) {
        return errorResponse(
          error.message,
          error.statusCode,
          error.code,
          error.details
        );
      }

      // Handle Mongoose duplicate key error (E11000)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        const duplicateError = error as {
          code: number;
          keyPattern?: Record<string, unknown>;
          keyValue?: Record<string, unknown>;
        };
        
        const field = Object.keys(duplicateError.keyPattern || {})[0] || 'field';
        const value = duplicateError.keyValue?.[field];
        
        return errorResponse(
          `${field} "${value}" already exists`,
          409,
          'DUPLICATE_ERROR',
          { field, value }
        );
      }

      // Handle custom DuplicateError from model hooks
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'DuplicateError'
      ) {
        return errorResponse(
          (error as Error).message,
          409,
          'DUPLICATE_ERROR'
        );
      }

      // Handle Mongoose validation errors
      if (error && typeof error === 'object' && 'name' in error) {
        if (error.name === 'ValidationError') {
          const validationError = error as mongoose.Error.ValidationError;
          const details = Object.keys(validationError.errors).reduce((acc, key) => {
            acc[key] = validationError.errors[key].message;
            return acc;
          }, {} as Record<string, string>);

          return errorResponse(
            'Database validation failed',
            400,
            'DB_VALIDATION_ERROR',
            details
          );
        }

        if (error.name === 'CastError') {
          return errorResponse(
            'Invalid ID format',
            400,
            'INVALID_ID'
          );
        }
      }

      // Generic error
      return errorResponse(
        'An unexpected error occurred',
        500,
        'INTERNAL_ERROR'
      );
    }
  };
}