import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200) {
  const body: ApiResponse<T> = { success: true, data, message };
  return res.status(status).json(body);
}

export function sendError(res: Response, error: string, status = 400) {
  const body: ApiResponse = { success: false, error };
  return res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const body: ApiResponse<T[]> = {
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  return res.status(200).json(body);
}
