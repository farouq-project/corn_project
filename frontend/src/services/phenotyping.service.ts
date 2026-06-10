import api from "@/lib/axios";
import type { AggregatedRow, Characteristic, ObservationRecord, PaginatedResponse } from "@/types";

export const phenotypingService = {
  getCharacteristics: (params?: Record<string, unknown>) =>
    api.get<Characteristic[]>("/v1/phenotyping/characteristics", { params }),

  createCharacteristic: (data: Partial<Characteristic>) =>
    api.post<Characteristic>("/v1/phenotyping/characteristics", data),

  updateCharacteristic: (id: number, data: Partial<Characteristic>) =>
    api.put<Characteristic>(`/v1/phenotyping/characteristics/${id}`, data),

  deleteCharacteristic: (id: number) =>
    api.delete(`/v1/phenotyping/characteristics/${id}`),

  getRecords: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<ObservationRecord>>("/v1/phenotyping/records", { params }),

  createRecord: (data: Partial<Omit<ObservationRecord, "values">> & { values?: { characteristic_id: number; value: number | null }[] }) =>
    api.post<ObservationRecord>("/v1/phenotyping/records", data),

  updateRecord: (id: number, data: Partial<Omit<ObservationRecord, "values">> & { values?: { characteristic_id: number; value: number | null }[] }) =>
    api.put<ObservationRecord>(`/v1/phenotyping/records/${id}`, data),

  deleteRecord: (id: number) =>
    api.delete(`/v1/phenotyping/records/${id}`),

  getAggregate: (params?: Record<string, unknown>) =>
    api.get<{ data: AggregatedRow[] }>("/v1/phenotyping/aggregate", { params }),
};
