import api from "@/lib/axios";
import type { PaginatedResponse, SeedInventory, SeedMovement, StorageReading, StorageUnit } from "@/types";

export const storageService = {
  // Storage Units
  getUnits: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<StorageUnit> | StorageUnit[]>("/v1/storage/units", { params }),

  getUnit: (id: number) =>
    api.get<StorageUnit>(`/v1/storage/units/${id}`),

  createUnit: (data: Partial<StorageUnit>) =>
    api.post<StorageUnit>("/v1/storage/units", data),

  updateUnit: (id: number, data: Partial<StorageUnit>) =>
    api.put<StorageUnit>(`/v1/storage/units/${id}`, data),

  recordReading: (unitId: number, data: Partial<StorageReading>) =>
    api.post<StorageReading>(`/v1/storage/units/${unitId}/readings`, data),

  getReadings: (unitId: number, params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<StorageReading>>(`/v1/storage/units/${unitId}/readings`, { params }),

  // Inventory
  getInventory: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<SeedInventory>>("/v1/storage/inventory", { params }),

  getInventoryItem: (id: number) =>
    api.get<SeedInventory>(`/v1/storage/inventory/${id}`),

  createInventory: (data: FormData | Partial<SeedInventory>) =>
    api.post<SeedInventory>("/v1/storage/inventory", data),

  updateInventory: (id: number, data: Partial<SeedInventory>) =>
    api.put<SeedInventory>(`/v1/storage/inventory/${id}`, data),

  recordMovement: (inventoryId: number, data: Partial<SeedMovement>) =>
    api.post<SeedMovement>(`/v1/storage/inventory/${inventoryId}/movements`, data),

  getMovements: (inventoryId: number) =>
    api.get<PaginatedResponse<SeedMovement>>(`/v1/storage/inventory/${inventoryId}/movements`),

  // Dashboard
  getDashboard: () =>
    api.get<{
      totalInventory: number;
      lowStock: number;
      highMoisture: number;
      expiredSoon: number;
      storageUnits: Array<{ id: number; name: string; code: string; occupancy_rate: number; capacity: number; used: number }>;
    }>("/v1/storage/dashboard"),

  lookup: (code: string) =>
    api.get<SeedInventory>("/v1/storage/lookup", { params: { code } }),
};
