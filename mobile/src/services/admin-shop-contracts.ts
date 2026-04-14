// ─── Admin Shop API Contracts ─────────────────────────────────
// Centralized, typed wrappers for all admin shop item endpoints.

import { adminApi } from './api';
import type { ShopItem, ApiResponse } from '@kd/shared';

export async function adminFetchShopItems(): Promise<ShopItem[]> {
  const { data } = await adminApi.get<ApiResponse<ShopItem[]>>('/shop-items');
  return (data?.data ?? []) as ShopItem[];
}

export async function adminCreateShopItem(
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data } = await adminApi.post<ApiResponse<{ id: string }>>('/shop-items', payload);
  return data?.data as { id: string };
}

export async function adminUpdateShopItem(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data } = await adminApi.put<ApiResponse<{ id: string }>>(`/shop-items/${id}`, payload);
  return data?.data as { id: string };
}

export async function adminDeleteShopItem(id: string): Promise<void> {
  await adminApi.delete(`/shop-items/${id}`);
}

// ─── Exam CRUD contracts ─────────────────────────────────────

export async function adminCreateExamApi(
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data } = await adminApi.post<ApiResponse<{ id: string }>>('/exams', payload);
  return data?.data as { id: string };
}

export async function adminUpdateExamApi(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data } = await adminApi.put<ApiResponse<{ id: string }>>(`/exams/${id}`, payload);
  return data?.data as { id: string };
}

export async function adminDeleteExamApi(id: string): Promise<void> {
  await adminApi.delete(`/exams/${id}`);
}
